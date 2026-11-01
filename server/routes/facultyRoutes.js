const express = require('express');
const router = express.Router();
const facultyController = require('../controllers/facultyController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Restrict all faculty routes to authenticated users with FACULTY or ADMIN role
router.use(authenticateToken);
router.use(requireRole('FACULTY', 'ADMIN'));

// Faculty Profile
router.get('/profile', facultyController.getProfile);

// Faculty Dashboard Summary & Schedule
router.get('/dashboard', facultyController.getDashboard);

// Handled Students Roster
router.get('/students', facultyController.getFacultyStudents);

// Class Attendance Marking
router.get('/attendance', facultyController.getAttendanceRoster);
router.post('/attendance', facultyController.saveAttendance);

// Timetable Management (ACID writes, scheduling conflict detection)
router.get('/timetable', facultyController.getTimetable);
router.post('/timetable', facultyController.createTimetableEntry);
router.put('/timetable/:id', facultyController.updateTimetableEntry);
router.delete('/timetable/:id', facultyController.deleteTimetableEntry);

// Faculty Preview Mode: Student Academic View
router.get('/preview-student/:studentId', facultyController.getStudentPreview);

// Academic Grading & Marks Entry
router.get('/grading', facultyController.getGradingRoster);
router.post('/grading', facultyController.saveGrading);

// Leave Applications & History
router.get('/colleagues', facultyController.getColleagues);
router.get('/leave', facultyController.getLeave);
router.post('/leave', facultyController.applyLeave);
router.put('/leave/:code/cancel', facultyController.cancelLeave);
// Approver (ADMIN) endpoints
router.get('/leave/pending', requireRole('ADMIN'), facultyController.listPendingLeaves);
router.put('/leave/:code/decision', requireRole('ADMIN'), facultyController.decideLeave);

// Faculty Payroll & Monthly Payslips
router.get('/payroll', facultyController.getPayroll);

module.exports = router;
