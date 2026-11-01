/* Checks the LIVE database against everything the application code reads or writes.
 *   node scripts/verify_schema.cjs
 * Uses the same DB_* / DATABASE_URL settings as the server (server/.env).
 * Exit code 1 if anything required is missing. */
const path = require('path');
try { require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') }); } catch (_) {}
const { query, tableColumns } = require(path.join(__dirname, '..', 'server', 'config', 'db'));

// table -> columns the app code touches
const REQUIRED = {
  user_account: ['user_id', 'identifier', 'email', 'password_hash', 'role', 'student_id', 'faculty_id', 'staff_id', 'is_active'],
  student: ['student_id', 'prn', 'roll_no', 'student_name', 'email', 'phone', 'branch', 'department_id', 'section_id', 'current_year', 'current_semester', 'batch_year'],
  student_contact: ['student_id', 'mobile_number', 'institute_email'],
  student_address: ['student_id'], guardian_details: ['student_id'], academic_history: ['student_id'],
  department: ['department_id', 'department_name', 'branch_code'],
  section: ['section_id', 'section_name', 'department_id'],
  faculty: ['faculty_id', 'faculty_name', 'faculty_code', 'email', 'phone_no', 'department_id', 'designation_id', 'status'],
  faculty_leave: ['leave_code', 'faculty_id', 'leave_type', 'start_date', 'end_date', 'days_count', 'reason', 'cover_faculty_name', 'status', 'applied_on', 'approved_by', 'approved_on', 'approver_comments', 'leave_id'],
  faculty_leave_balance: ['faculty_id'],
  faculty_payroll: ['payroll_id', 'faculty_id', 'month_year', 'basic_pay', 'hra', 'da', 'gross_salary', 'deductions', 'net_salary', 'status', 'payment_date', 'travel_allowance', 'academic_allowance', 'payment_mode'],
  staff: ['staff_id', 'staff_name', 'email', 'department_id', 'designation_id'],
  designation: ['designation_id', 'designation_name'],
  academic_semester: ['semester_id', 'semester_number', 'academic_year'],
  subject: ['subject_id', 'subject_code', 'subject_name', 'department_id', 'credits', 'semester_number'],
  timetable: ['subject_id', 'faculty_id', 'section_id', 'day_of_week', 'start_time', 'end_time', 'room_no'],
  attendance_session: ['session_id', 'subject_id', 'faculty_id', 'section_id', 'session_date', 'is_locked'],
  attendance_record: ['session_id', 'student_id', 'attendance_status', 'status', 'marked_at'],
  exam: ['exam_id', 'exam_name', 'semester_id', 'exam_type', 'status'],
  exam_schedule: ['schedule_id', 'exam_id', 'subject_id', 'exam_date', 'start_time', 'end_time', 'room_no', 'max_marks'],
  exam_application: ['app_code', 'student_id', 'type', 'semester_label', 'subject_code', 'submission_date', 'fee_status', 'approval_status'],
  marks: ['student_id', 'schedule_id', 'mid_sem', 'internal_marks', 'end_sem', 'marks_obtained', 'grade_letter', 'grade_point', 'status'],
  result: ['result_id', 'student_id', 'exam_id', 'sgpa', 'cgpa', 'result_date', 'overall_status'],
  fee_structure: ['fee_structure_id', 'department_id', 'semester_id', 'fee_type', 'amount', 'academic_year', 'due_date'],
  student_fee: ['student_fee_id', 'student_id', 'fee_structure_id', 'amount_due', 'scholarship_amount', 'amount_paid', 'balance_amount', 'due_date', 'status', 'invoice_no'],
  payment: ['payment_id', 'student_fee_id', 'amount', 'payment_date', 'payment_mode', 'transaction_reference', 'payment_status', 'status'],
  book: ['isbn', 'title', 'author_id', 'publisher_id', 'category_id', 'total_copies', 'available_copies'],
  book_copy: ['copy_id', 'isbn', 'accession_no', 'status', 'purchase_date'],
  book_issue: ['issue_id', 'student_id', 'copy_id', 'staff_id', 'issue_date', 'due_date', 'issue_status', 'status'],
  book_return: ['return_id', 'issue_id', 'return_date', 'condition_on_return', 'days_late', 'remarks'],
  fine: ['fine_id', 'student_id', 'issue_id', 'fine_type', 'fine_amount', 'fine_date', 'paid_date', 'payment_status', 'paid_status'],
  author: ['author_id', 'author_name'], publisher: ['publisher_id', 'publisher_name'], book_category: ['category_id', 'category_name'],
  company: ['company_id', 'company_name', 'industry_type', 'location', 'website', 'contact_email', 'contact_phone'],
  job_drive: ['drive_id', 'company_id', 'job_role', 'job_type', 'drive_date', 'package_lpa', 'description', 'eligibility_id', 'status'],
  eligibility: ['eligibility_id', 'drive_id', 'allowed_branch', 'minimum_cgpa', 'backlog_allowed'],
  application: ['application_id', 'student_id', 'drive_id', 'application_date', 'status'],
  placement: ['placement_id', 'student_id', 'drive_id', 'application_id', 'job_role', 'package_lpa', 'offer_date', 'joining_date', 'status'],
  announcement: ['announcement_id', 'title', 'description', 'announcement_date', 'posted_by', 'target_branch']
};
// the app copes with either name (it checks which one exists)
const EITHER = { book: [['shelf_location', 'shelf_no']], book_copy: [['condition_status', 'condition']] };

const TRIGGER_EXPECT = {
  payment: 'fn_payment_before / fn_payment_after', marks: 'fn_marks_grade', book_issue: 'fn_book_issue_before/after',
  book_return: 'fn_book_return_before/after', application: 'fn_application_eligibility', attendance_record: 'fn_attendance_check',
  timetable: 'fn_timetable_clash'
};

(async () => {
  let bad = 0;
  for (const [table, cols] of Object.entries(REQUIRED)) {
    const have = await tableColumns(table);
    if (!have.size) { console.log(`MISSING TABLE  ${table}`); bad++; continue; }
    const missing = cols.filter(c => !have.has(c));
    (EITHER[table] || []).forEach(alts => { if (!alts.some(a => have.has(a))) missing.push(alts.join(' | ')); });
    if (missing.length) { console.log(`MISSING COLUMN ${table}: ${missing.join(', ')}`); bad++; }
  }
  const [trg] = await query("SELECT event_object_table AS t, COUNT(*)::int AS n FROM information_schema.triggers WHERE trigger_schema = current_schema() GROUP BY 1");
  const have = Object.fromEntries(trg.map(r => [r.t, r.n]));
  for (const [t, what] of Object.entries(TRIGGER_EXPECT)) if (!have[t]) { console.log(`NO TRIGGER     on ${t} (expected ${what}) - related business rules will not be enforced`); bad++; }
  const [dup] = await query('SELECT COUNT(*)::int AS n FROM (SELECT 1 FROM attendance_record GROUP BY session_id, student_id HAVING COUNT(*) > 1) x').catch(() => [[{ n: '?' }]]);
  if (dup[0].n) console.log(`WARNING        ${dup[0].n} duplicate (session, student) attendance rows`);
  console.log(bad ? `\n${bad} problem(s) found. Run db/migrations/001 and 002, then re-run.` : '\nSchema OK - every table/column the app uses exists.');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('Check failed:', e.message); process.exit(2); });
