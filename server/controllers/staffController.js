/**
 * Staff Controller
 * Handles TNP Head, Finance Officer, and Librarian operations.
 * Mount: /api/staff/*
 */
const { pool, query, tableColumns } = require('../config/db');

// Pick the first column that really exists in the live table (schema files in the repo disagree with the DB)
function pickCol(cols, ...names) { return names.find(n => cols.has(n)) || null; }
const LOAN_STATUS = "COALESCE(bi.issue_status, bi.status)";
const FINE_STATUS = "COALESCE(f.payment_status, f.paid_status, 'Pending')";

// ─────────────────────────────────────────────
// Helper: ensure correct role for an endpoint
// ─────────────────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || (!roles.includes(req.user.role) && req.user.role !== 'ADMIN')) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}.`
      });
    }
    next();
  };
}

// ─────────────────────────────────────────────
// STAFF PROFILE  GET /api/staff/profile
// ─────────────────────────────────────────────
async function getProfile(req, res, next) {
  try {
    const { staff_id, role, id, identifier } = req.user;
    const lookupId = staff_id || id;
    const [rows] = await query(
      `SELECT s.*, d.department_name, des.designation_name 
       FROM staff s
       LEFT JOIN department d ON s.department_id = d.department_id
       LEFT JOIN designation des ON s.designation_id = des.designation_id
       WHERE s.staff_id = ? LIMIT 1`,
      [lookupId]
    );

    const staffRoleLabels = {
      TNP_HEAD: 'TNP Cell Head',
      FINANCE: 'Finance Officer',
      LIBRARIAN: 'Librarian'
    };
    const staffRoleDepts = {
      TNP_HEAD: 'Training & Placement Cell',
      FINANCE: 'Finance & Accounts',
      LIBRARIAN: 'Central Library'
    };

    if (!rows.length) {
      return res.json({
        success: true,
        data: {
          staff_id: lookupId,
          first_name: identifier,
          last_name: '',
          email: req.user.email,
          role,
          department_name: staffRoleDepts[role] || 'Campus Administration',
          designation_name: staffRoleLabels[role] || 'Staff Member'
        }
      });
    }

    return res.json({
      success: true,
      data: {
        ...rows[0],
        role,
        department_name: staffRoleDepts[role] || rows[0].department_name,
        designation_name: staffRoleLabels[role] || rows[0].designation_name
      }
    });
  } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════
// TNP HEAD ENDPOINTS
// ═══════════════════════════════════════════════════

async function getTNPDashboard(req, res, next) {
  try {
    const [[companiesCount]] = await query('SELECT COUNT(*) AS c FROM company');
    const [[drivesCount]]    = await query("SELECT COUNT(*) AS c FROM job_drive WHERE status IN ('Scheduled', 'Open', 'Open for Registration', 'In Progress')");
    const [[applicationsCount]] = await query('SELECT COUNT(*) AS c FROM application');
    const [[placedCount]]    = await query("SELECT COUNT(*) AS c FROM placement WHERE status IN ('Offer Accepted', 'Accepted', 'Selected')");

    const [recentDrives] = await query(
      `SELECT jd.drive_id, jd.job_role, jd.package, jd.drive_date, jd.status, c.company_name, c.industry_type
       FROM job_drive jd 
       JOIN company c ON jd.company_id = c.company_id
       ORDER BY jd.drive_date DESC LIMIT 5`
    );

    const [recentPlacements] = await query(
      `SELECT p.placement_id, p.job_role, p.package, p.status, p.offer_date,
              s.student_name, s.roll_no, c.company_name
       FROM placement p
       JOIN application a ON p.application_id = a.application_id
       JOIN student s ON a.student_id = s.student_id
       JOIN job_drive jd ON a.drive_id = jd.drive_id
       JOIN company c ON jd.company_id = c.company_id
       ORDER BY p.offer_date DESC NULLS LAST, p.placement_id DESC LIMIT 5`
    );

    res.json({
      success: true,
      data: {
        stats: {
          totalCompanies: parseInt(companiesCount.c, 10),
          activeDrives: parseInt(drivesCount.c, 10),
          totalApplications: parseInt(applicationsCount.c, 10),
          studentsPlaced: parseInt(placedCount.c, 10)
        },
        recentDrives,
        recentPlacements
      }
    });
  } catch (err) { next(err); }
}

async function getCompanies(req, res, next) {
  try {
    const [companies] = await query(
      `SELECT c.*, COUNT(jd.drive_id) AS total_drives,
              SUM(CASE WHEN jd.status IN ('Scheduled', 'Open', 'Open for Registration','In Progress') THEN 1 ELSE 0 END) AS active_drives
       FROM company c
       LEFT JOIN job_drive jd ON c.company_id = jd.company_id
       GROUP BY c.company_id
       ORDER BY c.company_name ASC`
    );
    res.json({ success: true, data: companies });
  } catch (err) { next(err); }
}

async function addCompany(req, res, next) {
  try {
    const { company_name, industry_type, location, website, contact_email, contact_phone } = req.body;
    if (!company_name || !company_name.trim()) {
      return res.status(400).json({ success: false, message: 'Company name is required.' });
    }
    const [result] = await query(
      `INSERT INTO company (company_name, industry_type, location, website, contact_email, contact_phone)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
      [company_name.trim(), industry_type || null, location || null, website || null, contact_email || null, contact_phone || null]
    );
    res.status(201).json({ success: true, message: 'Company added successfully.', data: result[0] });
  } catch (err) { next(err); }
}

async function updateCompany(req, res, next) {
  try {
    const { id } = req.params;
    const { company_name, industry_type, location, website, contact_email, contact_phone } = req.body;
    if (!company_name || !company_name.trim()) {
      return res.status(400).json({ success: false, message: 'Company name is required.' });
    }
    const [upd] = await query(
      `UPDATE company SET company_name = ?, industry_type = ?, location = ?, website = ?, contact_email = ?, contact_phone = ?
       WHERE company_id = ? RETURNING company_id`,
      [company_name.trim(), industry_type || null, location || null, website || null, contact_email || null, contact_phone || null, id]
    );
    if (!upd.length) return res.status(404).json({ success: false, message: 'Company not found.' });
    res.json({ success: true, message: 'Company updated successfully.' });
  } catch (err) { next(err); }
}

async function getDrives(req, res, next) {
  try {
    const [drives] = await query(
      `SELECT jd.drive_id, jd.company_id, jd.job_role, jd.job_type, jd.package, jd.package_lpa,
              jd.drive_date, jd.description, jd.status,
              c.company_name, c.industry_type, c.location,
              e.minimum_cgpa, e.allowed_branch, e.backlog_allowed,
              COUNT(DISTINCT a.application_id) AS total_applications,
              SUM(CASE WHEN pl.status IN ('Accepted', 'Offer Accepted') THEN 1 ELSE 0 END) AS selected_count
       FROM job_drive jd
       JOIN company c ON jd.company_id = c.company_id
       LEFT JOIN eligibility e ON jd.drive_id = e.drive_id
       LEFT JOIN application a ON jd.drive_id = a.drive_id
       LEFT JOIN placement pl ON a.application_id = pl.application_id
       GROUP BY jd.drive_id, c.company_name, c.industry_type, c.location, e.minimum_cgpa, e.allowed_branch, e.backlog_allowed
       ORDER BY jd.drive_date DESC`
    );
    res.json({ success: true, data: drives });
  } catch (err) { next(err); }
}

async function addDrive(req, res, next) {
  let conn;
  try {
    const { 
      company_id, 
      job_role, 
      job_type, 
      package: pkg, 
      package_lpa, 
      drive_date, 
      description, 
      status, 
      minimum_cgpa, 
      allowed_branch, 
      backlog_allowed 
    } = req.body;

    if (!company_id || !job_role) {
      return res.status(400).json({ success: false, message: 'Company and job role are required.' });
    }

    let driveStatus = status || 'Scheduled';
    if (driveStatus === 'Upcoming' || driveStatus === 'Open for Registration' || driveStatus === 'Open') driveStatus = 'Scheduled';

    const minCgpaNum = minimum_cgpa !== undefined && minimum_cgpa !== '' ? Number(minimum_cgpa) : 6.0;
    const branchAllowed = allowed_branch || 'All';
    const numLpa = package_lpa ? Number(package_lpa) : (pkg ? (parseFloat(pkg) || 6.0) : 6.0);
    const pkgText = pkg || `${numLpa.toFixed(2)} LPA`;

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1. Insert into job_drive
    const [driveResult] = await conn.execute(
      `INSERT INTO job_drive (company_id, job_role, job_type, package, package_lpa, drive_date, description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING drive_id`,
      [
        company_id,
        job_role,
        job_type || 'Full-Time',
        pkgText,
        numLpa,
        drive_date || new Date().toISOString().split('T')[0],
        description || `Campus Recruitment for ${job_role}`,
        driveStatus
      ]
    );

    const driveId = driveResult[0]?.drive_id || driveResult.insertId;

    // 2. Insert into eligibility table
    const [eligResult] = await conn.execute(
      `INSERT INTO eligibility (drive_id, allowed_branch, minimum_cgpa, backlog_allowed, other_criteria)
       VALUES (?, ?, ?, ?, ?) RETURNING eligibility_id`,
      [
        driveId,
        branchAllowed,
        minCgpaNum,
        backlog_allowed || 'No',
        `Minimum CGPA: ${minCgpaNum}`
      ]
    );

    const eligId = eligResult[0]?.eligibility_id || eligResult.insertId;

    // 3. Link eligibility_id to job_drive
    await conn.execute(
      `UPDATE job_drive SET eligibility_id = ? WHERE drive_id = ?`,
      [eligId, driveId]
    );

    await conn.commit();

    return res.status(201).json({
      success: true,
      message: 'Job drive posted successfully with eligibility criteria.',
      drive_id: driveId,
      eligibility_id: eligId
    });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

async function updateDriveStatus(req, res, next) {
  try {
    const { id } = req.params;
    let { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required.' });
    }

    // Same vocabulary as addDrive and the student portal ('Scheduled' = open for applications)
    const alias = { Upcoming: 'Scheduled', 'Open for Registration': 'Scheduled', Open: 'Scheduled', Ongoing: 'In Progress', Cancelled: 'Closed' };
    status = alias[status] || status;
    const validStatuses = ['Scheduled', 'In Progress', 'Completed', 'Closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Valid values: ${validStatuses.join(', ')}` });
    }

    const [upd] = await query('UPDATE job_drive SET status = ? WHERE drive_id = ? RETURNING drive_id', [status, id]);
    if (!upd.length) return res.status(404).json({ success: false, message: 'Drive not found.' });
    res.json({ success: true, message: 'Drive status updated successfully.' });
  } catch (err) { next(err); }
}

async function getApplications(req, res, next) {
  try {
    const { drive_id, status } = req.query;
    let sql = `SELECT a.application_id, a.drive_id, a.student_id, a.application_date, a.status AS app_status,
                      s.student_name, s.roll_no, s.branch, s.current_semester,
                      d.department_name, sec.section_name,
                      jd.job_role, c.company_name,
                      pl.status AS placement_status, pl.package AS offered_package
               FROM application a
               JOIN student s ON a.student_id = s.student_id
               JOIN department d ON s.department_id = d.department_id
               LEFT JOIN section sec ON s.section_id = sec.section_id
               JOIN job_drive jd ON a.drive_id = jd.drive_id
               JOIN company c ON jd.company_id = c.company_id
               LEFT JOIN placement pl ON a.application_id = pl.application_id`;
    const params = [];
    const conditions = [];

    if (drive_id) {
      conditions.push('a.drive_id = ?');
      params.push(drive_id);
    }
    if (status) {
      conditions.push('a.status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY a.application_id DESC LIMIT 2000';

    const [rows] = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function shortlistApplication(req, res, next) {
  let conn;
  try {
    const { id } = req.params;
    let { status, package: pkg, job_role, offer_date, joining_date } = req.body;

    if (status === 'Pending') status = 'Applied';
    const validStatuses = ['Applied', 'Shortlisted', 'Interview', 'Technical Round', 'HR Round', 'Selected', 'Offer Accepted', 'Rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Valid values: ${validStatuses.join(', ')}` });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    await conn.execute('UPDATE application SET status = ? WHERE application_id = ?', [status, id]);

    if (status === 'Selected' || status === 'Offer Accepted') {
      const [existing] = await conn.execute('SELECT placement_id FROM placement WHERE application_id = ?', [id]);
      const placementStatus = status === 'Offer Accepted' ? 'Accepted' : 'Offered';
      if (existing.length === 0) {
        await conn.execute(
          `INSERT INTO placement (application_id, student_id, drive_id, job_role, package, package_lpa, offer_date, joining_date, status)
           SELECT a.application_id, a.student_id, a.drive_id, COALESCE(?, jd.job_role, 'Software Engineer'), COALESCE(?, jd.package, '6.00 LPA'),
                  jd.package_lpa, COALESCE(?::date, CURRENT_DATE), ?::date, ?
           FROM application a JOIN job_drive jd ON a.drive_id = jd.drive_id
           WHERE a.application_id = ?`,
          [job_role || null, pkg || null, offer_date || null, joining_date || null, placementStatus, id]
        );
      } else {
        await conn.execute(
          'UPDATE placement SET status = ?, package = COALESCE(?, package), offer_date = COALESCE(?, offer_date) WHERE application_id = ?',
          [placementStatus, pkg || null, offer_date || null, id]
        );
      }
      // trigger fn_placement_after forces application.status = 'Selected'; restore the status the TNP head chose
      await conn.execute('UPDATE application SET status = ? WHERE application_id = ?', [status, id]);
    } else if (status === 'Rejected') {
      await conn.execute("UPDATE placement SET status = 'Rejected' WHERE application_id = ?", [id]);
    }

    await conn.commit();
    res.json({ success: true, message: `Application status updated to ${status}.` });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

async function getPlacements(req, res, next) {
  try {
    const [rows] = await query(
      `SELECT p.*, s.student_name, s.roll_no, s.branch, c.company_name, jd.job_role AS drive_role
       FROM placement p
       JOIN application a ON p.application_id = a.application_id
       JOIN student s ON a.student_id = s.student_id
       JOIN job_drive jd ON a.drive_id = jd.drive_id
       JOIN company c ON jd.company_id = c.company_id
       ORDER BY p.offer_date DESC NULLS LAST, p.placement_id DESC LIMIT 500`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════
// FINANCE OFFICER ENDPOINTS
// ═══════════════════════════════════════════════════

async function getFinanceDashboard(req, res, next) {
  try {
    const [[totalDue]]       = await query("SELECT COALESCE(SUM(balance_amount), 0) AS total FROM student_fee WHERE balance_amount > 0");
    const [[totalCollected]] = await query("SELECT COALESCE(SUM(amount), 0) AS total FROM payment WHERE status IN ('Success', 'Successful') OR payment_status = 'Success'");
    const [[pendingCount]]   = await query("SELECT COUNT(*) AS c FROM student_fee WHERE balance_amount > 0");
    const [[overdueCount]]   = await query("SELECT COUNT(*) AS c FROM student_fee WHERE balance_amount > 0 AND due_date < CURRENT_DATE");

    // Faculty payroll summary
    const [[facultySummary]] = await query(`
      SELECT COALESCE(SUM(net_salary), 0) AS total_payroll,
             COALESCE(SUM(CASE WHEN status IN ('Paid', 'Disbursed', 'Credited') THEN net_salary ELSE 0 END), 0) AS disbursed,
             COALESCE(SUM(CASE WHEN status NOT IN ('Paid', 'Disbursed', 'Credited') THEN net_salary ELSE 0 END), 0) AS pending,
             COUNT(DISTINCT faculty_id) AS faculty_count
      FROM faculty_payroll
    `);

    // Library fines summary
    const [[librarySummary]] = await query(`
      SELECT COALESCE(SUM(fine_amount), 0) AS total_fines,
             COALESCE(SUM(CASE WHEN COALESCE(payment_status, paid_status) = 'Paid' THEN fine_amount ELSE 0 END), 0) AS collected_fines,
             COALESCE(SUM(CASE WHEN COALESCE(payment_status, paid_status, 'Pending') <> 'Paid' THEN fine_amount ELSE 0 END), 0) AS pending_fines,
             COUNT(*) AS total_fine_txns
      FROM fine
    `);

    const [recentPayments] = await query(
      `SELECT p.payment_id, p.amount, p.payment_date, p.payment_mode, COALESCE(p.payment_status, p.status) AS status, p.transaction_reference,
              s.student_name, s.roll_no, sf.invoice_no, fs.fee_type
       FROM payment p
       JOIN student_fee sf ON p.student_fee_id = sf.student_fee_id
       JOIN student s ON sf.student_id = s.student_id
       LEFT JOIN fee_structure fs ON sf.fee_structure_id = fs.fee_structure_id
       ORDER BY p.payment_date DESC, p.payment_id DESC LIMIT 10`
    );

    const [deptBreakdown] = await query(
      `SELECT d.department_name, 
              COALESCE(SUM(sf.amount_due), 0) AS due, 
              COALESCE(SUM(sf.amount_paid), 0) AS paid,
              COALESCE(SUM(sf.balance_amount), 0) AS balance,
              COUNT(sf.student_fee_id) AS fee_records
       FROM department d
       LEFT JOIN student s ON d.department_id = s.department_id
       LEFT JOIN student_fee sf ON s.student_id = sf.student_id
       GROUP BY d.department_id, d.department_name
       ORDER BY due DESC`
    );

    res.json({
      success: true,
      data: {
        stats: {
          totalDue: parseFloat(totalDue.total) || 0,
          totalCollected: parseFloat(totalCollected.total) || 0,
          pendingFees: parseInt(pendingCount.c) || 0,
          overdueCount: parseInt(overdueCount.c) || 0,
          totalFacultyPayroll: parseFloat(facultySummary.total_payroll) || 0,
          disbursedFacultyPayroll: parseFloat(facultySummary.disbursed) || 0,
          pendingFacultyPayroll: parseFloat(facultySummary.pending) || 0,
          facultyCount: parseInt(facultySummary.faculty_count) || 0,
          totalLibraryFines: parseFloat(librarySummary.total_fines) || 0,
          collectedLibraryFines: parseFloat(librarySummary.collected_fines) || 0,
          pendingLibraryFines: parseFloat(librarySummary.pending_fines) || 0,
          totalFineTransactions: parseInt(librarySummary.total_fine_txns) || 0
        },
        recentPayments,
        deptBreakdown
      }
    });
  } catch (err) { next(err); }
}

async function getStudentsWithFees(req, res, next) {
  try {
    const { dept, search, status } = req.query;
    let sql = `SELECT s.student_id, s.student_name, s.roll_no, s.branch, s.email, d.department_name,
                      COALESCE(SUM(sf.amount_due), 0) AS total_due, 
                      COALESCE(SUM(sf.amount_paid), 0) AS total_paid,
                      COALESCE(SUM(sf.balance_amount), 0) AS balance,
                      MAX(sf.due_date) AS latest_due_date,
                      CASE
                        WHEN COUNT(sf.student_fee_id) > 0 AND COALESCE(SUM(sf.balance_amount), 0) <= 0 THEN 'Paid'
                        WHEN COALESCE(SUM(sf.amount_paid), 0) > 0 THEN 'Partially Paid'
                        ELSE 'Unpaid'
                      END AS overall_status
               FROM student s
               JOIN department d ON s.department_id = d.department_id
               LEFT JOIN student_fee sf ON s.student_id = sf.student_id`;
    const params = [];
    const conditions = [];

    if (dept) {
      conditions.push('(s.department_id = ? OR d.branch_code = ?)');
      params.push(isNaN(Number(dept)) ? dept : Number(dept), dept);
    }
    if (search) {
      conditions.push('(s.student_name ILIKE ? OR s.roll_no::text ILIKE ? OR s.email ILIKE ?)');
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }

    if (conditions.length) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' GROUP BY s.student_id, s.student_name, s.roll_no, s.branch, s.email, d.department_name';

    if (status) {
      if (status === 'Paid') {
        sql += ' HAVING COUNT(sf.student_fee_id) > 0 AND COALESCE(SUM(sf.balance_amount), 0) <= 0';
      } else if (status === 'Partially Paid' || status === 'Partial') {
        sql += ' HAVING COALESCE(SUM(sf.amount_paid), 0) > 0 AND COALESCE(SUM(sf.balance_amount), 0) > 0';
      } else if (status === 'Unpaid') {
        sql += ' HAVING COALESCE(SUM(sf.amount_paid), 0) = 0 AND COALESCE(SUM(sf.balance_amount), 0) > 0';
      }
    }

    sql += ' ORDER BY balance DESC, s.student_id ASC LIMIT 300';
    const [rows] = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function getStudentFeeDetails(req, res, next) {
  try {
    const { studentId } = req.params;
    const [student] = await query(
      `SELECT s.student_id, s.student_name, s.roll_no, s.email, s.phone, s.branch, s.current_semester, d.department_name
       FROM student s
       LEFT JOIN department d ON s.department_id = d.department_id
       WHERE s.student_id = ?`,
      [studentId]
    );

    if (!student.length) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const [fees] = await query(
      `SELECT sf.*, fs.fee_type, fs.academic_year, fs.amount AS structure_amount
       FROM student_fee sf
       LEFT JOIN fee_structure fs ON sf.fee_structure_id = fs.fee_structure_id
       WHERE sf.student_id = ?
       ORDER BY sf.due_date DESC`,
      [studentId]
    );

    const [payments] = await query(
      `SELECT p.*, sf.invoice_no, fs.fee_type
       FROM payment p
       JOIN student_fee sf ON p.student_fee_id = sf.student_fee_id
       LEFT JOIN fee_structure fs ON sf.fee_structure_id = fs.fee_structure_id
       WHERE sf.student_id = ?
       ORDER BY p.payment_date DESC`,
      [studentId]
    );

    res.json({ success: true, data: { student: student[0], fees, payments } });
  } catch (err) { next(err); }
}

async function recordPayment(req, res, next) {
  let conn;
  try {
    const { studentFeeId } = req.params;
    const { amount, payment_mode, transaction_reference } = req.body;
    const payAmount = parseFloat(amount);
    if (!payAmount || payAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid payment amount is required.' });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [sf] = await conn.execute(
      'SELECT student_fee_id, amount_due, scholarship_amount, amount_paid, balance_amount, status FROM student_fee WHERE student_fee_id = ? FOR UPDATE',
      [studentFeeId]
    );
    if (!sf.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Fee record not found.' });
    }

    const currentBalance = (sf[0].balance_amount !== undefined && sf[0].balance_amount !== null)
      ? parseFloat(sf[0].balance_amount)
      : parseFloat(sf[0].amount_due) - parseFloat(sf[0].scholarship_amount || 0) - parseFloat(sf[0].amount_paid || 0);
    if (currentBalance <= 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'This fee is already fully paid.' });
    }
    if (payAmount > currentBalance) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: `Payment amount ₹${payAmount.toLocaleString('en-IN')} exceeds outstanding balance ₹${currentBalance.toLocaleString('en-IN')}.`
      });
    }

    // leave the reference NULL when the cashier typed none: trigger fn_payment_before generates it from payment_txn_seq
    const ref = transaction_reference && String(transaction_reference).trim() ? String(transaction_reference).trim() : null;
    await conn.execute(
      `INSERT INTO payment (student_fee_id, amount, payment_date, payment_mode, transaction_reference, status, payment_status)
       VALUES (?, ?, CURRENT_DATE, ?, ?, 'Success', 'Success')`,
      [studentFeeId, payAmount, payment_mode || 'Cash/Counter', ref]
    );

    // Supabase trigger fn_payment_after automatically recalculates amount_paid, balance_amount, and status
    const [updatedSf] = await conn.execute(
      'SELECT student_fee_id, amount_due, scholarship_amount, amount_paid, balance_amount, status FROM student_fee WHERE student_fee_id = ?',
      [studentFeeId]
    );

    await conn.commit();
    const updated = updatedSf[0] || sf[0];
    res.json({
      success: true,
      message: `Payment of ₹${payAmount.toLocaleString('en-IN')} recorded successfully. Remaining balance: ₹${parseFloat(updated.balance_amount || 0).toLocaleString('en-IN')}. Status: ${updated.status}.`,
      data: updated
    });
  } catch (err) {
    if (conn) await conn.rollback();
    if (err && err.code === 'P0001') return res.status(400).json({ success: false, message: err.message });
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

async function getFeeStructures(req, res, next) {
  try {
    const [structures] = await query(
      `SELECT fs.*, d.department_name, sem.semester_number, sem.academic_year AS sem_year
       FROM fee_structure fs
       LEFT JOIN department d ON fs.department_id = d.department_id
       LEFT JOIN academic_semester sem ON fs.semester_id = sem.semester_id
       ORDER BY fs.academic_year DESC, fs.fee_type ASC`
    );
    res.json({ success: true, data: structures });
  } catch (err) { next(err); }
}

async function addFeeStructure(req, res, next) {
  try {
    // fee_structure is keyed by department (there is no course_id column); accept course_id as a legacy alias
    const { department_id, course_id, semester_id, fee_type, amount, academic_year, due_date } = req.body;
    const dept = department_id || course_id;
    if (!dept || !semester_id || !fee_type || !amount || !(parseFloat(amount) > 0)) {
      return res.status(400).json({ success: false, message: 'Department, semester, fee type and a positive amount are required.' });
    }
    const [result] = await query(
      `INSERT INTO fee_structure (department_id, semester_id, fee_type, amount, academic_year, due_date)
       VALUES (?, ?, ?, ?, COALESCE(?, (SELECT academic_year FROM academic_semester WHERE semester_id = ?)), ?)
       RETURNING *`,
      [dept, semester_id, fee_type, parseFloat(amount), academic_year || null, semester_id, due_date || null]
    );
    res.status(201).json({ success: true, message: 'Fee structure created successfully.', fee_structure_id: result[0].fee_structure_id, data: result[0] });
  } catch (err) {
    if (err && (err.code === '23503' || err.code === '23502')) {
      return res.status(400).json({ success: false, message: 'Invalid department or semester for this fee structure.' });
    }
    next(err);
  }
}

async function getAllPayments(req, res, next) {
  try {
    const { receiptNumber, studentName, paymentMethod, feeType, startDate, endDate } = req.query;
    let sql = `SELECT p.*, s.student_name, s.roll_no, sf.invoice_no, fs.fee_type
               FROM payment p
               JOIN student_fee sf ON p.student_fee_id = sf.student_fee_id
               JOIN student s ON sf.student_id = s.student_id
               LEFT JOIN fee_structure fs ON sf.fee_structure_id = fs.fee_structure_id`;
    const params = [];
    const conditions = [];

    if (receiptNumber) {
      conditions.push('(p.transaction_reference ILIKE ? OR p.payment_id::text ILIKE ?)');
      params.push(`%${receiptNumber.trim()}%`, `%${receiptNumber.trim()}%`);
    }
    if (studentName) {
      conditions.push('(s.student_name ILIKE ? OR s.roll_no::text ILIKE ?)');
      params.push(`%${studentName.trim()}%`, `%${studentName.trim()}%`);
    }
    if (paymentMethod) {
      conditions.push('p.payment_mode = ?');
      params.push(paymentMethod);
    }
    if (feeType) {
      conditions.push('fs.fee_type ILIKE ?');
      params.push(`%${feeType.trim()}%`);
    }
    if (startDate) {
      conditions.push('p.payment_date >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('p.payment_date <= ?');
      params.push(endDate);
    }

    if (conditions.length) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY p.payment_date DESC, p.payment_id DESC LIMIT 300';
    const [rows] = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────
// NEW: Faculty Payroll & Disbursements (Finance)
// ─────────────────────────────────────────────
async function getFacultyPayroll(req, res, next) {
  try {
    const { facultyName, facultyId, department, salaryMonth, status } = req.query;

    let sql = `SELECT fp.*, f.faculty_name, f.faculty_id, f.email as faculty_email,
                      d.department_name, des.designation_name
               FROM faculty_payroll fp
               JOIN faculty f ON fp.faculty_id = f.faculty_id
               LEFT JOIN department d ON f.department_id = d.department_id
               LEFT JOIN designation des ON f.designation_id = des.designation_id`;
    const params = [];
    const conditions = [];

    if (facultyName) {
      conditions.push('(f.faculty_name ILIKE ? OR f.email ILIKE ?)');
      params.push(`%${facultyName.trim()}%`, `%${facultyName.trim()}%`);
    }
    if (facultyId) {
      conditions.push('f.faculty_id = ?');
      params.push(Number(facultyId));
    }
    if (department) {
      conditions.push('(f.department_id = ? OR d.branch_code = ?)');
      params.push(isNaN(Number(department)) ? department : Number(department), department);
    }
    if (salaryMonth) {
      conditions.push('fp.month_year ILIKE ?');
      params.push(`%${salaryMonth.trim()}%`);
    }
    if (status) {
      conditions.push('fp.status ILIKE ?');
      params.push(status);
    }

    if (conditions.length) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY fp.payroll_id DESC LIMIT 300';
    const [rows] = await query(sql, params);

    const [[summary]] = await query(`
      SELECT COALESCE(SUM(gross_salary), 0) AS total_payroll,
             COALESCE(SUM(CASE WHEN status IN ('Paid', 'Disbursed', 'Credited') THEN net_salary ELSE 0 END), 0) AS disbursed_salary,
             COALESCE(SUM(CASE WHEN status NOT IN ('Paid', 'Disbursed', 'Credited') THEN net_salary ELSE 0 END), 0) AS pending_salary,
             COUNT(DISTINCT faculty_id) AS faculty_count,
             COUNT(*) AS total_payslips
      FROM faculty_payroll
    `);

    const formatted = (rows || []).map(p => {
      const parts = (p.month_year || '').split(' ');
      const month = p.month || parts[0] || '';
      const year = p.year || parseInt(parts[1], 10) || null;
      const basic = Number(p.basic_pay || p.basic_salary || 0);
      const hra = Number(p.hra || p.hra_allowance || 0);
      const da = Number(p.da || p.da_allowance || 0);
      const gross = Number(p.gross_salary || (basic + hra + da));
      const deductions = Number(p.deductions || p.total_deductions || 0);
      const net = Number(p.net_salary || (gross - deductions));

      return {
        id: p.payroll_id,
        payroll_id: p.payroll_id,
        slip_ref_no: `PAY-${p.payroll_id}`,
        faculty_id: p.faculty_id,
        faculty_name: p.faculty_name,
        department_name: p.department_name || 'Academics',
        designation: p.designation_name || 'Faculty Member',
        month_year: p.month_year || `${month} ${year}`,
        month,
        year,
        basic_salary: basic,
        hra_allowance: hra,
        da_allowance: da,
        travel_allowance: Number(p.travel_allowance || 0),
        academic_allowance: Number(p.academic_allowance || 0),
        gross_salary: gross,
        total_deductions: deductions,
        net_salary: net,
        disbursement_date: p.payment_date || null,
        payment_mode: p.payment_mode || null,
        status: p.status || 'Pending'
      };
    });

    res.json({
      success: true,
      data: formatted,
      summary: {
        totalPayroll: parseFloat(summary.total_payroll) || 0,
        totalDisbursed: parseFloat(summary.disbursed_salary) || 0,
        pendingSalary: parseFloat(summary.pending_salary) || 0,
        facultyCount: parseInt(summary.faculty_count) || 0,
        totalPayslips: parseInt(summary.total_payslips) || 0
      }
    });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────
// NEW: Library Financials & Fines (Finance)
// ─────────────────────────────────────────────
async function getLibraryFinancials(req, res, next) {
  try {
    const { studentName, status, startDate, endDate } = req.query;

    let sql = `SELECT f.fine_id, f.student_id, f.issue_id, f.fine_type, f.fine_amount, 
                      f.fine_date, f.paid_date,
                      COALESCE(f.payment_status, f.paid_status, 'Pending') AS status,
                      s.student_name, s.roll_no, s.email, d.department_name,
                      b.isbn, b.title AS book_title
               FROM fine f
               JOIN student s ON f.student_id = s.student_id
               LEFT JOIN department d ON s.department_id = d.department_id
               LEFT JOIN book_issue bi ON f.issue_id = bi.issue_id
               LEFT JOIN book_copy bc ON bi.copy_id = bc.copy_id
               LEFT JOIN book b ON bc.isbn = b.isbn`;
    const params = [];
    const conditions = [];

    if (studentName) {
      conditions.push('(s.student_name ILIKE ? OR s.roll_no::text ILIKE ?)');
      params.push(`%${studentName.trim()}%`, `%${studentName.trim()}%`);
    }
    if (status) {
      conditions.push("COALESCE(f.payment_status, f.paid_status, 'Pending') ILIKE ?");
      params.push(status);
    }
    if (startDate) {
      conditions.push('(COALESCE(f.paid_date, f.fine_date) >= ?)');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('(COALESCE(f.paid_date, f.fine_date) <= ?)');
      params.push(endDate);
    }

    if (conditions.length) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY f.fine_id DESC LIMIT 300';
    const [rows] = await query(sql, params);

    const [[summary]] = await query(`
      SELECT COALESCE(SUM(fine_amount), 0) AS total_fines,
             COALESCE(SUM(CASE WHEN COALESCE(payment_status, paid_status) = 'Paid' THEN fine_amount ELSE 0 END), 0) AS collected,
             COALESCE(SUM(CASE WHEN COALESCE(payment_status, paid_status, 'Pending') <> 'Paid' THEN fine_amount ELSE 0 END), 0) AS outstanding,
             COUNT(*) AS total_transactions
      FROM fine
    `);

    const formatted = (rows || []).map(f => {
      const fineAmt = parseFloat(f.fine_amount) || 0;
      const isPaid = (f.status === 'Paid');
      return {
        fine_id: f.fine_id,
        student_id: f.student_id,
        student_name: f.student_name,
        roll_no: f.roll_no,
        department_name: f.department_name,
        book_id: f.isbn || `BOOK-${f.issue_id || f.fine_id}`,
        book_title: f.book_title || 'Issued Library Book',
        fine_type: f.fine_type || 'Late Return',
        fine_amount: fineAmt,
        amount_paid: isPaid ? fineAmt : 0,
        outstanding_fine: isPaid ? 0 : fineAmt,
        fine_date: f.fine_date,
        payment_date: f.paid_date || null,
        payment_method: isPaid ? 'Cash (Library Counter)' : 'Unsettled',
        status: isPaid ? 'Paid' : 'Pending',
        receipt_ref: `LIB-REC-${f.fine_id}`
      };
    });

    res.json({
      success: true,
      data: formatted,
      summary: {
        totalGenerated: parseFloat(summary.total_fines) || 0,
        totalCollected: parseFloat(summary.collected) || 0,
        totalOutstanding: parseFloat(summary.outstanding) || 0,
        totalTransactions: parseInt(summary.total_transactions) || 0
      }
    });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────
// NEW: Consolidated Financial Reports (Finance)
// ─────────────────────────────────────────────
async function getFinancialReports(req, res, next) {
  try {
    const { startDate, endDate, department, category } = req.query;

    let feeParams = [];
    let feeDateCond = '';
    if (startDate) {
      feeDateCond += ' AND p.payment_date >= ?';
      feeParams.push(startDate);
    }
    if (endDate) {
      feeDateCond += ' AND p.payment_date <= ?';
      feeParams.push(endDate);
    }

    const [[feeStats]] = await query(`
      SELECT COALESCE(SUM(p.amount), 0) AS total_collected
      FROM payment p
      WHERE (p.payment_status = 'Success' OR p.status = 'Success')${feeDateCond}
    `, feeParams);

    const [[feeDueStats]] = await query(`
      SELECT COALESCE(SUM(balance_amount), 0) AS total_outstanding,
             COALESCE(SUM(amount_due), 0) AS total_invoiced
      FROM student_fee
    `);

    let fineParams = [];
    let fineDateCond = '';
    if (startDate) {
      fineDateCond += ' AND COALESCE(paid_date, fine_date) >= ?';
      fineParams.push(startDate);
    }
    if (endDate) {
      fineDateCond += ' AND COALESCE(paid_date, fine_date) <= ?';
      fineParams.push(endDate);
    }

    const [[fineStats]] = await query(`
      SELECT COALESCE(SUM(fine_amount), 0) AS total_generated,
             COALESCE(SUM(CASE WHEN COALESCE(payment_status, paid_status) = 'Paid' THEN fine_amount ELSE 0 END), 0) AS collected,
             COALESCE(SUM(CASE WHEN COALESCE(payment_status, paid_status, 'Pending') <> 'Paid' THEN fine_amount ELSE 0 END), 0) AS outstanding
      FROM fine
      WHERE 1=1${fineDateCond}
    `, fineParams);

    let salaryParams = [];
    let salaryDateCond = '';
    if (startDate) {
      salaryDateCond += ' AND payment_date >= ?';
      salaryParams.push(startDate);
    }
    if (endDate) {
      salaryDateCond += ' AND payment_date <= ?';
      salaryParams.push(endDate);
    }

    const [[salaryStats]] = await query(`
      SELECT COALESCE(SUM(CASE WHEN status IN ('Paid', 'Disbursed', 'Credited') THEN net_salary ELSE 0 END), 0) AS disbursed_expense,
             COALESCE(SUM(CASE WHEN status NOT IN ('Paid', 'Disbursed', 'Credited') THEN net_salary ELSE 0 END), 0) AS pending_liability,
             COALESCE(SUM(gross_salary), 0) AS total_budgeted
      FROM faculty_payroll
      WHERE 1=1${salaryDateCond}
    `, salaryParams);

    let deptParams = [];
    let deptCond = '';
    if (department) {
      deptCond = ' WHERE d.department_id = ? OR d.branch_code = ?';
      deptParams.push(isNaN(Number(department)) ? department : Number(department), department);
    }

    const [deptCollections] = await query(`
      SELECT d.department_id, d.department_name, d.branch_code,
             COALESCE(SUM(sf.amount_due), 0) AS total_invoiced,
             COALESCE(SUM(sf.amount_paid), 0) AS total_collected,
             COALESCE(SUM(sf.balance_amount), 0) AS total_outstanding,
             COUNT(DISTINCT s.student_id) AS student_count
      FROM department d
      LEFT JOIN student s ON d.department_id = s.department_id
      LEFT JOIN student_fee sf ON s.student_id = sf.student_id
      ${deptCond}
      GROUP BY d.department_id, d.department_name, d.branch_code
      ORDER BY total_invoiced DESC
    `, deptParams);

    const [paymentModes] = await query(`
      SELECT payment_mode, 
             COUNT(*) AS transaction_count,
             COALESCE(SUM(amount), 0) AS total_amount
      FROM payment
      WHERE payment_status = 'Success' OR status = 'Success'
      GROUP BY payment_mode
      ORDER BY total_amount DESC
    `);

    const [monthlyFee] = await query(`
      SELECT TO_CHAR(payment_date, 'YYYY-MM') AS month_key,
             TO_CHAR(payment_date, 'Mon YYYY') AS month_label,
             COALESCE(SUM(amount), 0) AS fee_amount
      FROM payment
      WHERE (payment_status = 'Success' OR status = 'Success')
      GROUP BY TO_CHAR(payment_date, 'YYYY-MM'), TO_CHAR(payment_date, 'Mon YYYY')
      ORDER BY month_key DESC
      LIMIT 6
    `);

    const [monthlyPayroll] = await query(`
      SELECT month_year,
             COALESCE(SUM(net_salary), 0) AS salary_amount
      FROM faculty_payroll
      WHERE status IN ('Paid', 'Disbursed', 'Credited')
      GROUP BY month_year
      ORDER BY MAX(payroll_id) DESC
      LIMIT 6
    `);

    res.json({
      success: true,
      data: {
        summary: {
          income: {
            feeCollected: parseFloat(feeStats.total_collected) || 0,
            feeOutstanding: parseFloat(feeDueStats.total_outstanding) || 0,
            feeTotalInvoiced: parseFloat(feeDueStats.total_invoiced) || 0,
            fineCollected: parseFloat(fineStats.collected) || 0,
            fineOutstanding: parseFloat(fineStats.outstanding) || 0,
            totalIncomeCollected: (parseFloat(feeStats.total_collected) || 0) + (parseFloat(fineStats.collected) || 0),
            totalReceivables: (parseFloat(feeDueStats.total_outstanding) || 0) + (parseFloat(fineStats.outstanding) || 0)
          },
          expenses: {
            salaryDisbursed: parseFloat(salaryStats.disbursed_expense) || 0,
            salaryPending: parseFloat(salaryStats.pending_liability) || 0,
            totalBudgeted: parseFloat(salaryStats.total_budgeted) || 0
          },
          netInstitutionalSurplus: ((parseFloat(feeStats.total_collected) || 0) + (parseFloat(fineStats.collected) || 0)) - (parseFloat(salaryStats.disbursed_expense) || 0)
        },
        departmentCollections: deptCollections.map(d => {
          const inv = parseFloat(d.total_invoiced) || 0;
          const col = parseFloat(d.total_collected) || 0;
          const bal = parseFloat(d.total_outstanding) || 0;
          const pct = inv > 0 ? Math.min(100, Math.round((col / inv) * 100)) : 100;
          return {
            department_id: d.department_id,
            department_name: d.department_name,
            branch_code: d.branch_code,
            invoiced: inv,
            collected: col,
            balance: bal,
            collectionPercentage: pct,
            student_count: parseInt(d.student_count) || 0
          };
        }),
        paymentModes: paymentModes.map(m => ({
          payment_mode: m.payment_mode || 'Cash/Counter',
          count: parseInt(m.transaction_count) || 0,
          total: parseFloat(m.total_amount) || 0
        })),
        monthlyFee,
        monthlyPayroll
      }
    });
  } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════
// LIBRARIAN ENDPOINTS
// ═══════════════════════════════════════════════════

async function getLibraryDashboard(req, res, next) {
  try {
    const [[totalBooks]]    = await query('SELECT COUNT(*) AS c FROM book');
    const [[totalCopies]]   = await query('SELECT COUNT(*) AS c FROM book_copy');
    const [[availCopies]]   = await query("SELECT COUNT(*) AS c FROM book_copy WHERE status = 'Available'");
    const [[activeIssues]]  = await query("SELECT COUNT(*) AS c FROM book_issue WHERE COALESCE(issue_status, status) IN ('Issued', 'Overdue')");
    const [[overdueCount]]  = await query("SELECT COUNT(*) AS c FROM book_issue WHERE COALESCE(issue_status, status) IN ('Issued', 'Overdue') AND due_date < CURRENT_DATE");

    const [recentIssues] = await query(
      `SELECT bi.issue_id, bi.issue_date, bi.due_date, COALESCE(bi.issue_status, bi.status) AS issue_status,
              s.student_name, s.roll_no,
              b.title, b.isbn, bc.accession_no,
              br.return_date,
              GREATEST(0, (CURRENT_DATE - bi.due_date)::integer) AS days_overdue
       FROM book_issue bi
       JOIN student s ON bi.student_id = s.student_id
       JOIN book_copy bc ON bi.copy_id = bc.copy_id
       JOIN book b ON bc.isbn = b.isbn
       LEFT JOIN book_return br ON bi.issue_id = br.issue_id
       ORDER BY bi.issue_date DESC, bi.issue_id DESC LIMIT 10`
    );

    res.json({
      success: true,
      data: {
        stats: {
          totalBooks: parseInt(totalBooks.c) || 0,
          totalCopies: parseInt(totalCopies.c) || 0,
          availableCopies: parseInt(availCopies.c) || 0,
          activeIssues: parseInt(activeIssues.c) || 0,
          overdueCount: parseInt(overdueCount.c) || 0
        },
        recentIssues
      }
    });
  } catch (err) { next(err); }
}

async function getBooks(req, res, next) {
  try {
    const { search, category } = req.query;
    let sql = `SELECT b.isbn, b.title, b.edition, b.publication_year, b.language,
                      b.total_copies, b.available_copies,
                      COALESCE(to_jsonb(b) ->> 'shelf_location', to_jsonb(b) ->> 'shelf_no') AS shelf_location,
                      b.rack_no,
                      a.author_name, p.publisher_name, cat.category_name
               FROM book b
               LEFT JOIN author a ON b.author_id = a.author_id
               LEFT JOIN publisher p ON b.publisher_id = p.publisher_id
               LEFT JOIN book_category cat ON b.category_id = cat.category_id`;
    const params = [];
    const conditions = [];

    if (search) {
      conditions.push('(b.title ILIKE ? OR a.author_name ILIKE ? OR b.isbn ILIKE ?)');
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }
    if (category) {
      conditions.push('cat.category_name = ?');
      params.push(category);
    }

    if (conditions.length) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY b.title ASC LIMIT 500';

    const [rows] = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

// find-or-create helper for author / publisher / category (Postgres: RETURNING instead of insertId)
async function resolveLookup(conn, table, idCol, nameCol, name) {
  if (!name || !String(name).trim()) return null;
  const clean = String(name).trim();
  const [found] = await conn.execute(`SELECT ${idCol} FROM ${table} WHERE LOWER(${nameCol}) = LOWER(?) LIMIT 1`, [clean]);
  if (found.length) return found[0][idCol];
  const [ins] = await conn.execute(`INSERT INTO ${table} (${nameCol}) VALUES (?) RETURNING ${idCol}`, [clean]);
  return ins[0][idCol];
}

async function addBook(req, res, next) {
  let conn;
  try {
    const { isbn, title, author_name, publisher_name, category_name, edition, publication_year, language, total_copies, shelf_location, rack_no } = req.body;
    if (!isbn || !title) {
      return res.status(400).json({ success: false, message: 'ISBN and title are required.' });
    }
    const copies = parseInt(total_copies, 10) || 1;
    if (copies < 1 || copies > 200) {
      return res.status(400).json({ success: false, message: 'Number of copies must be between 1 and 200.' });
    }

    const bookCols = await tableColumns('book');
    const copyCols = await tableColumns('book_copy');
    const shelfCol = pickCol(bookCols, 'shelf_location', 'shelf_no');
    const condCol = pickCol(copyCols, 'condition_status', 'condition');

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const authorId = await resolveLookup(conn, 'author', 'author_id', 'author_name', author_name);
    const publisherId = await resolveLookup(conn, 'publisher', 'publisher_id', 'publisher_name', publisher_name);
    const categoryId = await resolveLookup(conn, 'book_category', 'category_id', 'category_name', category_name);

    const cleanIsbn = isbn.trim();
    const [exists] = await conn.execute('SELECT isbn FROM book WHERE isbn = ? FOR UPDATE', [cleanIsbn]);

    // Trigger fn_book_copy_counts keeps book.total_copies / available_copies in sync when copies are inserted,
    // so the book row is created with 0 and the copy inserts below do the counting.
    if (!exists.length) {
      const cols = ['isbn', 'title', 'author_id', 'publisher_id', 'category_id', 'edition', 'publication_year', 'language', 'total_copies', 'available_copies'];
      const vals = [cleanIsbn, title.trim(), authorId, publisherId, categoryId, edition || null, publication_year || null, language || 'English', 0, 0];
      if (shelfCol) { cols.push(shelfCol); vals.push(shelf_location || null); }
      if (bookCols.has('rack_no')) { cols.push('rack_no'); vals.push(rack_no || null); }
      await conn.execute(`INSERT INTO book (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals);
    }

    const [cnt] = await conn.execute('SELECT COUNT(*)::int AS n FROM book_copy WHERE isbn = ?', [cleanIsbn]);
    const n = Number(cnt[0].n);
    const tail = cleanIsbn.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
    for (let i = 1; i <= copies; i++) {
      const accessionNo = `ACC-${tail}-${String(n + i).padStart(3, '0')}-${Date.now().toString(36).slice(-3).toUpperCase()}`;
      const vals = [cleanIsbn, accessionNo, 'Available'];
      const sql = `INSERT INTO book_copy (isbn, accession_no, status, purchase_date${condCol ? `, ${condCol}` : ''}) VALUES (?, ?, ?, CURRENT_DATE${condCol ? ", 'New'" : ''})`;
      await conn.execute(sql, vals);
    }

    // safety net if the count trigger is not installed in this database
    const [chk] = await conn.execute(
      `SELECT b.total_copies, (SELECT COUNT(*) FROM book_copy c WHERE c.isbn = b.isbn) AS real_total FROM book b WHERE b.isbn = ?`, [cleanIsbn]);
    if (chk.length && Number(chk[0].total_copies) !== Number(chk[0].real_total)) {
      await conn.execute(
        `UPDATE book SET total_copies = (SELECT COUNT(*) FROM book_copy WHERE isbn = ?),
                         available_copies = (SELECT COUNT(*) FROM book_copy WHERE isbn = ? AND status = 'Available') WHERE isbn = ?`,
        [cleanIsbn, cleanIsbn, cleanIsbn]);
    }

    await conn.commit();
    res.status(201).json({ success: true, message: `${exists.length ? 'Added' : 'Book "' + title + '" created with'} ${copies} cop${copies === 1 ? 'y' : 'ies'}.` });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

async function updateBook(req, res, next) {
  try {
    const { isbn } = req.params;
    const { title, edition, publication_year, language, shelf_location, rack_no } = req.body;
    const bookCols = await tableColumns('book');
    const shelfCol = pickCol(bookCols, 'shelf_location', 'shelf_no');
    // only touch fields that were actually sent
    const sets = []; const params = [];
    const add = (col, val) => { sets.push(`${col} = ?`); params.push(val === '' ? null : val); };
    if (title !== undefined && String(title).trim()) add('title', String(title).trim());
    if (edition !== undefined) add('edition', edition);
    if (publication_year !== undefined) add('publication_year', publication_year);
    if (language !== undefined && language) add('language', language);
    if (shelf_location !== undefined && shelfCol) add(shelfCol, shelf_location);
    if (rack_no !== undefined && bookCols.has('rack_no')) add('rack_no', rack_no);
    if (!sets.length) return res.status(400).json({ success: false, message: 'Nothing to update.' });
    params.push(isbn);
    const [upd] = await query(`UPDATE book SET ${sets.join(', ')} WHERE isbn = ? RETURNING isbn`, params);
    if (!upd.length) return res.status(404).json({ success: false, message: 'Book not found.' });
    res.json({ success: true, message: 'Book updated successfully.' });
  } catch (err) { next(err); }
}

async function getIssues(req, res, next) {
  try {
    const { status, student_id } = req.query;
    // book_issue has no `remarks` column - the remark of a loan lives on book_return
    let sql = `SELECT bi.issue_id, bi.issue_date, bi.due_date, ${LOAN_STATUS} AS issue_status,
                      s.student_name, s.roll_no, s.student_id,
                      b.title, b.isbn, bc.copy_id, bc.accession_no,
                      br.return_date, br.condition_on_return, br.remarks,
                      CASE WHEN br.return_id IS NULL THEN GREATEST(0, (CURRENT_DATE - bi.due_date)::integer) ELSE COALESCE(br.days_late, 0) END AS days_overdue
               FROM book_issue bi
               JOIN student s ON bi.student_id = s.student_id
               JOIN book_copy bc ON bi.copy_id = bc.copy_id
               JOIN book b ON bc.isbn = b.isbn
               LEFT JOIN book_return br ON bi.issue_id = br.issue_id`;
    const params = [];
    const conditions = [];

    if (status) {
      if (status === 'Overdue') {
        conditions.push(`${LOAN_STATUS} IN ('Issued', 'Overdue') AND bi.due_date < CURRENT_DATE`);
      } else if (status === 'Issued') {
        conditions.push(`${LOAN_STATUS} IN ('Issued', 'Overdue') AND bi.due_date >= CURRENT_DATE`);
      } else {
        conditions.push(`${LOAN_STATUS} = ?`);
        params.push(status);
      }
    }
    if (student_id) {
      conditions.push('bi.student_id = ?');
      params.push(student_id);
    }

    if (conditions.length) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY bi.issue_date DESC, bi.issue_id DESC LIMIT 500';

    const [rows] = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function issueBook(req, res, next) {
  let conn;
  try {
    const { student_id, roll_no, isbn, due_days, issue_date, due_date } = req.body;
    let resolvedStudentId = student_id;

    conn = await pool.getConnection();
    await conn.beginTransaction();

    if (!resolvedStudentId && roll_no) {
      const [stu] = await conn.execute('SELECT student_id FROM student WHERE roll_no = ? LIMIT 1', [roll_no.trim()]);
      if (stu.length) resolvedStudentId = stu[0].student_id;
    }

    if (!resolvedStudentId || !isbn) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Student (ID or Roll No) and Book ISBN are required.' });
    }

    // the logged-in librarian; NULL (not a made-up staff #1) when an ADMIN issues the book
    const staffId = (req.user && req.user.staff_id) ? req.user.staff_id : null;

    // Find an available copy
    const [copies] = await conn.execute(
      "SELECT copy_id, accession_no FROM book_copy WHERE isbn = ? AND status = 'Available' ORDER BY copy_id LIMIT 1 FOR UPDATE",
      [isbn.trim()]
    );
    if (!copies.length) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'No available copies for this book right now.' });
    }
    const copyId = copies[0].copy_id;
    const days = parseInt(due_days) || 14;

    // Support backdating: issue_date can be explicitly provided (e.g. 10 days ago)
    let resolvedIssueDate = issue_date || new Date().toISOString().split('T')[0];
    let resolvedDueDate = due_date;
    if (!resolvedDueDate) {
      const d = new Date(resolvedIssueDate);
      d.setDate(d.getDate() + days);
      resolvedDueDate = d.toISOString().split('T')[0];
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const isOverdueNow = resolvedDueDate < todayStr;
    const initialStatus = isOverdueNow ? 'Overdue' : 'Issued';

    const [stuOk] = await conn.execute('SELECT 1 FROM student WHERE student_id = ?', [resolvedStudentId]);
    if (!stuOk.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const [issueRes] = await conn.execute(
      `INSERT INTO book_issue (copy_id, student_id, staff_id, issue_date, due_date, status, issue_status)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING issue_id`,
      [
        copyId,
        resolvedStudentId,
        staffId,
        resolvedIssueDate,
        resolvedDueDate,
        initialStatus,
        initialStatus
      ]
    );

    const issueId = issueRes[0]?.issue_id || issueRes.insertId;

    // book_copy.status and book.available_copies are maintained by trigger fn_book_issue_after

    let daysLate = 0;
    let overdueFine = 0;
    if (isOverdueNow) {
      const msDiff = new Date(todayStr).getTime() - new Date(resolvedDueDate).getTime();
      daysLate = Math.max(0, Math.floor(msDiff / (1000 * 60 * 60 * 24)));
      overdueFine = daysLate * 5.00;
    }

    await conn.commit();
    res.status(201).json({
      success: true,
      message: `Book issued successfully.${isOverdueNow ? ` (Backdated: Due date was ${resolvedDueDate}, ${daysLate} days overdue. Accrued fine: ₹${overdueFine.toFixed(2)})` : ` Due in ${days} days.`} Accession No: ${copies[0].accession_no}.`,
      issue_id: issueId,
      days_overdue: daysLate,
      fine_amount: overdueFine
    });
  } catch (err) {
    if (conn) await conn.rollback();
    // business-rule errors raised by DB triggers (copy not available, 3-book limit, ...)
    if (err && /not available|already has \d+ books/i.test(err.message || '')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

async function returnBook(req, res, next) {
  let conn;
  try {
    const { id } = req.params;
    const { condition_on_return, remarks } = req.body || {};
    const bookCondition = ['Good', 'Damaged', 'Lost'].includes(condition_on_return) ? condition_on_return : 'Good';

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [issue] = await conn.execute('SELECT issue_id, issue_status FROM book_issue WHERE issue_id = ?', [id]);
    if (!issue.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Issue record not found.' });
    }
    if (issue[0].issue_status === 'Returned') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'This book has already been marked as returned.' });
    }

    // Triggers fn_book_return_before/after compute days_late, close the issue, restore
    // copy status + stock and create the late-return fine (Rs 5/day). Do NOT repeat that here.
    const [retRes] = await conn.execute(
      `INSERT INTO book_return (issue_id, return_date, condition_on_return, remarks)
       VALUES (?, CURRENT_DATE, ?, ?) RETURNING return_id, days_late`,
      [id, bookCondition, remarks || 'Returned via Staff Portal']
    );
    const returnId = retRes[0].return_id;
    const daysLate = Number(retRes[0].days_late || 0);

    // keep legacy duplicate columns consistent and link the trigger-created fine to this return
    await conn.execute("UPDATE book_issue SET status = 'Returned' WHERE issue_id = ?", [id]);
    await conn.execute('UPDATE fine SET return_id = ? WHERE issue_id = ? AND return_id IS NULL', [returnId, id]);
    const [fine] = await conn.execute('SELECT fine_id, fine_amount FROM fine WHERE issue_id = ? ORDER BY fine_id DESC LIMIT 1', [id]);

    await conn.commit();
    res.json({
      success: true,
      message: `Book returned successfully.${daysLate > 0 ? ` (Late by ${daysLate} days. Fine of ₹${daysLate * 5} applied)` : ''}`,
      fine: fine.length ? { fine_id: fine[0].fine_id, amount: Number(fine[0].fine_amount) } : null
    });
  } catch (err) {
    if (conn) await conn.rollback();
    if (err && /already been returned|cannot be before/i.test(err.message || '')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

async function getOverdueBooks(req, res, next) {
  try {
    const [rows] = await query(
      `SELECT bi.issue_id, bi.issue_date, bi.due_date,
              GREATEST(0, (CURRENT_DATE - bi.due_date)::integer) AS days_overdue,
              s.student_name, s.roll_no, s.email, s.phone,
              b.title, b.isbn, bc.accession_no,
              f.fine_id, f.fine_amount, COALESCE(f.payment_status, f.paid_status, 'Pending') AS fine_status
       FROM book_issue bi
       JOIN student s ON bi.student_id = s.student_id
       JOIN book_copy bc ON bi.copy_id = bc.copy_id
       JOIN book b ON bc.isbn = b.isbn
       LEFT JOIN fine f ON bi.issue_id = f.issue_id
       WHERE COALESCE(bi.issue_status, bi.status) IN ('Issued', 'Overdue')
         AND bi.due_date < CURRENT_DATE
       ORDER BY days_overdue DESC, bi.issue_id DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function getFines(req, res, next) {
  try {
    const { status, search } = req.query;
    let sql = `SELECT f.fine_id, f.student_id, f.issue_id, f.fine_type, f.fine_amount, f.fine_date, f.paid_date,
                      COALESCE(f.payment_status, f.paid_status, 'Pending') AS payment_status,
                      s.student_name, s.roll_no, s.email,
                      b.title, b.isbn
               FROM fine f
               JOIN student s ON f.student_id = s.student_id
               LEFT JOIN book_issue bi ON f.issue_id = bi.issue_id
               LEFT JOIN book_copy bc ON bi.copy_id = bc.copy_id
               LEFT JOIN book b ON bc.isbn = b.isbn`;
    const params = [];
    const conditions = [];
    if (status) {
      conditions.push("COALESCE(f.payment_status, f.paid_status, 'Pending') = ?");
      params.push(status);
    }
    if (search) {
      conditions.push('(s.student_name ILIKE ? OR s.roll_no::text ILIKE ? OR b.title ILIKE ?)');
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY f.fine_id DESC LIMIT 300';

    const [rows] = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function collectFine(req, res, next) {
  let conn;
  try {
    const { id } = req.params; // fine_id or issue_id
    const { issue_id, amount } = req.body || {};

    conn = await pool.getConnection();
    await conn.beginTransaction();

    let targetFineId = id ? parseInt(id, 10) : null;

    if (!targetFineId && issue_id) {
      const [existingFine] = await conn.execute(
        "SELECT fine_id FROM fine WHERE issue_id = ? AND COALESCE(payment_status, paid_status, 'Pending') <> 'Paid' ORDER BY fine_id LIMIT 1",
        [issue_id]
      );
      if (existingFine.length) {
        targetFineId = existingFine[0].fine_id;
      } else {
        const [issue] = await conn.execute(
          `SELECT bi.*, GREATEST(0, (CURRENT_DATE - bi.due_date)::integer) AS days_late
           FROM book_issue bi WHERE bi.issue_id = ?`,
          [issue_id]
        );
        if (issue.length) {
          const fineAmt = amount ? parseFloat(amount) : (issue[0].days_late * 5.00);
          const [newFine] = await conn.execute(
            `INSERT INTO fine (student_id, issue_id, fine_type, fine_amount, fine_date, payment_status, paid_status, paid_date)
             VALUES (?, ?, 'Late Return', ?, CURRENT_DATE, 'Paid', 'Paid', CURRENT_DATE) RETURNING fine_id`,
            [issue[0].student_id, issue_id, fineAmt]
          );
          targetFineId = newFine[0]?.fine_id || newFine.insertId;
        }
      }
    }

    if (!targetFineId) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Valid fine ID or issue ID is required.' });
    }

    const [cur] = await conn.execute('SELECT fine_id, COALESCE(payment_status, paid_status) AS st FROM fine WHERE fine_id = ? FOR UPDATE', [targetFineId]);
    if (!cur.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Fine not found.' });
    }
    if (cur[0].st === 'Paid') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'This fine has already been collected.' });
    }
    await conn.execute(
      "UPDATE fine SET payment_status = 'Paid', paid_status = 'Paid', paid_date = CURRENT_DATE WHERE fine_id = ?",
      [targetFineId]
    );

    const [updated] = await conn.execute('SELECT * FROM fine WHERE fine_id = ?', [targetFineId]);

    await conn.commit();
    res.json({
      success: true,
      message: `Library fine #${targetFineId} of ₹${parseFloat(updated[0]?.fine_amount || 0).toLocaleString('en-IN')} collected and marked Paid.`,
      data: updated[0]
    });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

module.exports = {
  getProfile,
  requireRole,
  // TNP
  getTNPDashboard, getCompanies, addCompany, updateCompany,
  getDrives, addDrive, updateDriveStatus,
  getApplications, shortlistApplication, getPlacements,
  // Finance
  getFinanceDashboard, getStudentsWithFees, getStudentFeeDetails,
  recordPayment, getFeeStructures, addFeeStructure, getAllPayments,
  getFacultyPayroll, getLibraryFinancials, getFinancialReports,
  // Library
  getLibraryDashboard, getBooks, addBook, updateBook,
  getIssues, issueBook, returnBook, getOverdueBooks, getFines, collectFine
};
