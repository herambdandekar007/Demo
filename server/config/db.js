const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envPaths = [
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env')
];
for (const p of envPaths) {
  dotenv.config({ path: p });
}

const defaultSupabaseUrl = 'postgresql://postgres.zkfpncueeexdpqtyrjbz:M8DBMPROJECTTT@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
const rawDbUrl = process.env.DATABASE_URL || defaultSupabaseUrl;

const isPostgres = Boolean(
  rawDbUrl &&
  (rawDbUrl.startsWith('postgres://') || rawDbUrl.startsWith('postgresql://'))
);

let pool;
let isPostgresMode = false;

// pg returns rows only; attach rowCount/affectedRows so UPDATE/DELETE results can be checked
function withMeta(res) {
  const rows = res.rows;
  rows.rowCount = res.rowCount;
  rows.affectedRows = res.rowCount;
  return rows;
}

if (isPostgres) {
  const { Pool } = require('pg');
  isPostgresMode = true;

  // Supabase pooler port 5432 is Session mode (capped at 15 clients across all team members).
  // If pooler port 5432 is specified, route to port 6543 (Supabase Transaction mode pooler / Supavisor),
  // which supports 10,000+ concurrent clients and prevents EMAXCONNSESSION errors.
  let connectionString = rawDbUrl;
  if (connectionString && connectionString.includes('.pooler.supabase.com:5432')) {
    connectionString = connectionString.replace(':5432', ':6543');
  }

  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });
  console.log('[DATABASE] Initialized Supabase PostgreSQL connection pool.');
  pool.getConnection = async () => {
    const client = await pool.connect();
    return {
      execute: async (sql, params = []) => {
        let paramIndex = 1;
        const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
        const res = await client.query(pgSql, params);
        return [withMeta(res), res.fields];
      },
      query: async (sql, params = []) => {
        let paramIndex = 1;
        const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
        const res = await client.query(pgSql, params);
        return [withMeta(res), res.fields];
      },
      beginTransaction: async () => client.query('BEGIN'),
      commit: async () => client.query('COMMIT'),
      rollback: async () => client.query('ROLLBACK'),
      release: () => client.release()
    };
  };
} else {
  const mysql = require('mysql2/promise');
  pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'college_erp',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  });
  console.log('[DATABASE] Initialized MySQL connection pool.');
}

/**
 * Execute a parameterized SQL query safely
 * Supports both PostgreSQL ($1, $2, ...) and MySQL (?) syntax seamlessly.
 * @param {string} sql Parameterized query string
 * @param {Array} params Parameter values
 * @returns {Promise<[Array, Object]>} Returns [rows, fields]
 */
async function query(sql, params = []) {
  if (isPostgresMode) {
    let paramIndex = 1;
    const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    const res = await pool.query(pgSql, params);
    return [withMeta(res), res.fields];
  } else {
    return pool.execute(sql, params);
  }
}

/**
 * Check if the database connection is alive
 * @returns {Promise<{ connected: boolean, message: string }>}
 */
async function checkDbConnection() {
  try {
    if (isPostgresMode) {
      await pool.query('SELECT 1');
      return {
        connected: true,
        message: 'Supabase PostgreSQL connection established successfully.'
      };
    } else {
      const connection = await pool.getConnection();
      await connection.ping();
      connection.release();
      return {
        connected: true,
        message: 'MySQL connection established successfully.'
      };
    }
  } catch (err) {
    return {
      connected: false,
      message: `Database connection unavailable: ${err.message}.`
    };
  }
}

// Cached list of a table's real columns, so code can adapt to the live schema
// (e.g. book.shelf_no vs book.shelf_location) instead of crashing on a missing column.
const _colCache = new Map();
async function tableColumns(table) {
  if (_colCache.has(table)) return _colCache.get(table);
  const [rows] = await query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ?",
    [table]
  );
  const set = new Set(rows.map(r => r.column_name));
  if (set.size) _colCache.set(table, set); // do not cache "table missing"
  return set;
}

module.exports = {
  tableColumns,
  pool,
  query,
  checkDbConnection,
  isPostgresMode
};
