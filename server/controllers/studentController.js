const { pool, query } = require('../config/db');

// Postgres-safe weekday ordering (replaces MySQL FIELD())
const DAY_ORDER = (col) => `CASE ${col} WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6 ELSE 7 END`;
// attendance_record keeps the value in two columns (attendance_status + status); read whichever is set
const ATT = (a = 'ar') => `COALESCE(${a}.attendance_status, ${a}.status)`;
const SEM_LABEL = (a = 'sem') => `('Semester ' || ${a}.semester_number || ' (' || ${a}.academic_year || ')')`;
// package is stored both as numeric LPA and as free text depending on the row - prefer the number
const fmtPackage = (lpa, text) => (lpa !== null && lpa !== undefined && lpa !== '' && !isNaN(Number(lpa)) ? `${Number(lpa)} LPA` : (text || null));
const OPEN_DRIVE = ['Scheduled', 'Open', 'Open for Registration'];
// "today" in India, independent of the server timezone
const istDayName = () => new Date(Date.now() + 5.5 * 3600 * 1000).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

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
 * Get Student Profile & Personal Details
 * GET /api/students/profile
 */
async function getProfile(req, res, next) {
  try {
    const studentId = req.user.student_id;
    if (!studentId) {
      return res.status(403).json({ success: false, message: 'Student ID not associated with account.' });
    }

    // NOTE: `course` rows are subjects/electives, not degree programmes, so the programme is derived from the branch.
    const [students] = await query(
      `SELECT s.*, d.department_name, ('B.Tech ' || COALESCE(s.branch, d.branch_code)) AS course_name, sec.section_name
       FROM student s
       JOIN department d ON s.department_id = d.department_id
       LEFT JOIN section sec ON s.section_id = sec.section_id
       WHERE s.student_id = ?`,
      [studentId]
    );

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    const student = students[0];
    const [addresses] = await query('SELECT * FROM student_address WHERE student_id = ?', [studentId]);
    const [contacts] = await query('SELECT * FROM student_contact WHERE student_id = ?', [studentId]);
    const [guardians] = await query('SELECT * FROM guardian_details WHERE student_id = ?', [studentId]);
    const [history] = await query('SELECT * FROM academic_history WHERE student_id = ?', [studentId]);

    return res.json({
      success: true,
      data: {
        ...student,
        addresses: addresses || [],
        contacts: contacts[0] || null,
        guardians: guardians[0] || null,
        academic_history: history || []
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get Subject-wise Attendance & Weekly Timetable
 * GET /api/students/attendance
 */
async function getAttendance(req, res, next) {
  try {
    const studentId = req.user.student_id;
    if (!studentId) {
      return res.status(403).json({ success: false, message: 'Student ID not associated with account.' });
    }

    // Query aggregated subject attendance dynamically from Supabase attendance_record and attendance_session
    const [records] = await query(
      `SELECT sub.subject_id, sub.subject_code, sub.subject_name,
              COALESCE(MAX(f.faculty_name), 'Department Faculty') AS faculty_name,
              COUNT(*) AS total_classes,
              COUNT(*) FILTER (WHERE ${ATT()} IN ('Present', 'Late')) AS classes_attended,
              COUNT(*) FILTER (WHERE ${ATT()} = 'Absent') AS classes_absent,
              COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE ${ATT()} IN ('Present', 'Late')) / NULLIF(COUNT(*), 0), 2), 0) AS attendance_percentage
       FROM attendance_record ar
       JOIN attendance_session ses ON ar.session_id = ses.session_id
       JOIN subject sub ON ses.subject_id = sub.subject_id
       LEFT JOIN faculty f ON ses.faculty_id = f.faculty_id
       WHERE ar.student_id = ?
       GROUP BY sub.subject_id, sub.subject_code, sub.subject_name
       ORDER BY sub.subject_code ASC`,
      [studentId]
    );

    // Query timetable
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

    const formattedAttendance = (records || []).map(r => ({
      subject_id: r.subject_id,
      subject_code: r.subject_code,
      subject_name: r.subject_name,
      faculty_name: r.faculty_name,
      total_classes: Number(r.total_classes || 0),
      classes_attended: Number(r.classes_attended || 0),
      classes_absent: Number(r.classes_absent || 0),
      attendance_percentage: Number(r.attendance_percentage || 0)
    }));

    const formattedTimetable = (timetable || []).map(t => {
      const startFormatted = formatTime12(t.start_time);
      const endFormatted = formatTime12(t.end_time);
      return {
        timetable_id: t.timetable_id,
        section_id: t.section_id,
        section_name: t.section_name,
        subject_id: t.subject_id,
        subject_code: t.subject_code,
        subject_name: t.subject_name,
        faculty_id: t.faculty_id,
        faculty_name: t.faculty_name,
        day_of_week: t.day_of_week,
        start_time: startFormatted,
        end_time: endFormatted,
        time: `${startFormatted} - ${endFormatted}`,
        room_no: t.room_no,
        timetable_type: t.timetable_type || (t.room_no && t.room_no.toLowerCase().includes('lab') ? 'Lab' : 'Lecture')
      };
    });

    return res.json({
      success: true,
      data: {
        subjectAttendance: formattedAttendance,
        timetable: formattedTimetable
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get Student Fee Invoices & Payment Transactions
 * GET /api/students/fees
 */
async function getFees(req, res, next) {
  try {
    const studentId = req.user.student_id;
    if (!studentId) {
      return res.status(403).json({ success: false, message: 'Student ID not associated with account.' });
    }

    const [feeInvoices] = await query(
      `SELECT sf.student_fee_id, sf.invoice_no, sf.amount_due, sf.scholarship_amount, sf.amount_paid, sf.balance_amount,
              sf.due_date, sf.status, fs.fee_type, ${SEM_LABEL('sem')} AS semester_name
       FROM student_fee sf
       JOIN fee_structure fs ON sf.fee_structure_id = fs.fee_structure_id
       LEFT JOIN academic_semester sem ON fs.semester_id = sem.semester_id
       WHERE sf.student_id = ?
       ORDER BY sf.due_date DESC NULLS LAST, sf.student_fee_id DESC`,
      [studentId]
    );

    const [payments] = await query(
      `SELECT p.payment_id, p.amount, p.payment_date, p.payment_mode, p.transaction_reference,
              COALESCE(p.payment_status, p.status) AS status, fs.fee_type
       FROM payment p
       JOIN student_fee sf ON p.student_fee_id = sf.student_fee_id
       JOIN fee_structure fs ON sf.fee_structure_id = fs.fee_structure_id
       WHERE sf.student_id = ?
       ORDER BY p.payment_date DESC, p.payment_id DESC`,
      [studentId]
    );

    return res.json({
      success: true,
      data: {
        bills: (feeInvoices || []).map(f => {
          const gross = Number(f.amount_due || 0);
          const scholarship = Number(f.scholarship_amount || 0);
          const paid = Number(f.amount_paid || 0);
          const net = Math.max(0, gross - scholarship);
          return {
            student_fee_id: f.student_fee_id,
            id: f.invoice_no || `INV-${f.student_fee_id}`,
            semester: f.semester_name,
            category: f.fee_type,
            gross_amount: gross,
            scholarship_amount: scholarship,
            total_amount: net,
            paid_amount: paid,
            due_amount: f.balance_amount !== null && f.balance_amount !== undefined ? Number(f.balance_amount) : Math.max(0, net - paid),
            due_date: f.due_date,
            status: f.status
          };
        }),
        payments: (payments || []).map(p => ({
          payment_id: p.payment_id,
          receipt_no: p.transaction_reference || `REC-PAY-${p.payment_id}`,
          date: p.payment_date,
          amount: Number(p.amount),
          fee_type: p.fee_type,
          mode: p.payment_mode,
          status: p.status
        }))
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Student Self-Service Fee Payment (Partial or Full)
 * POST /api/students/fees/pay
 */
async function payFee(req, res, next) {
  let conn;
  try {
    const studentId = req.user.student_id;
    if (!studentId) {
      return res.status(403).json({ success: false, message: 'Student ID not associated with account.' });
    }

    const { student_fee_id, amount, payment_mode } = req.body;
    const payAmount = Math.round(parseFloat(amount) * 100) / 100;
    if (!student_fee_id || !payAmount || payAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Please provide a valid invoice and a positive payment amount.' });
    }
    const mode = String(payment_mode || 'UPI').slice(0, 50);

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Lock the invoice row so two simultaneous payments cannot both pass the balance check
    const [feeCheck] = await conn.execute(
      `SELECT student_fee_id, amount_due, scholarship_amount, amount_paid, balance_amount
       FROM student_fee WHERE student_fee_id = ? AND student_id = ? FOR UPDATE`,
      [student_fee_id, studentId]
    );
    if (!feeCheck.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Fee invoice record not found.' });
    }

    const f = feeCheck[0];
    const outstanding = f.balance_amount !== null && f.balance_amount !== undefined
      ? Number(f.balance_amount)
      : Math.max(0, Number(f.amount_due) - Number(f.scholarship_amount || 0) - Number(f.amount_paid));
    if (outstanding <= 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'This invoice is already fully paid.' });
    }
    if (payAmount > outstanding) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: `Payment amount ₹${payAmount} exceeds the outstanding balance of ₹${outstanding}.` });
    }

    // Triggers fn_payment_before (validation + receipt number) and fn_payment_after (recalculate invoice) do the rest
    const [payResult] = await conn.execute(
      `INSERT INTO payment (student_fee_id, amount, payment_date, payment_mode, payment_status, status)
       VALUES (?, ?, CURRENT_DATE, ?, 'Success', 'Success')
       RETURNING payment_id, transaction_reference, amount, payment_date, payment_mode, payment_status, status`,
      [student_fee_id, payAmount, mode]
    );

    const [updatedFee] = await conn.execute(
      `SELECT sf.*, fs.fee_type, ${SEM_LABEL('sem')} AS semester_name
       FROM student_fee sf
       JOIN fee_structure fs ON sf.fee_structure_id = fs.fee_structure_id
       LEFT JOIN academic_semester sem ON fs.semester_id = sem.semester_id
       WHERE sf.student_fee_id = ?`,
      [student_fee_id]
    );
    await conn.commit();

    return res.status(201).json({
      success: true,
      message: `Payment of ₹${payAmount.toLocaleString('en-IN')} successfully settled via ${mode}.`,
      data: { payment: payResult[0], fee: updatedFee[0] }
    });
  } catch (error) {
    if (conn) await conn.rollback();
    if (error && error.code === 'P0001') {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  } finally {
    if (conn) conn.release();
  }
}

/**
 * Get Library Borrowed Books, History & Overdue Fines
 * GET /api/students/library
 */
async function getLibrary(req, res, next) {
  try {
    const studentId = req.user.student_id;
    if (!studentId) {
      return res.status(403).json({ success: false, message: 'Student ID not associated with account.' });
    }

    const [issues] = await query(
      `SELECT bi.issue_id, bi.issue_date, bi.due_date, COALESCE(bi.issue_status, bi.status) AS issue_status,
              b.title, b.isbn, a.author_name, bc.accession_no,
              GREATEST(0, CURRENT_DATE - bi.due_date) AS days_overdue,
              (SELECT COALESCE(SUM(f.fine_amount), 0) FROM fine f WHERE f.issue_id = bi.issue_id) AS recorded_fine
       FROM book_issue bi
       JOIN book_copy bc ON bi.copy_id = bc.copy_id
       JOIN book b ON bc.isbn = b.isbn
       LEFT JOIN author a ON b.author_id = a.author_id
       WHERE bi.student_id = ?
       ORDER BY bi.issue_date DESC, bi.issue_id DESC`,
      [studentId]
    );

    const [returns] = await query(
      `SELECT br.return_id, br.return_date, br.condition_on_return, br.days_late,
              b.title, b.isbn,
              (SELECT COALESCE(SUM(f.fine_amount), 0) FROM fine f WHERE f.issue_id = bi.issue_id) AS fine_amount,
              (SELECT COALESCE(SUM(f.fine_amount), 0) FROM fine f
                WHERE f.issue_id = bi.issue_id AND COALESCE(f.payment_status, f.paid_status) = 'Paid') AS fine_paid
       FROM book_return br
       JOIN book_issue bi ON br.issue_id = bi.issue_id
       JOIN book_copy bc ON bi.copy_id = bc.copy_id
       JOIN book b ON bc.isbn = b.isbn
       WHERE bi.student_id = ?
       ORDER BY br.return_date DESC, br.return_id DESC`,
      [studentId]
    );

    const active = (issues || []).filter(i => i.issue_status === 'Issued' || i.issue_status === 'Overdue');
    return res.json({
      success: true,
      data: {
        currentLoans: active.map(i => {
          const daysOver = Number(i.days_overdue || 0);
          return {
            issue_id: `ISS-${i.issue_id}`,
            title: i.title,
            author: i.author_name || 'Unknown author',
            isbn: i.isbn,
            accession_no: i.accession_no,
            issue_date: i.issue_date,
            due_date: i.due_date,
            status: daysOver > 0 ? 'Overdue' : 'Issued',
            // fine already recorded, or the fine accruing right now (Rs 5 per day)
            fine_amount: Math.max(Number(i.recorded_fine || 0), daysOver * 5)
          };
        }),
        returns: (returns || []).map(r => ({
          return_id: `RET-${r.return_id}`,
          title: r.title,
          isbn: r.isbn,
          returned_date: r.return_date,
          condition: r.condition_on_return,
          days_late: Number(r.days_late || 0),
          fine_amount: Number(r.fine_amount || 0),
          fine_paid: Number(r.fine_paid || 0)
        }))
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Library catalogue for students (read-only; the staff endpoint is not open to students)
 * GET /api/students/library/catalog?search=
 */
async function getLibraryCatalog(req, res, next) {
  try {
    const { search } = req.query;
    const params = [];
    let where = '';
    if (search && String(search).trim()) {
      where = 'WHERE (b.title ILIKE ? OR a.author_name ILIKE ? OR b.isbn ILIKE ?)';
      const s = `%${String(search).trim()}%`;
      params.push(s, s, s);
    }
    const [rows] = await query(
      `SELECT b.isbn, b.title, b.edition, b.publication_year, b.language, b.total_copies, b.available_copies,
              COALESCE(to_jsonb(b) ->> 'shelf_location', to_jsonb(b) ->> 'shelf_no') AS shelf_location,
              a.author_name, p.publisher_name, cat.category_name
       FROM book b
       LEFT JOIN author a ON b.author_id = a.author_id
       LEFT JOIN publisher p ON b.publisher_id = p.publisher_id
       LEFT JOIN book_category cat ON b.category_id = cat.category_id
       ${where}
       ORDER BY b.title ASC LIMIT 500`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

/**
 * Exam applications + the timetable of exams that apply to THIS student
 * (own department, current semester) - the old query returned every exam of every branch.
 * GET /api/students/exams
 */
async function getExams(req, res, next) {
  try {
    const studentId = req.user.student_id;
    if (!studentId) {
      return res.status(403).json({ success: false, message: 'Student ID not associated with account.' });
    }

    // exam_application is created by migration 002; tolerate its absence instead of failing the whole page
    let applications = [];
    try {
      [applications] = await query(
        `SELECT * FROM exam_application WHERE student_id = ? ORDER BY submission_date DESC, application_id DESC`,
        [studentId]
      );
    } catch (e) {
      if (e.code !== '42P01') throw e;
    }

    const [schedule] = await query(
      `SELECT es.schedule_id, es.exam_id, es.subject_id, es.exam_date, es.start_time, es.end_time, es.room_no, es.max_marks,
              e.exam_name, e.exam_type, e.status AS exam_status, s.subject_name, s.subject_code
       FROM student st
       JOIN subject s ON s.department_id = st.department_id AND s.semester_number = st.current_semester
       JOIN exam_schedule es ON es.subject_id = s.subject_id
       JOIN exam e ON es.exam_id = e.exam_id
       WHERE st.student_id = ?
       ORDER BY es.exam_date, es.start_time`,
      [studentId]
    );

    return res.json({
      success: true,
      data: {
        applications: (applications || []).map(a => ({
          app_id: a.app_code || `EX-${a.application_id}`,
          type: a.type,
          semester: a.semester_label,
          subject_code: a.subject_code,
          submission_date: a.submission_date,
          fee_status: a.fee_status,
          approval_status: a.approval_status
        })),
        schedule: schedule || []
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Submit an exam / revaluation / ATKT application. It is stored as a pending request - nothing is
 * auto-paid or auto-approved any more; staff/admin decide.
 * POST /api/students/exams/apply
 */
async function applyExam(req, res, next) {
  try {
    const studentId = req.user.student_id;
    if (!studentId) {
      return res.status(403).json({ success: false, message: 'Student ID not associated with account.' });
    }

    const { type, semester, subject_code } = req.body;
    if (!type || !semester) {
      return res.status(400).json({ success: false, message: 'Application type and semester are required.' });
    }
    if ((String(type).startsWith('Paper') || String(type).startsWith('Backlog')) && !subject_code) {
      return res.status(400).json({ success: false, message: 'Please choose the subject for a revaluation / backlog application.' });
    }

    const [dup] = await query(
      `SELECT application_id FROM exam_application
       WHERE student_id = ? AND type = ? AND semester_label = ? AND COALESCE(subject_code, '') = COALESCE(?, '')
         AND approval_status <> 'Rejected'`,
      [studentId, type, semester, subject_code || null]
    );
    if (dup.length) {
      return res.status(409).json({ success: false, message: 'You have already submitted this application.' });
    }

    const appCode = `${String(type).startsWith('Paper') ? 'REV' : 'EX-APP'}-${Date.now().toString().slice(-6)}`;
    const [ins] = await query(
      `INSERT INTO exam_application (app_code, student_id, type, semester_label, subject_code, submission_date, fee_status, approval_status)
       VALUES (?, ?, ?, ?, ?, CURRENT_DATE, 'Pending', 'Submitted')
       RETURNING app_code, type, semester_label, subject_code, submission_date, fee_status, approval_status`,
      [appCode, studentId, type, semester, subject_code || null]
    );
    const a = ins[0];
    return res.status(201).json({
      success: true,
      message: 'Exam application submitted. It will show as approved once the exam section verifies it.',
      data: {
        app_id: a.app_code, type: a.type, semester: a.semester_label, subject_code: a.subject_code,
        submission_date: a.submission_date, fee_status: a.fee_status, approval_status: a.approval_status
      }
    });
  } catch (error) {
    if (error && error.code === '42P01') {
      return res.status(503).json({ success: false, message: 'exam_application table is missing - run db/migrations/002_whole_project_fixes.sql.' });
    }
    next(error);
  }
}

/**
 * Semester results and the subject-wise marks ledger
 * GET /api/students/results
 */
async function getResults(req, res, next) {
  try {
    const studentId = req.user.student_id;
    if (!studentId) {
      return res.status(403).json({ success: false, message: 'Student ID not associated with account.' });
    }

    const [results] = await query(
      `SELECT r.*, e.exam_name, e.semester_id, s.semester_number, 
              COALESCE(e.academic_year, s.academic_year) AS academic_year, 
              ('Semester ' || s.semester_number || ' (' || COALESCE(e.academic_year, s.academic_year) || ')') AS semester_name
       FROM result r
       JOIN exam e ON r.exam_id = e.exam_id
       JOIN academic_semester s ON e.semester_id = s.semester_id
       WHERE r.student_id = ?
       ORDER BY s.semester_number ASC, r.result_id DESC`,
      [studentId]
    );

    const [marks] = await query(
      `WITH enrolled_marks AS (
         SELECT DISTINCT ON (sub.subject_code)
           m.mark_id,
           sse.semester_id,
           sem.semester_number,
           sub.subject_code,
           sub.subject_name,
           sub.credits,
           m.mid_sem,
           m.internal_marks,
           m.end_sem,
           m.marks_obtained,
           COALESCE(es.max_marks, 100) AS max_marks,
           m.grade_letter,
           m.grade_point,
           m.status
         FROM student_subject_enrollment sse
         JOIN subject sub ON sse.subject_id = sub.subject_id
         JOIN academic_semester sem ON sse.semester_id = sem.semester_id
         LEFT JOIN exam_schedule es ON es.subject_id = sub.subject_id
         LEFT JOIN marks m ON m.schedule_id = es.schedule_id AND m.student_id = sse.student_id
         WHERE sse.student_id = ?
         ORDER BY sub.subject_code, m.mark_id DESC NULLS LAST
       ),
       other_marks AS (
         SELECT 
           m.mark_id,
           e.semester_id,
           s.semester_number,
           sub.subject_code,
           sub.subject_name,
           sub.credits,
           m.mid_sem,
           m.internal_marks,
           m.end_sem,
           m.marks_obtained,
           es.max_marks,
           m.grade_letter,
           m.grade_point,
           m.status
         FROM marks m
         JOIN exam_schedule es ON m.schedule_id = es.schedule_id
         JOIN exam e ON es.exam_id = e.exam_id
         JOIN academic_semester s ON e.semester_id = s.semester_id
         JOIN subject sub ON es.subject_id = sub.subject_id
         WHERE m.student_id = ?
           AND sub.subject_code NOT IN (SELECT subject_code FROM enrolled_marks)
       )
       SELECT * FROM enrolled_marks
       UNION ALL
       SELECT * FROM other_marks
       ORDER BY semester_number, subject_code`,
      [studentId, studentId]
    );

    const num = v => (v === null || v === undefined ? null : Number(v));
    return res.json({
      success: true,
      data: {
        results: (results || []).map(r => ({
          result_id: r.result_id,
          semester_id: r.semester_id,
          semester_number: r.semester_number,
          semester_label: r.semester_name,
          academic_year: r.academic_year,
          sgpa: Number(r.sgpa),
          cgpa: Number(r.cgpa),
          overall_status: r.overall_status,
          result_date: r.result_date ? new Date(r.result_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Published'
        })),
        // component marks are shown exactly as faculty entered them (no more invented 20/20/60 split);
        // total / grade / pass-fail are computed by trigger fn_marks_grade
        marks: (marks || []).map(m => ({
          mark_id: m.mark_id,
          semester_id: m.semester_id,
          semester_number: m.semester_number,
          code: m.subject_code,
          name: m.subject_name,
          credits: Number(m.credits || 0),
          mid_sem_marks: num(m.mid_sem),
          internal_marks: num(m.internal_marks),
          endsem_marks: num(m.end_sem),
          total_marks: num(m.marks_obtained),
          max_marks: num(m.max_marks),
          grade_letter: m.grade_letter || null,
          grade_point: num(m.grade_point),
          status: m.status || null
        }))
      }
    });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------- Placement helpers
function branchAllowed(allowed, student) {
  const list = String(allowed || 'All').split(/[,;/]/).map(x => x.trim().toLowerCase()).filter(Boolean);
  if (!list.length || list.includes('all')) return true;
  const mine = [student.branch, student.branch_code, student.department_name].filter(Boolean).map(x => String(x).toLowerCase());
  return list.some(x => mine.includes(x));
}
const fmtDate = d => (d && !isNaN(new Date(d).getTime())) ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : null;

/**
 * Placement drives, the student's applications and announcements
 * GET /api/students/placement
 */
async function getPlacement(req, res, next) {
  try {
    const studentId = req.user.student_id;
    if (!studentId) {
      return res.status(403).json({ success: false, message: 'Student ID not associated with account.' });
    }

    const [stu] = await query(
      `SELECT s.branch, d.branch_code, d.department_name FROM student s JOIN department d ON s.department_id = d.department_id WHERE s.student_id = ?`,
      [studentId]
    );
    const student = stu[0] || {};

    const [cgpaRows] = await query(
      `SELECT cgpa FROM result WHERE student_id = ? ORDER BY result_date DESC NULLS LAST, result_id DESC LIMIT 1`,
      [studentId]
    );
    const studentCgpa = cgpaRows[0]?.cgpa !== undefined && cgpaRows[0]?.cgpa !== null ? Number(cgpaRows[0].cgpa) : null;

    const [drives] = await query(
      `SELECT jd.drive_id, jd.job_role, jd.job_type, jd.drive_date, jd.status, jd.description,
              jd.package_lpa, jd.package AS package_text,
              c.company_name, el.minimum_cgpa, el.allowed_branch, el.backlog_allowed,
              (SELECT COUNT(*) FROM application a WHERE a.drive_id = jd.drive_id AND a.student_id = ?) AS already_applied
       FROM job_drive jd
       JOIN company c ON jd.company_id = c.company_id
       LEFT JOIN eligibility el ON el.eligibility_id = jd.eligibility_id OR el.drive_id = jd.drive_id
       ORDER BY jd.drive_date ASC NULLS LAST`,
      [studentId]
    );

    const [applications] = await query(
      `SELECT app.application_id, app.drive_id, app.application_date, app.status,
              jd.job_role, jd.package_lpa, jd.package AS package_text, c.company_name,
              p.status AS placement_status
       FROM application app
       JOIN job_drive jd ON app.drive_id = jd.drive_id
       JOIN company c ON jd.company_id = c.company_id
       LEFT JOIN placement p ON app.application_id = p.application_id
       WHERE app.student_id = ?
       ORDER BY app.application_date DESC, app.application_id DESC`,
      [studentId]
    );

    // announcements table: title, description, announcement_date, posted_by, target_branch (there is no category/content)
    const [announcements] = await query(
      `SELECT announcement_id, title, description, announcement_date, posted_by, target_branch
       FROM announcement
       WHERE target_branch IS NULL OR LOWER(target_branch) IN ('all', LOWER(?), LOWER(?))
       ORDER BY announcement_date DESC NULLS LAST, announcement_id DESC LIMIT 50`,
      [student.branch || '', student.branch_code || '']
    );

    const dedup = new Map();
    (drives || []).forEach(d => { if (!dedup.has(d.drive_id)) dedup.set(d.drive_id, d); });

    return res.json({
      success: true,
      data: {
        student_cgpa: studentCgpa,
        opportunities: [...dedup.values()].map(d => {
          const minCgpa = d.minimum_cgpa !== null && d.minimum_cgpa !== undefined ? Number(d.minimum_cgpa) : 0;
          const reasons = [];
          if (!branchAllowed(d.allowed_branch, student)) reasons.push(`Open only to ${d.allowed_branch} branch(es).`);
          if (studentCgpa === null) { if (minCgpa > 0) reasons.push('No published CGPA yet.'); }
          else if (studentCgpa < minCgpa) reasons.push(`Your CGPA (${studentCgpa.toFixed(2)}) is below the minimum ${minCgpa.toFixed(1)} required.`);
          const open = OPEN_DRIVE.includes(d.status || 'Scheduled');
          if (!open) reasons.push(`Drive is ${d.status}.`);
          const applied = Number(d.already_applied) > 0;
          return {
            drive_id: d.drive_id,
            company_name: d.company_name,
            job_role: d.job_role,
            package: fmtPackage(d.package_lpa, d.package_text),
            job_type: d.job_type,
            description: d.description,
            min_cgpa: minCgpa,
            allowed_branch: d.allowed_branch || 'All',
            is_eligible: reasons.length === 0,
            ineligible_reason: reasons.length ? reasons.join(' ') : null,
            already_applied: applied,
            can_apply: reasons.length === 0 && !applied,
            drive_date: fmtDate(d.drive_date),
            deadline: fmtDate(d.drive_date),
            status: d.status || 'Scheduled'
          };
        }),
        applications: (applications || []).map(a => ({
          app_id: `APP-${String(a.application_id).padStart(5, '0')}`,
          application_id: a.application_id,
          drive_id: a.drive_id,
          company_name: a.company_name,
          job_role: a.job_role,
          package: fmtPackage(a.package_lpa, a.package_text),
          applied_date: fmtDate(a.application_date) || 'Submitted',
          status: a.placement_status === 'Offered' || a.placement_status === 'Accepted' ? 'Selected' : a.status || 'Applied'
        })),
        announcements: (announcements || []).map(an => ({
          id: an.announcement_id,
          title: an.title,
          content: an.description,
          posted_by: an.posted_by,
          date: fmtDate(an.announcement_date) || 'Recent'
        }))
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Apply for a placement drive. Eligibility is enforced by trigger fn_application_eligibility,
 * whose RAISE EXCEPTION text is passed on to the student.
 * POST /api/students/placement/apply
 */
async function applyJobDrive(req, res, next) {
  try {
    const studentId = req.user.student_id;
    if (!studentId) {
      return res.status(403).json({ success: false, message: 'Student ID not associated with account.' });
    }
    const { drive_id } = req.body;
    if (!drive_id) {
      return res.status(400).json({ success: false, message: 'drive_id is required.' });
    }

    const [existing] = await query(
      `SELECT application_id, status FROM application WHERE student_id = ? AND drive_id = ?`,
      [studentId, drive_id]
    );
    if (existing.length > 0) {
      return res.status(200).json({ success: true, message: 'You have already applied to this drive.', data: existing[0] });
    }

    const [appResult] = await query(
      `INSERT INTO application (student_id, drive_id, application_date, status)
       VALUES (?, ?, CURRENT_DATE, 'Applied')
       RETURNING application_id, application_date, status`,
      [studentId, drive_id]
    );
    return res.status(201).json({ success: true, message: 'Application submitted.', data: appResult[0] });
  } catch (error) {
    if (error && (error.code === 'P0001' || error.code === '23503' || error.code === '23505')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
}

/**
 * Student dashboard - every figure comes from the database; a student with no data sees zeros / nulls,
 * not invented defaults (previously 85% attendance, SGPA 7.5, semester 5).
 * GET /api/students/dashboard
 */
async function getDashboard(req, res, next) {
  try {
    const studentId = req.user.student_id;
    if (!studentId) {
      return res.status(403).json({ success: false, message: 'Student ID not associated with account.' });
    }

    const [[stu], [results], [attStats], [subjectAttendance], [feeStats], [loans], [applications]] = await Promise.all([
      query(`SELECT current_semester, current_year, section_id FROM student WHERE student_id = ?`, [studentId]),
      query(
        `SELECT r.sgpa, r.cgpa, s.semester_number, ${SEM_LABEL('s')} AS semester_name
         FROM result r JOIN exam e ON r.exam_id = e.exam_id JOIN academic_semester s ON e.semester_id = s.semester_id
         WHERE r.student_id = ? ORDER BY s.semester_number DESC, r.result_id DESC LIMIT 1`, [studentId]),
      query(
        `SELECT COUNT(*) AS total_classes,
                COUNT(*) FILTER (WHERE ${ATT('ar')} IN ('Present', 'Late')) AS attended_classes,
                COUNT(*) FILTER (WHERE ${ATT('ar')} = 'Absent') AS missed_classes
         FROM attendance_record ar WHERE ar.student_id = ?`, [studentId]),
      query(
        `SELECT sub.subject_code, sub.subject_name, COUNT(*) AS total,
                COUNT(*) FILTER (WHERE ${ATT('ar')} IN ('Present', 'Late')) AS attended,
                COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE ${ATT('ar')} IN ('Present', 'Late')) / NULLIF(COUNT(*), 0), 1), 0) AS pct
         FROM attendance_record ar
         JOIN attendance_session ses ON ar.session_id = ses.session_id
         JOIN subject sub ON ses.subject_id = sub.subject_id
         WHERE ar.student_id = ?
         GROUP BY sub.subject_id, sub.subject_code, sub.subject_name ORDER BY sub.subject_code`, [studentId]),
      query(
        `SELECT COALESCE(SUM(amount_due - COALESCE(scholarship_amount, 0)), 0) AS total_due,
                COALESCE(SUM(amount_paid), 0) AS total_paid,
                COALESCE(SUM(COALESCE(balance_amount, amount_due - COALESCE(scholarship_amount, 0) - amount_paid)), 0) AS balance
         FROM student_fee WHERE student_id = ?`, [studentId]),
      query(
        `SELECT bi.issue_id, bi.due_date, b.title, b.isbn
         FROM book_issue bi JOIN book_copy bc ON bi.copy_id = bc.copy_id JOIN book b ON bc.isbn = b.isbn
         WHERE bi.student_id = ? AND COALESCE(bi.issue_status, bi.status) IN ('Issued', 'Overdue')
         ORDER BY bi.due_date ASC LIMIT 1`, [studentId]),
      query(
        `SELECT app.application_id, app.status, jd.job_role, jd.package_lpa, jd.package AS package_text, c.company_name
         FROM application app JOIN job_drive jd ON app.drive_id = jd.drive_id JOIN company c ON jd.company_id = c.company_id
         WHERE app.student_id = ? ORDER BY app.application_date DESC, app.application_id DESC LIMIT 1`, [studentId])
    ]);

    let pendingApps = 0;
    try {
      const [examApps] = await query(
        `SELECT COUNT(*) AS pending FROM exam_application WHERE student_id = ? AND approval_status IN ('Submitted', 'Under Verification')`,
        [studentId]
      );
      pendingApps = Number(examApps[0]?.pending || 0);
    } catch (e) { if (e.code !== '42P01') throw e; }

    const [weekly] = await query(
      `SELECT date_trunc('week', ses.session_date)::date AS week_start,
              COUNT(*) AS total,
              COUNT(*) FILTER (WHERE ${ATT('ar')} IN ('Present', 'Late')) AS attended
       FROM attendance_record ar JOIN attendance_session ses ON ar.session_id = ses.session_id
       WHERE ar.student_id = ? AND ses.session_date >= CURRENT_DATE - 49
       GROUP BY 1 ORDER BY 1`,
      [studentId]
    );

    const today = istDayName();
    // weekends have no classes: show the coming Monday so the card is not empty
    const queryDay = (today === 'Saturday' || today === 'Sunday') ? 'Monday' : today;
    const [classes] = await query(
      `SELECT t.start_time, t.end_time, t.room_no, t.day_of_week, s.subject_name, s.subject_code, f.faculty_name
       FROM timetable t
       JOIN subject s ON t.subject_id = s.subject_id
       JOIN faculty f ON t.faculty_id = f.faculty_id
       JOIN student st ON st.section_id = t.section_id
       WHERE st.student_id = ? AND t.day_of_week = ?
       ORDER BY t.start_time ASC`,
      [studentId, queryDay]
    );

    const total = Number(attStats[0]?.total_classes || 0);
    const attended = Number(attStats[0]?.attended_classes || 0);
    const missed = Number(attStats[0]?.missed_classes || 0);
    const pct = total > 0 ? Number(((attended / total) * 100).toFixed(1)) : 0;
    const r = results[0];
    const fee = feeStats[0] || {};

    return res.json({
      success: true,
      data: {
        sgpa: r ? Number(r.sgpa) : null,
        cgpa: r ? Number(r.cgpa) : null,
        semester: stu[0]?.current_semester ?? r?.semester_number ?? null,
        semester_label: stu[0]?.current_semester ? `Semester ${stu[0].current_semester}` : (r?.semester_name || null),
        overallAttendance: {
          percentage: pct, totalClasses: total, attendedClasses: attended, missedClasses: missed,
          hasData: total > 0, isMeetingRequirement: total === 0 ? true : pct >= 75
        },
        subjectAttendance: (subjectAttendance || []).map(s => ({
          code: s.subject_code, name: s.subject_name, total: Number(s.total), attended: Number(s.attended), percentage: Number(s.pct || 0)
        })),
        fees: { due: Number(fee.total_due || 0), paid: Number(fee.total_paid || 0), balance: Math.max(0, Number(fee.balance || 0)) },
        library: loans[0] ? { title: loans[0].title, isbn: loans[0].isbn, due_date: loans[0].due_date } : null,
        placement: applications[0] ? {
          company: applications[0].company_name, role: applications[0].job_role,
          package: fmtPackage(applications[0].package_lpa, applications[0].package_text),
          status: applications[0].status || 'Applied'
        } : null,
        pendingApplications: pendingApps,
        weeklyAttendance: (weekly || []).map(w => {
          const start = new Date(w.week_start);
          const end = new Date(start.getTime() + 5 * 86400000);
          const f = d => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
          const total = Number(w.total), attended = Number(w.attended);
          return { week: f(start), dateRange: `${f(start)} - ${f(end)}`, attended, total, percentage: total ? Number(((attended / total) * 100).toFixed(1)) : 0 };
        }),
        classes_day: queryDay,
        classes: (classes || []).map(c => ({
          time: `${formatTime12(c.start_time)} - ${formatTime12(c.end_time)}`,
          subject: `${c.subject_name} (${c.subject_code})`,
          faculty: c.faculty_name,
          room: c.room_no,
          day: c.day_of_week,
          type: c.room_no && String(c.room_no).toLowerCase().includes('lab') ? 'Lab' : 'Lecture'
        }))
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getProfile,
  getDashboard,
  getAttendance,
  getFees,
  payFee,
  getLibrary,
  getLibraryCatalog,
  getExams,
  applyExam,
  getResults,
  getPlacement,
  applyJobDrive
};
