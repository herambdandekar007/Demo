const { pool, query } = require('../config/db');

// Postgres-safe weekday ordering (replaces MySQL FIELD())
const DAY_ORDER = (col) => `CASE ${col} WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6 ELSE 7 END`;
const ATT = (a = 'rec') => `COALESCE(${a}.attendance_status, ${a}.status)`;
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v).getTime());
const isTime = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(v);

function formatTime12(tStr) {
  if (!tStr) return '';
  const parts = String(tStr).split(':');
  const h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  if (isNaN(h)) return String(tStr);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${m} ${period}`;
}

/**
 * Get Faculty Profile
 * GET /api/faculty/profile
 */
async function getProfile(req, res, next) {
  try {
    const facultyId = req.user.faculty_id;
    if (!facultyId) {
      return res.status(403).json({ success: false, message: 'Faculty ID not associated with account.' });
    }

    const [faculties] = await query(
      `SELECT f.*, d.department_name, des.designation_name
       FROM faculty f
       JOIN department d ON f.department_id = d.department_id
       JOIN designation des ON f.designation_id = des.designation_id
       WHERE f.faculty_id = ?
       LIMIT 1`,
      [facultyId]
    );

    if (faculties.length === 0) {
      return res.status(404).json({ success: false, message: 'Faculty record not found.' });
    }

    res.json({
      success: true,
      data: faculties[0]
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get Faculty Dashboard Overview
 * GET /api/faculty/dashboard
 */
async function getDashboard(req, res, next) {
  try {
    const facultyId = req.user.faculty_id;
    if (!facultyId) {
      return res.status(403).json({ success: false, message: 'Faculty ID not associated with account.' });
    }

    const [timetable] = await query(
      `SELECT t.*, s.subject_name, s.subject_code, sec.section_name
       FROM timetable t
       JOIN subject s ON t.subject_id = s.subject_id
       JOIN section sec ON t.section_id = sec.section_id
       WHERE t.faculty_id = ?
       ORDER BY ${DAY_ORDER('t.day_of_week')}, t.start_time ASC`,
      [facultyId]
    );

    const [recentAttendance] = await query(
      `SELECT ses.session_id, ses.session_date, s.subject_code, s.subject_name, sec.section_name,
              COUNT(rec.session_id) AS total_students,
              COUNT(rec.session_id) FILTER (WHERE ${ATT()} IN ('Present', 'Late')) AS present_count
       FROM attendance_session ses
       JOIN subject s ON ses.subject_id = s.subject_id
       JOIN section sec ON ses.section_id = sec.section_id
       LEFT JOIN attendance_record rec ON ses.session_id = rec.session_id
       WHERE ses.faculty_id = ?
       GROUP BY ses.session_id, ses.session_date, s.subject_code, s.subject_name, sec.section_name
       ORDER BY ses.session_date DESC
       LIMIT 5`,
      [facultyId]
    );

    res.json({
      success: true,
      data: {
        todayLectures: (timetable || []).map(t => {
          const s12 = formatTime12(t.start_time);
          const e12 = formatTime12(t.end_time);
          return {
            time: `${s12} - ${e12}`,
            subject: `${t.subject_name} (${t.subject_code})`,
            classSection: t.section_name,
            room: t.room_no,
            day: t.day_of_week,
            type: t.timetable_type || (t.room_no && t.room_no.toLowerCase().includes('lab') ? 'Lab' : 'Lecture'),
            status: "Scheduled"
          };
        }),
        recentAttendance: recentAttendance || []
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get Roster for Attendance Marking & Past Logs
 * GET /api/faculty/attendance
 */
async function getAttendanceRoster(req, res, next) {
  try {
    const facultyId = req.user.faculty_id;
    if (!facultyId) {
      return res.status(403).json({ success: false, message: 'Faculty ID not associated with account.' });
    }

    // Get faculty department
    const [fac] = await query('SELECT department_id FROM faculty WHERE faculty_id = ?', [facultyId]);
    const deptId = fac[0]?.department_id || 1;

    // Check if a specific section was requested
    const requestedSectionId = req.query.section_id ? parseInt(req.query.section_id, 10) : null;

    // Get faculty's assigned sections (from timetable or department cohort)
    let [assignedSections] = await query(
      `SELECT DISTINCT sec.section_id, sec.section_name
       FROM timetable t
       JOIN section sec ON t.section_id = sec.section_id
       WHERE t.faculty_id = ?
       ORDER BY sec.section_id ASC`,
      [facultyId]
    );

    if (!assignedSections || assignedSections.length === 0) {
      const [deptSections] = await query(
        `SELECT sec.section_id, sec.section_name
         FROM section sec
         JOIN faculty f ON sec.department_id = f.department_id
         WHERE f.faculty_id = ?
         ORDER BY sec.section_id ASC`,
        [facultyId]
      );
      assignedSections = deptSections || [];
    }

    // Get faculty's eligible assigned subjects (from timetable and faculty_subject_assignment)
    let [assignedSubjects] = await query(
      `SELECT DISTINCT s.subject_id, s.subject_code, s.subject_name
       FROM (
         SELECT subject_id FROM timetable WHERE faculty_id = ?
         UNION
         SELECT subject_id FROM faculty_subject_assignment WHERE faculty_id = ?
       ) assigned
       JOIN subject s ON assigned.subject_id = s.subject_id
       ORDER BY s.subject_code ASC`,
      [facultyId, facultyId]
    );

    if (!assignedSubjects || assignedSubjects.length === 0) {
      const [deptSubjects] = await query(
        `SELECT s.subject_id, s.subject_code, s.subject_name
         FROM subject s
         JOIN faculty f ON s.department_id = f.department_id
         WHERE f.faculty_id = ?
         ORDER BY s.subject_code ASC`,
        [facultyId]
      );
      assignedSubjects = deptSubjects || [];
    }

    const activeSectionId = requestedSectionId || assignedSections[0]?.section_id || 1;

    // Find students for active section
    const [students] = await query(
      `SELECT s.student_id, s.roll_no, s.student_name AS name, 'Present' as status
       FROM student s
       WHERE s.section_id = ?
       ORDER BY s.roll_no ASC`,
      [activeSectionId]
    );

    const [sessions] = await query(
      `SELECT ses.session_id AS id, ses.session_date AS date, sec.section_name AS division,
              CONCAT(sub.subject_code, ' - ', sub.subject_name) AS subject,
              ses.period,
              COUNT(rec.session_id) AS total_students,
              COUNT(rec.session_id) FILTER (WHERE ${ATT()} IN ('Present', 'Late')) AS present_count,
              COUNT(rec.session_id) FILTER (WHERE ${ATT()} = 'Absent') AS absent_count,
              ses.created_at AS saved_at,
              ses.is_locked,
              CASE 
                WHEN ses.is_locked = TRUE THEN FALSE
                WHEN ses.session_date < (CURRENT_DATE - INTERVAL '7 days') THEN FALSE
                ELSE TRUE 
              END AS can_edit
       FROM attendance_session ses
       JOIN subject sub ON ses.subject_id = sub.subject_id
       JOIN section sec ON ses.section_id = sec.section_id
       LEFT JOIN attendance_record rec ON ses.session_id = rec.session_id
       WHERE ses.faculty_id = ?
       GROUP BY ses.session_id, ses.session_date, sec.section_name, sub.subject_code, sub.subject_name, ses.period, ses.created_at, ses.is_locked
       ORDER BY ses.session_date DESC
       LIMIT 50`,
      [facultyId]
    );

    // Full timetable for this faculty
    const [facultyTimetable] = await query(
      `SELECT t.*, s.subject_name, s.subject_code, sec.section_name
       FROM timetable t
       JOIN subject s ON t.subject_id = s.subject_id
       JOIN section sec ON t.section_id = sec.section_id
       WHERE t.faculty_id = ?
       ORDER BY ${DAY_ORDER('t.day_of_week')}, t.start_time ASC`,
      [facultyId]
    );

    res.json({
      success: true,
      data: {
        roster: students || [],
        savedLogs: sessions || [],
        sections: assignedSections.length > 0 ? assignedSections : [{ section_id: 1, section_name: 'Section 1' }],
        subjects: assignedSubjects || [],
        timetable: (facultyTimetable || []).map(t => {
          const s12 = formatTime12(t.start_time);
          const e12 = formatTime12(t.end_time);
          return {
            time: `${s12} - ${e12}`,
            subject: `${t.subject_name} (${t.subject_code})`,
            classSection: t.section_name,
            room: t.room_no,
            day: t.day_of_week,
            type: t.timetable_type || (t.room_no && t.room_no.toLowerCase().includes('lab') ? 'Lab' : 'Lecture'),
            status: "Scheduled"
          };
        })
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Save Attendance Session & Records with Transaction
 * POST /api/faculty/attendance
 * Idempotent: Repeated submissions for the same section/subject/date/period update existing records.
 */
async function saveAttendance(req, res, next) {
  let conn;
  try {
    const facultyId = req.user.faculty_id;
    if (!facultyId) {
      return res.status(403).json({ success: false, message: 'Faculty ID not associated with account.' });
    }

    const { date, subject_id, section_id, period, topic, records, lock_attendance } = req.body;
    if (!records || !Array.isArray(records)) {
      return res.status(400).json({
        success: false,
        message: 'Student attendance records array is required.'
      });
    }

    const sessionDate = date || new Date().toISOString().split('T')[0];
    const sessionPeriod = period || 'Period 1';
    if (!subject_id || !section_id) {
      return res.status(400).json({ success: false, message: 'subject_id and section_id are required.' });
    }
    const subId = subject_id;
    const secId = section_id;

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Check if session exists for this subject, section, date, and period (concurrency lock)
    const [existingSessions] = await conn.execute(
      `SELECT session_id, session_date, is_locked, created_at FROM attendance_session
       WHERE subject_id = ? AND section_id = ? AND session_date = ? AND period = ?
       LIMIT 1 FOR UPDATE`,
      [subId, secId, sessionDate, sessionPeriod]
    );

    let sessionId;
    let isUpdate = false;

    if (existingSessions.length > 0) {
      const sess = existingSessions[0];
      const sessDate = new Date(sess.session_date);
      const isPastOneWeek = sessDate < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      if (sess.is_locked || isPastOneWeek) {
        await conn.rollback();
        conn.release();
        return res.status(403).json({
          success: false,
          message: 'Attendance for this session is locked. Records older than 7 days or locked by faculty cannot be altered.'
        });
      }

      sessionId = sess.session_id;
      isUpdate = true;
      await conn.execute(
        `UPDATE attendance_session 
         SET faculty_id = ?, topic_covered = ?, is_locked = COALESCE(?, is_locked) 
         WHERE session_id = ?`,
        [facultyId, topic || 'Curriculum Lecture Session', lock_attendance ? true : false, sessionId]
      );
    } else {
      const [sessResult] = await conn.execute(
        `INSERT INTO attendance_session (subject_id, faculty_id, section_id, session_date, period, topic_covered, is_locked)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING session_id`,
        [subId, facultyId, secId, sessionDate, sessionPeriod, topic || 'Curriculum Lecture Session', lock_attendance ? true : false]
      );
      sessionId = sessResult[0]?.session_id || sessResult.insertId;
    }

    // Atomic multi-row upsert into attendance_record
    for (const rec of records) {
      const attStatus = ['Present', 'Absent', 'Late'].includes(rec.status) ? rec.status : 'Present';
      // identify the row by (session, student) - attendance_record has both attendance_id and record_id, so neither is relied on
      const [upd] = await conn.execute(
        `UPDATE attendance_record SET attendance_status = ?, status = ?, marked_at = NOW()
         WHERE session_id = ? AND student_id = ? RETURNING session_id`,
        [attStatus, attStatus, sessionId, rec.student_id]
      );
      if (!upd.length) {
        await conn.execute(
          `INSERT INTO attendance_record (session_id, student_id, attendance_status, status, marked_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [sessionId, rec.student_id, attStatus, attStatus]
        );
      }
    }

    await conn.commit();

    return res.status(201).json({
      success: true,
      message: isUpdate 
        ? `Attendance records updated successfully for ${records.length} students (Session #${sessionId}).`
        : `Attendance session successfully logged for ${records.length} students (Session #${sessionId}).`,
      sessionId,
      isUpdate
    });
  } catch (err) {
    if (conn) await conn.rollback();
    // fn_attendance_check raises this when a student is not in the session's section
    if (err && (err.code === 'P0001' || /does not belong to the section/i.test(err.message || ''))) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

/**
 * Grading roster for ONE exam schedule.
 * The roster is the whole cohort of the subject (same department, same semester) LEFT JOINed to any marks
 * already saved - so marks can be entered for the first time. (It used to list only students who already
 * had a marks row, which is why a fresh subject showed "0 candidates".)
 * GET /api/faculty/grading?schedule_id=
 */
async function getGradingRoster(req, res, next) {
  try {
    const facultyId = req.user.faculty_id;
    if (!facultyId) {
      return res.status(403).json({ success: false, message: 'Faculty ID not associated with account.' });
    }

    const mySubjects = `SELECT subject_id FROM faculty_subject_assignment WHERE faculty_id = ?
                        UNION SELECT subject_id FROM timetable WHERE faculty_id = ?`;

    const [schedules] = await query(
      `SELECT es.schedule_id, es.exam_id, e.exam_name, e.exam_type, sub.subject_id, sub.subject_code, sub.subject_name,
              sub.semester_number, es.exam_date
       FROM exam_schedule es
       JOIN exam e ON es.exam_id = e.exam_id
       JOIN subject sub ON es.subject_id = sub.subject_id
       WHERE es.subject_id IN (${mySubjects})
       ORDER BY es.exam_date DESC, es.schedule_id DESC`,
      [facultyId, facultyId]
    );

    // subjects the faculty teaches that have no exam scheduled yet - the UI explains why there is nothing to grade
    const [unscheduled] = await query(
      `SELECT sub.subject_id, sub.subject_code, sub.subject_name
       FROM subject sub
       WHERE sub.subject_id IN (${mySubjects})
         AND NOT EXISTS (SELECT 1 FROM exam_schedule es WHERE es.subject_id = sub.subject_id)
       ORDER BY sub.subject_code`,
      [facultyId, facultyId]
    );

    const requested = req.query.schedule_id ? parseInt(req.query.schedule_id, 10) : null;
    const active = requested ? schedules.find(x => x.schedule_id === requested) : schedules[0];

    if (!active) {
      return res.json({ success: true, data: [], schedules: schedules || [], unscheduledSubjects: unscheduled || [] });
    }

    const [roster] = await query(
      `SELECT s.student_id, s.roll_no, s.student_name AS name, sec.section_name,
              m.mark_id, ? AS schedule_id, m.mid_sem, m.internal_marks, m.end_sem, m.marks_obtained,
              m.grade_letter, m.grade_point, m.status
       FROM student s
       LEFT JOIN section sec ON s.section_id = sec.section_id
       LEFT JOIN marks m ON m.student_id = s.student_id AND m.schedule_id = ?
       WHERE m.mark_id IS NOT NULL
          OR s.student_id IN (SELECT student_id FROM student_subject_enrollment WHERE subject_id = ?)
          OR (s.department_id = (SELECT department_id FROM subject WHERE subject_id = ?)
              AND s.current_semester = (SELECT semester_number FROM subject WHERE subject_id = ?))
       ORDER BY s.roll_no ASC`,
      [active.schedule_id, active.schedule_id, active.subject_id, active.subject_id, active.subject_id]
    );

    res.json({
      success: true,
      data: roster || [],
      schedules,
      unscheduledSubjects: unscheduled || [],
      activeScheduleId: active.schedule_id
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Save Student Marks for ONE exam schedule (20 mid-sem / 20 internal / 60 end-sem = 100).
 * Grade letter / grade point / pass-fail are computed by the DB trigger fn_marks_grade,
 * and results (SGPA/CGPA) by calculate_result via trigger trg_marks_results_sync.
 * POST /api/faculty/grading   body: { schedule_id, marks: [{student_id, mid_sem, internal_marks, end_sem, status?}] }
 */
async function saveGrading(req, res, next) {
  let conn;
  try {
    const facultyId = req.user.faculty_id;
    const { marks, schedule_id } = req.body;
    if (!facultyId) {
      return res.status(403).json({ success: false, message: 'Faculty ID not associated with account.' });
    }
    if (!Array.isArray(marks) || marks.length === 0) {
      return res.status(400).json({ success: false, message: 'Marks array is required.' });
    }
    if (!schedule_id) {
      return res.status(400).json({ success: false, message: 'schedule_id is required (marks must be saved per exam schedule).' });
    }

    // Faculty must teach the subject of this exam schedule
    const [allowed] = await query(
      `SELECT es.schedule_id FROM exam_schedule es
       WHERE es.schedule_id = ? AND es.subject_id IN (
         SELECT subject_id FROM faculty_subject_assignment WHERE faculty_id = ?
         UNION SELECT subject_id FROM timetable WHERE faculty_id = ?)`,
      [schedule_id, facultyId, facultyId]
    );
    if (!allowed.length && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'You are not assigned to the subject of this exam schedule.' });
    }

    // Validate every row before writing anything
    for (const m of marks) {
      const mid = Number(m.mid_sem ?? 0), internal = Number(m.internal_marks ?? 0), end = Number(m.end_sem ?? 0);
      if (!m.student_id || [mid, internal, end].some(v => Number.isNaN(v) || v < 0)) {
        return res.status(400).json({ success: false, message: `Invalid marks for student ${m.student_id}.` });
      }
      if (mid > 20 || internal > 20 || end > 60) {
        return res.status(400).json({ success: false, message: `Student ${m.student_id}: limits are mid-sem 20, internal 20, end-sem 60.` });
      }
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();
    let updated = 0, inserted = 0;
    for (const m of marks) {
      const mid = Number(m.mid_sem ?? 0), internal = Number(m.internal_marks ?? 0), end = Number(m.end_sem ?? 0);
      const total = mid + internal + end;
      const [r] = await conn.execute(
        `UPDATE marks SET mid_sem = ?, internal_marks = ?, end_sem = ?, marks_obtained = ?
         WHERE student_id = ? AND schedule_id = ?`,
        [mid, internal, end, total, m.student_id, schedule_id]
      );
      if (r.rowCount > 0) { updated += r.rowCount; continue; }
      await conn.execute(
        `INSERT INTO marks (schedule_id, student_id, mid_sem, internal_marks, end_sem, marks_obtained, max_marks)
         VALUES (?, ?, ?, ?, ?, ?, 100)`,
        [schedule_id, m.student_id, mid, internal, end, total]
      );
      inserted++;
    }
    await conn.commit();

    return res.json({
      success: true,
      message: `Marks saved for ${updated + inserted} students (${updated} updated, ${inserted} new). Grades and results are recalculated by the database.`
    });
  } catch (error) {
    if (conn) await conn.rollback();
    next(error);
  } finally {
    if (conn) conn.release();
  }
}

/**
 * Get Faculty Leave History
 * GET /api/faculty/leave
 */
async function getLeave(req, res, next) {
  try {
    const facultyId = req.user.faculty_id;
    if (!facultyId) {
      return res.status(403).json({ success: false, message: 'Faculty ID not associated with account.' });
    }

    const [leaves] = await query(
      `SELECT l.leave_id AS id, l.leave_code, l.leave_type, l.start_date, l.end_date,
              l.days_count, l.reason, l.cover_faculty_name AS cover_faculty,
              l.status, l.applied_on, l.approver_comments
       FROM faculty_leave l
       WHERE l.faculty_id = ?
       ORDER BY l.applied_on DESC`,
      [facultyId]
    );

    res.json({
      success: true,
      data: leaves || []
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Apply for Faculty Leave
 * POST /api/faculty/leave
 */
async function applyLeave(req, res, next) {
  try {
    const facultyId = req.user.faculty_id;
    if (!facultyId) {
      return res.status(403).json({ success: false, message: 'Faculty ID not associated with account.' });
    }

    const { leave_type, start_date, end_date, reason, cover_faculty } = req.body;
    if (!leave_type || !isDate(start_date) || !isDate(end_date)) {
      return res.status(400).json({ success: false, message: 'Leave type and valid start/end dates (YYYY-MM-DD) are required.' });
    }
    if (end_date < start_date) {
      return res.status(400).json({ success: false, message: 'End date cannot be before start date.' });
    }
    // days computed on the server, never trusted from the client
    const days = Math.round((new Date(end_date) - new Date(start_date)) / 86400000) + 1;

    // Overlap with an existing active leave
    const [overlap] = await query(
      `SELECT leave_code FROM faculty_leave
       WHERE faculty_id = ? AND status NOT IN ('Cancelled', 'Rejected')
         AND start_date <= ? AND end_date >= ? LIMIT 1`,
      [facultyId, end_date, start_date]
    );
    if (overlap.length) {
      return res.status(409).json({ success: false, message: `These dates overlap with leave ${overlap[0].leave_code}.` });
    }

    // Balance check (only if a balance row exists for this type/year)
    const year = new Date(start_date).getFullYear();
    const [bal] = await query(
      `SELECT allotted, used FROM faculty_leave_balance WHERE faculty_id = ? AND leave_type = ? AND year = ?`,
      [facultyId, leave_type, year]
    );
    if (bal.length && Number(bal[0].used) + days > Number(bal[0].allotted)) {
      return res.status(400).json({
        success: false,
        message: `Insufficient ${leave_type} balance: ${Number(bal[0].allotted) - Number(bal[0].used)} day(s) left, ${days} requested.`
      });
    }

    const [seq] = await query(`SELECT nextval('faculty_leave_code_seq') AS n`);
    const leaveCode = `LV-${year}-${String(seq[0].n).padStart(4, '0')}`;

    const [ins] = await query(
      `INSERT INTO faculty_leave (leave_code, faculty_id, leave_type, start_date, end_date, days_count, reason, cover_faculty_name, status, applied_on)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending Dean Review', CURRENT_DATE) RETURNING leave_id, applied_on`,
      [leaveCode, facultyId, leave_type, start_date, end_date, days, reason || 'Personal Leave', cover_faculty || null]
    );

    res.status(201).json({
      success: true,
      message: 'Leave application submitted for approval.',
      data: {
        id: leaveCode, leave_id: ins[0].leave_id, leave_code: leaveCode, leave_type, start_date, end_date,
        days_count: days, reason, cover_faculty, status: 'Pending Dean Review', applied_on: ins[0].applied_on
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Cancel own pending leave   PUT /api/faculty/leave/:code/cancel
 */
async function cancelLeave(req, res, next) {
  try {
    const facultyId = req.user.faculty_id;
    if (!facultyId) {
      return res.status(403).json({ success: false, message: 'Faculty ID not associated with account.' });
    }
    const [r] = await query(
      `UPDATE faculty_leave SET status = 'Cancelled', approver_comments = 'Revoked by faculty applicant.'
       WHERE leave_code = ? AND faculty_id = ? AND status IN ('Pending Dean Review', 'Request Sent')
       RETURNING leave_code`,
      [req.params.code, facultyId]
    );
    if (!r.length) {
      return res.status(404).json({ success: false, message: 'Pending leave not found (only your own pending leaves can be cancelled).' });
    }
    res.json({ success: true, message: 'Leave cancelled.' });
  } catch (error) {
    next(error);
  }
}

/**
 * ADMIN: list leaves awaiting a decision   GET /api/faculty/leave/pending
 */
async function listPendingLeaves(req, res, next) {
  try {
    const [rows] = await query(
      `SELECT l.leave_code, l.leave_type, l.start_date, l.end_date, l.days_count, l.reason, l.status, l.applied_on,
              f.faculty_id, f.faculty_name
       FROM faculty_leave l JOIN faculty f ON l.faculty_id = f.faculty_id
       WHERE l.status IN ('Pending Dean Review', 'Request Sent')
       ORDER BY l.applied_on ASC`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

/**
 * ADMIN: approve / reject   PUT /api/faculty/leave/:code/decision  { decision: 'Approved'|'Rejected', comments }
 * Approval deducts the leave balance (if tracked).
 */
async function decideLeave(req, res, next) {
  let conn;
  try {
    const { decision, comments } = req.body;
    if (!['Approved', 'Rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: "decision must be 'Approved' or 'Rejected'." });
    }
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [r] = await conn.execute(
      `UPDATE faculty_leave SET status = ?, approver_comments = ?, approved_by = ?, approved_on = CURRENT_DATE
       WHERE leave_code = ? AND status IN ('Pending Dean Review', 'Request Sent')
       RETURNING faculty_id, leave_type, days_count, start_date`,
      [decision, comments || null, req.user.id || null, req.params.code]
    );
    if (!r.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Pending leave not found.' });
    }
    if (decision === 'Approved') {
      await conn.execute(
        `UPDATE faculty_leave_balance SET used = used + ?
         WHERE faculty_id = ? AND leave_type = ? AND year = EXTRACT(YEAR FROM ?::date)::int`,
        [r[0].days_count, r[0].faculty_id, r[0].leave_type, r[0].start_date]
      );
    }
    await conn.commit();
    res.json({ success: true, message: `Leave ${decision.toLowerCase()}.` });
  } catch (error) {
    if (conn) await conn.rollback();
    next(error);
  } finally {
    if (conn) conn.release();
  }
}

/**
 * Get Faculty Payroll & Monthly Payslips
 * GET /api/faculty/payroll
 */
async function getPayroll(req, res, next) {
  try {
    const facultyId = req.user.faculty_id;
    if (!facultyId) {
      return res.status(403).json({ success: false, message: 'Faculty ID not associated with account.' });
    }

    const [payroll] = await query(
      `SELECT * FROM faculty_payroll
       WHERE faculty_id = ?
       ORDER BY payroll_id DESC`,
      [facultyId]
    );

    res.json({
      success: true,
      data: (payroll || []).map(p => {
        const parts = (p.month_year || '').split(' ');
        const month = p.month || parts[0] || 'October';
        const year = p.year || parseInt(parts[1]) || 2026;
        const basic = Number(p.basic_pay || p.basic_salary || 0);
        const hra = Number(p.hra || p.hra_allowance || 0);
        const da = Number(p.da || p.da_allowance || 0);
        const gross = Number(p.gross_salary || (basic + hra + da));
        const deductions = Number(p.deductions || p.total_deductions || 0);
        const net = Number(p.net_salary || (gross - deductions));

        return {
          id: p.payroll_id || p.slip_id,
          slip_id: p.slip_id || `PAY-${p.payroll_id}`,
          month,
          year,
          basic_salary: basic,
          da_allowance: da,
          hra_allowance: hra,
          travel_allowance: Number(p.travel_allowance || 0),
          academic_allowance: Number(p.academic_allowance || 0),
          gross_salary: gross,
          pf_deduction: Number(p.pf_deduction || 0),
          income_tax: Number(p.income_tax || 0),
          professional_tax: Number(p.professional_tax || 0),
          total_deductions: deductions,
          net_salary: net,
          disbursement_date: p.payment_date || p.disbursement_date,
          payment_mode: p.payment_mode || 'NEFT / RTGS Online Transfer',
          status: p.status || 'Paid'
        };
      })
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get Faculty Timetable with conflict resolution metadata
 * GET /api/faculty/timetable
 */
async function getTimetable(req, res, next) {
  try {
    const facultyId = req.user.faculty_id;
    if (!facultyId) {
      return res.status(403).json({ success: false, message: 'Faculty ID required.' });
    }

    const [timetable] = await query(
      `SELECT t.*, s.subject_name, s.subject_code, sec.section_name, d.department_name
       FROM timetable t
       JOIN subject s ON t.subject_id = s.subject_id
       JOIN section sec ON t.section_id = sec.section_id
       JOIN department d ON sec.department_id = d.department_id
       WHERE t.faculty_id = ?
       ORDER BY ${DAY_ORDER('t.day_of_week')}, t.start_time ASC`,
      [facultyId]
    );

    res.json({
      success: true,
      data: (timetable || []).map(t => ({
        ...t,
        start_time_12: formatTime12(t.start_time),
        end_time_12: formatTime12(t.end_time),
        time: `${formatTime12(t.start_time)} - ${formatTime12(t.end_time)}`
      }))
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create Timetable Slot with Scheduling Conflict Detection
 * POST /api/faculty/timetable
 */
async function createTimetableEntry(req, res, next) {
  try {
    const facultyId = req.user.faculty_id;
    if (!facultyId) {
      return res.status(403).json({ success: false, message: 'Faculty ID required.' });
    }

    const { section_id, subject_id, semester_id, day_of_week, start_time, end_time, room_no, timetable_type } = req.body;

    if (!section_id || !subject_id || !day_of_week || !start_time || !end_time || !room_no) {
      return res.status(400).json({
        success: false,
        message: 'section_id, subject_id, day_of_week, start_time, end_time, and room_no are required.'
      });
    }
    if (!isTime(start_time) || !isTime(end_time) || end_time <= start_time) {
      return res.status(400).json({ success: false, message: 'Valid start_time and end_time (HH:MM) are required, and end must be after start.' });
    }

    // 1. Conflict Check: Section schedule overlap
    const [secConflict] = await query(
      `SELECT t.*, s.subject_name FROM timetable t
       JOIN subject s ON t.subject_id = s.subject_id
       WHERE t.section_id = ? AND t.day_of_week = ?
         AND NOT (t.end_time <= ? OR t.start_time >= ?)`,
      [section_id, day_of_week, start_time, end_time]
    );
    if (secConflict.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Scheduling Conflict: Section already has lecture '${secConflict[0].subject_name}' scheduled on ${day_of_week} (${formatTime12(secConflict[0].start_time)} - ${formatTime12(secConflict[0].end_time)}).`
      });
    }

    // 2. Conflict Check: Faculty schedule overlap
    const [facConflict] = await query(
      `SELECT t.*, s.subject_name FROM timetable t
       JOIN subject s ON t.subject_id = s.subject_id
       WHERE t.faculty_id = ? AND t.day_of_week = ?
         AND NOT (t.end_time <= ? OR t.start_time >= ?)`,
      [facultyId, day_of_week, start_time, end_time]
    );
    if (facConflict.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Faculty Scheduling Conflict: You already have lecture '${facConflict[0].subject_name}' assigned on ${day_of_week} (${formatTime12(facConflict[0].start_time)} - ${formatTime12(facConflict[0].end_time)}).`
      });
    }

    // 3. Conflict Check: Venue / Room overlap
    const [roomConflict] = await query(
      `SELECT t.*, s.subject_name, sec.section_name FROM timetable t
       JOIN subject s ON t.subject_id = s.subject_id
       JOIN section sec ON t.section_id = sec.section_id
       WHERE t.room_no = ? AND t.day_of_week = ?
         AND NOT (t.end_time <= ? OR t.start_time >= ?)`,
      [room_no, day_of_week, start_time, end_time]
    );
    if (roomConflict.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Venue Conflict: Room '${room_no}' is already occupied on ${day_of_week} (${formatTime12(roomConflict[0].start_time)} - ${formatTime12(roomConflict[0].end_time)}) by ${roomConflict[0].section_name}.`
      });
    }

    const [result] = await query(
      `INSERT INTO timetable (section_id, subject_id, faculty_id, semester_id, day_of_week, start_time, end_time, room_no, timetable_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING timetable_id`,
      [section_id, subject_id, facultyId, semester_id || 5, day_of_week, start_time, end_time, room_no, timetable_type || 'Lecture']
    );

    res.status(201).json({
      success: true,
      message: 'Timetable entry created.',
      timetable_id: result[0].timetable_id
    });
  } catch (error) {
    if (error && /Timetable clash/i.test(error.message || '')) {
      return res.status(409).json({ success: false, message: error.message });
    }
    next(error);
  }
}

/**
 * Update Timetable Slot
 * PUT /api/faculty/timetable/:id
 */
async function updateTimetableEntry(req, res, next) {
  try {
    const timetableId = parseInt(req.params.id, 10);
    const facultyId = req.user.faculty_id;

    const { section_id, subject_id, semester_id, day_of_week, start_time, end_time, room_no, timetable_type } = req.body;

    // Check conflict excluding this slot
    const [secConflict] = await query(
      `SELECT t.*, s.subject_name FROM timetable t
       JOIN subject s ON t.subject_id = s.subject_id
       WHERE t.section_id = ? AND t.day_of_week = ? AND t.timetable_id != ?
         AND NOT (t.end_time <= ? OR t.start_time >= ?)`,
      [section_id, day_of_week, timetableId, start_time, end_time]
    );
    if (secConflict.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Scheduling Conflict: Section already has lecture '${secConflict[0].subject_name}' scheduled at this time.`
      });
    }

    const [upd] = await query(
      `UPDATE timetable 
       SET section_id = ?, subject_id = ?, semester_id = ?, day_of_week = ?, start_time = ?, end_time = ?, room_no = ?, timetable_type = ?
       WHERE timetable_id = ? AND faculty_id = ?`,
      [section_id, subject_id, semester_id || 5, day_of_week, start_time, end_time, room_no, timetable_type || 'Lecture', timetableId, facultyId]
    );
    if (!upd.rowCount) {
      return res.status(404).json({ success: false, message: 'Timetable entry not found (or not yours).' });
    }

    res.json({
      success: true,
      message: 'Timetable entry updated.'
    });
  } catch (error) {
    if (error && /Timetable clash/i.test(error.message || '')) {
      return res.status(409).json({ success: false, message: error.message });
    }
    next(error);
  }
}

/**
 * Delete Timetable Slot
 * DELETE /api/faculty/timetable/:id
 */
async function deleteTimetableEntry(req, res, next) {
  try {
    const timetableId = parseInt(req.params.id, 10);
    const facultyId = req.user.faculty_id;

    const [del] = await query(
      `DELETE FROM timetable WHERE timetable_id = ? AND faculty_id = ?`,
      [timetableId, facultyId]
    );
    if (!del.rowCount) {
      return res.status(404).json({ success: false, message: 'Timetable entry not found (or not yours).' });
    }

    res.json({
      success: true,
      message: 'Timetable entry deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Faculty Preview Mode: View Student Interface & Academic Record (Read-Only)
 * GET /api/faculty/preview-student/:studentId
 */
async function getStudentPreview(req, res, next) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const facultyId = req.user.faculty_id;
    if (!facultyId) {
      return res.status(403).json({ success: false, message: 'Faculty access required.' });
    }

    const [students] = await query(
      `SELECT s.student_id, s.roll_no, s.prn, s.student_name, s.email, s.current_year, s.current_semester, s.branch,
              d.department_name, sec.section_name, ('B.Tech ' || COALESCE(s.branch, d.branch_code)) AS course_name
       FROM student s
       JOIN department d ON s.department_id = d.department_id
       LEFT JOIN section sec ON s.section_id = sec.section_id
       WHERE s.student_id = ?
       LIMIT 1`,
      [studentId]
    );

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    const student = students[0];

    // Live attendance summary using view
    const [attendance] = await query(
      `SELECT sub.subject_code, sub.subject_name,
              COUNT(*) AS total_sessions,
              COUNT(*) FILTER (WHERE ${ATT('ar')} IN ('Present', 'Late')) AS attended_sessions,
              COUNT(*) FILTER (WHERE ${ATT('ar')} = 'Absent') AS absent_sessions,
              COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE ${ATT('ar')} IN ('Present', 'Late')) / NULLIF(COUNT(*), 0), 2), 0) AS attendance_pct
       FROM attendance_record ar
       JOIN attendance_session ses ON ar.session_id = ses.session_id
       JOIN subject sub ON ses.subject_id = sub.subject_id
       WHERE ar.student_id = ?
       GROUP BY sub.subject_id, sub.subject_code, sub.subject_name
       ORDER BY sub.subject_code`,
      [studentId]
    );

    // Timetable
    const [timetable] = await query(
      `SELECT t.*, s.subject_name, s.subject_code, f.faculty_name, sec.section_name
       FROM timetable t
       JOIN subject s ON t.subject_id = s.subject_id
       JOIN faculty f ON t.faculty_id = f.faculty_id
       JOIN section sec ON t.section_id = sec.section_id
       JOIN student st ON st.section_id = t.section_id
       WHERE st.student_id = ?
       ORDER BY ${DAY_ORDER('t.day_of_week')}, t.start_time`,
      [studentId]
    );

    // Fee summary using view
    const [feeSummary] = await query(
      `SELECT COALESCE(SUM(amount_due), 0) AS total_invoiced,
              COALESCE(SUM(amount_paid), 0) AS total_paid,
              COALESCE(SUM(COALESCE(balance_amount, amount_due - COALESCE(scholarship_amount, 0) - amount_paid)), 0) AS outstanding_balance
       FROM student_fee WHERE student_id = ?`,
      [studentId]
    );

    res.json({
      success: true,
      previewMode: true,
      notice: 'Read-only preview of this student record.',
      student,
      attendance: attendance || [],
      timetable: (timetable || []).map(t => ({
        ...t,
        start_time_12: formatTime12(t.start_time),
        end_time_12: formatTime12(t.end_time),
        time: `${formatTime12(t.start_time)} - ${formatTime12(t.end_time)}`
      })),
      feeSummary: feeSummary[0] || null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Colleagues of the logged-in faculty (same department) - used for the leave "cover" dropdown
 * GET /api/faculty/colleagues
 */
async function getColleagues(req, res, next) {
  try {
    const facultyId = req.user.faculty_id;
    if (!facultyId) {
      return res.status(403).json({ success: false, message: 'Faculty access required.' });
    }
    const [rows] = await query(
      `SELECT f.faculty_id, f.faculty_name, des.designation_name
       FROM faculty f
       LEFT JOIN designation des ON f.designation_id = des.designation_id
       WHERE f.department_id = (SELECT department_id FROM faculty WHERE faculty_id = ?)
         AND f.faculty_id <> ? AND COALESCE(f.status, 'Active') = 'Active'
       ORDER BY f.faculty_name`,
      [facultyId, facultyId]
    );
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
}

module.exports = {
  getColleagues,
  getProfile,
  getDashboard,
  getAttendanceRoster,
  saveAttendance,
  getTimetable,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
  getStudentPreview,
  getGradingRoster,
  saveGrading,
  getLeave,
  applyLeave,
  cancelLeave,
  listPendingLeaves,
  decideLeave,
  getPayroll
};
