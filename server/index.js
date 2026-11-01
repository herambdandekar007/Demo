const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment configuration
const envPaths = [
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '../.env')
];
for (const p of envPaths) {
  dotenv.config({ path: p });
}

const { checkDbConnection } = require('./config/db');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Route handlers
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const facultyRoutes = require('./routes/facultyRoutes');
const staffRoutes = require('./routes/staffRoutes');
const syncRoutes = require('./routes/syncRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// -----------------------------------------------------------------------------
// Middlewares
// -----------------------------------------------------------------------------

// CORS configuration (allow local dev frontend ports)
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-sync-admin-key']
}));

// Body parsing
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Safe non-sensitive request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// -----------------------------------------------------------------------------
// System & Health Endpoints
// -----------------------------------------------------------------------------

app.get('/api/health', async (req, res) => {
  const dbStatus = await checkDbConnection();
  const statusCode = dbStatus.connected ? 200 : 200; // 200 OK so monitoring doesn't falsely crash while DB is pending manual init

  res.status(statusCode).json({
    success: true,
    status: 'ONLINE',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    database: {
      connected: dbStatus.connected,
      message: dbStatus.message
    },
    service: 'University ERP Backend API'
  });
});

// -----------------------------------------------------------------------------
// Core API Routes
// -----------------------------------------------------------------------------

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/sync', syncRoutes);

// -----------------------------------------------------------------------------
// Error Handlers
// -----------------------------------------------------------------------------

app.use(notFoundHandler);
app.use(errorHandler);

// -----------------------------------------------------------------------------
// Start Server
// -----------------------------------------------------------------------------

if (require.main === module) {
  const server = app.listen(PORT, async () => {
    console.log('=====================================================');
    console.log(` UNIVERSITY ERP BACKEND STARTED ON PORT ${PORT}`);
    console.log(` Health endpoint: http://localhost:${PORT}/api/health`);
    console.log(` Allowed Frontend Origin: ${FRONTEND_URL}`);
    console.log('=====================================================');

    // Check DB on startup
    const dbStatus = await checkDbConnection();
    if (dbStatus.connected) {
      console.log('[DB STATUS] Connected to database successfully.');
    } else {
      console.log(`[DB STATUS] Notice: ${dbStatus.message}`);
    }
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received. Closing HTTP server gracefully.');
    server.close(() => {
      console.log('HTTP server closed.');
    });
  });
}

module.exports = app;
