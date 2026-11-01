const { query } = require('../server/config/db');

async function createSecondYearStudent() {
  console.log('=== CREATING 2ND YEAR CSE STUDENT IN SUPABASE DATABASE ===\n');

  // 1. Check or Insert Subjects for 2nd Year (Semester 3)
  console.log('[1/10] Checking / Adding Semester 3 CSE Subjects in `subject` and `course`...');
  const sem3Subjects = [
    { code: 'CS201', name: 'Engineering Mathematics III', credits: 4, type: 'Core' },
    { code: 'CS202', name: 'Object Oriented Programming', credits: 4, type: 'Core' },
    { code: 'CS203', name: 'Digital Electronics', credits: 4, type: 'Core' },
    { code: 'CS204', name: 'Discrete Mathematics', credits: 3, type: 'Core' },
    { code: 'CS205', name: 'Computer Organization & Architecture', credits: 4, type: 'Core' }
  ];

  const subjectIdMap = {};

  for (const s of sem3Subjects) {
    // Check subject
    const [existingSub] = await query('SELECT subject_id FROM subject WHERE subject_code = ?', [s.code]);
    if (existingSub.length > 0) {
      subjectIdMap[s.code] = existingSub[0].subject_id;
      console.log(`  Existing subject: ${s.code} -> subject_id ${subjectIdMap[s.code]}`);
    } else {
      const [maxSub] = await query('SELECT COALESCE(MAX(subject_id), 0) + 1 AS next_id FROM subject');
      const nextSubId = maxSub[0].next_id;
      await query(
        `INSERT INTO subject (subject_id, subject_code, subject_name, department_id, credits, semester_number, subject_type)
         VALUES (?, ?, ?, 1, ?, 3, ?)`,
        [nextSubId, s.code, s.name, s.credits, s.type]
      );
      subjectIdMap[s.code] = nextSubId;
      console.log(`  Inserted subject: ${s.code} (${s.name}) -> subject_id ${nextSubId}`);
    }

    // Check course table
    const [existingCourse] = await query('SELECT course_id FROM course WHERE course_code = ?', [s.code]);
    if (existingCourse.length === 0) {
      const [maxCourse] = await query('SELECT COALESCE(MAX(course_id), 0) + 1 AS next_id FROM course');
      const nextCourseId = maxCourse[0].next_id;
      await query(
        `INSERT INTO course (course_id, course_code, course_name, department_id, duration_semesters, course_type, total_credits)
         VALUES (?, ?, ?, 1, 1, ?, ?)`,
        [nextCourseId, s.code, s.name, s.type, s.credits]
      );
      console.log(`  Inserted course: ${s.code} -> course_id ${nextCourseId}`);
    }
  }

  // 2. Check or Insert Section for 2nd Year (Semester 3)
  console.log('\n[2/10] Checking / Adding Section for 2nd Year CSE...');
  let sectionId;
  const [existingSection] = await query("SELECT section_id FROM section WHERE section_name = 'CS-2B'");
  if (existingSection.length > 0) {
    sectionId = existingSection[0].section_id;
    console.log(`  Existing section: CS-2B -> section_id ${sectionId}`);
  } else {
    const [maxSec] = await query('SELECT COALESCE(MAX(section_id), 0) + 1 AS next_id FROM section');
    sectionId = maxSec[0].next_id;
    await query(
      `INSERT INTO section (section_id, department_id, branch, division, section_name, batch_name)
       VALUES (?, 1, 'CS', 2, 'CS-2B', '2025-2029')`,
      [sectionId]
    );
    console.log(`  Inserted section: CS-2B (Batch 2025-2029, Div 2) -> section_id ${sectionId}`);
  }

  // 3. Check or Insert Student Record (Aryan Rajesh Mehta, Roll 21001)
  console.log('\n[3/10] Checking / Adding Student (Aryan Mehta, Roll 21001)...');
  let studentId;
  const [existingStudent] = await query('SELECT student_id FROM student WHERE roll_no = 21001');
  if (existingStudent.length > 0) {
    studentId = existingStudent[0].student_id;
    console.log(`  Existing student found: student_id ${studentId}`);
    await query(
      `UPDATE student
       SET section_id = ?, current_year = 2, current_semester = 3, batch_year = 2025, admission_year = 2025
       WHERE student_id = ?`,
      [sectionId, studentId]
    );
  } else {
    const [maxStudent] = await query('SELECT COALESCE(MAX(student_id), 0) + 1 AS next_id FROM student');
    studentId = maxStudent[0].next_id;
    await query(
      `INSERT INTO student (
        student_id, prn, roll_no, student_name, first_name, middle_name, last_name,
        email, phone, branch, department_id, section_id, division, batch_year,
        current_year, current_semester, dob, gender, category, admission_year, admission_status
      ) VALUES (
        ?, 'F25CE001', 21001, 'Aryan Rajesh Mehta', 'Aryan', 'Rajesh', 'Mehta',
        'f25ce001@student.example.edu', '9822012345', 'CS', 1, ?, 2, 2025,
        2, 3, '2007-05-12', 'Male', 'OPEN', 2025, 'Active'
      )`,
      [studentId, sectionId]
    );
    console.log(`  Inserted student: Aryan Rajesh Mehta (Roll: 21001, PRN: F25CE001) -> student_id ${studentId}`);
  }

  // 4. Check or Insert Student Credentials (which automatically populates user_account view)
  console.log('\n[4/10] Checking / Adding student_credentials for 21001...');
  const [existingCred] = await query('SELECT student_id FROM student_credentials WHERE student_id = ?', [studentId]);
  if (existingCred.length === 0) {
    await query(
      `INSERT INTO student_credentials (
        student_id, roll_no, student_name, department, section, current_semester,
        login_email, primary_password, backup_password, model_status, created_at
      ) VALUES (
        ?, 21001, 'Aryan Rajesh Mehta', 'Computer Science', 'CS-2B', 3,
        'f25ce001@student.example.edu', 'Aryan@21001', 'Student@2026', 'Active Running Model', NOW()
      )`,
      [studentId]
    );
    console.log(`  Inserted student_credentials for student_id ${studentId}`);
  } else {
    await query(
      `UPDATE student_credentials
       SET primary_password = 'Aryan@21001', roll_no = 21001, section = 'CS-2B', current_semester = 3
       WHERE student_id = ?`,
      [studentId]
    );
    console.log(`  Updated student_credentials for student_id ${studentId}`);
  }

  // Verify user_account view reflection
  const [uaCheck] = await query("SELECT user_id, identifier, email, role FROM user_account WHERE identifier = '21001'");
  console.log('  user_account view reflection:', uaCheck[0]);

  // 6. Auxiliary records: address, contact, guardian, academic history
  console.log('\n[6/10] Checking / Adding Student Demographics & History...');
  const [hasAddr] = await query('SELECT address_id FROM student_address WHERE student_id = ?', [studentId]);
  if (hasAddr.length === 0) {
    const [maxAddr] = await query('SELECT COALESCE(MAX(address_id), 0) + 1 AS next_id FROM student_address');
    await query(
      `INSERT INTO student_address (address_id, student_id, address_type, street_address, city, state, pincode)
       VALUES (?, ?, 'Permanent', '402 Shanti Niketan, FC Road', 'Pune', 'Maharashtra', '411004')`,
      [maxAddr[0].next_id, studentId]
    );
  }

  const [hasContact] = await query('SELECT contact_id FROM student_contact WHERE student_id = ?', [studentId]);
  if (hasContact.length === 0) {
    const [maxContact] = await query('SELECT COALESCE(MAX(contact_id), 0) + 1 AS next_id FROM student_contact');
    await query(
      `INSERT INTO student_contact (contact_id, student_id, mobile_number, alternate_mobile, personal_email, institute_email)
       VALUES (?, ?, '9822012345', '9822098765', 'aryan.mehta@example.com', 'f25ce001@student.example.edu')`,
      [maxContact[0].next_id, studentId]
    );
  }

  const [hasGuardian] = await query('SELECT guardian_id FROM guardian_details WHERE student_id = ?', [studentId]);
  if (hasGuardian.length === 0) {
    const [maxGuardian] = await query('SELECT COALESCE(MAX(guardian_id), 0) + 1 AS next_id FROM guardian_details');
    await query(
      `INSERT INTO guardian_details (guardian_id, student_id, guardian_name, relation, occupation, contact_number, email)
       VALUES (?, ?, 'Rajesh Mehta', 'Father', 'Software Architect', '9822055555', 'rajesh.mehta@example.com')`,
      [maxGuardian[0].next_id, studentId]
    );
  }

  const [hasHistory] = await query('SELECT history_id FROM academic_history WHERE student_id = ?', [studentId]);
  if (hasHistory.length === 0) {
    const [maxHist] = await query('SELECT COALESCE(MAX(history_id), 0) + 1 AS next_id FROM academic_history');
    await query(
      `INSERT INTO academic_history (history_id, student_id, qualification_level, institute_name, board_university, passing_year, percentage_gpa)
       VALUES (?, ?, 'HSC/12th', 'Fergusson Junior College', 'Maharashtra State Board', 2025, '88.50')`,
      [maxHist[0].next_id, studentId]
    );
  }
  console.log('  Demographics & address configured successfully.');

  // 7. Student Subject Enrollments (CS201 - CS205)
  console.log('\n[7/10] Enrolling Student in Sem 3 Subjects...');
  for (const s of sem3Subjects) {
    const subId = subjectIdMap[s.code];
    const [existingEnr] = await query(
      'SELECT enrollment_id FROM student_subject_enrollment WHERE student_id = ? AND subject_id = ? AND semester_id = 3',
      [studentId, subId]
    );
    if (existingEnr.length === 0) {
      const [maxEnr] = await query('SELECT COALESCE(MAX(enrollment_id), 0) + 1 AS next_id FROM student_subject_enrollment');
      await query(
        `INSERT INTO student_subject_enrollment (enrollment_id, student_id, subject_id, semester_id, enrollment_date, status)
         VALUES (?, ?, ?, 3, '2026-07-15', 'Enrolled')`,
        [maxEnr[0].next_id, studentId, subId]
      );
      console.log(`  Enrolled in ${s.code} -> enrollment_id ${maxEnr[0].next_id}`);
    }
  }

  // 8. Timetable for Section 21 (CS-2B)
  console.log('\n[8/10] Generating Timetable for 2nd Year (CS-2B)...');
  const [existingTT] = await query('SELECT COUNT(*) as count FROM timetable WHERE section_id = ?', [sectionId]);
  if (Number(existingTT[0].count) === 0) {
    // Timetable entries: Monday to Saturday
    const ttEntries = [
      // Monday
      { day: 'Monday', start: '09:00:00', end: '10:00:00', sub: 'CS201', fac: 41, room: 'AB-201' },
      { day: 'Monday', start: '10:15:00', end: '11:15:00', sub: 'CS202', fac: 31, room: 'AB-201' },
      { day: 'Monday', start: '11:15:00', end: '12:15:00', sub: 'CS203', fac: 51, room: 'AB-201' },
      { day: 'Monday', start: '13:15:00', end: '15:15:00', sub: 'CS202', fac: 31, room: 'CS-Lab-B' },
      // Tuesday
      { day: 'Tuesday', start: '09:00:00', end: '10:00:00', sub: 'CS204', fac: 26, room: 'AB-202' },
      { day: 'Tuesday', start: '10:15:00', end: '11:15:00', sub: 'CS205', fac: 16, room: 'AB-202' },
      { day: 'Tuesday', start: '11:15:00', end: '12:15:00', sub: 'CS202', fac: 31, room: 'AB-202' },
      { day: 'Tuesday', start: '13:15:00', end: '15:15:00', sub: 'CS203', fac: 51, room: 'CS-Lab-A' },
      // Wednesday
      { day: 'Wednesday', start: '09:00:00', end: '10:00:00', sub: 'CS205', fac: 16, room: 'AB-201' },
      { day: 'Wednesday', start: '10:15:00', end: '11:15:00', sub: 'CS201', fac: 41, room: 'AB-201' },
      { day: 'Wednesday', start: '11:15:00', end: '12:15:00', sub: 'CS204', fac: 26, room: 'AB-201' },
      { day: 'Wednesday', start: '13:15:00', end: '15:15:00', sub: 'CS205', fac: 16, room: 'CS-Lab-B' },
      // Thursday
      { day: 'Thursday', start: '09:00:00', end: '10:00:00', sub: 'CS203', fac: 51, room: 'AB-201' },
      { day: 'Thursday', start: '10:15:00', end: '11:15:00', sub: 'CS205', fac: 16, room: 'AB-201' },
      { day: 'Thursday', start: '11:15:00', end: '12:15:00', sub: 'CS201', fac: 41, room: 'AB-201' },
      { day: 'Thursday', start: '13:15:00', end: '15:15:00', sub: 'CS202', fac: 31, room: 'Proj-Lab' },
      // Friday
      { day: 'Friday', start: '09:00:00', end: '10:00:00', sub: 'CS202', fac: 31, room: 'AB-201' },
      { day: 'Friday', start: '10:15:00', end: '11:15:00', sub: 'CS201', fac: 41, room: 'AB-201' },
      { day: 'Friday', start: '11:15:00', end: '12:15:00', sub: 'CS203', fac: 51, room: 'AB-201' },
      { day: 'Friday', start: '13:15:00', end: '15:15:00', sub: 'CS204', fac: 26, room: 'AB-201' },
      // Saturday
      { day: 'Saturday', start: '09:00:00', end: '10:00:00', sub: 'CS202', fac: 31, room: 'CS-Lab-B' },
      { day: 'Saturday', start: '10:15:00', end: '11:15:00', sub: 'CS205', fac: 1, room: 'Auditorium' },
      { day: 'Saturday', start: '11:15:00', end: '12:15:00', sub: 'CS204', fac: 26, room: 'AB-202' }
    ];

    let [maxTT] = await query('SELECT COALESCE(MAX(timetable_id), 0) AS next_id FROM timetable');
    let curTTId = maxTT[0].next_id;

    for (const entry of ttEntries) {
      curTTId++;
      await query(
        `INSERT INTO timetable (timetable_id, section_id, subject_id, faculty_id, day_of_week, start_time, end_time, room_no, semester_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 3)`,
        [curTTId, sectionId, subjectIdMap[entry.sub], entry.fac, entry.day, entry.start, entry.end, entry.room]
      );
    }
    console.log(`  Inserted ${ttEntries.length} timetable entries for Section CS-2B!`);
  } else {
    console.log(`  Section CS-2B already has ${existingTT[0].count} timetable entries.`);
  }

  // 9. Attendance Sessions & Records
  console.log('\n[9/10] Generating Attendance Sessions & Records...');
  const [existingAtt] = await query('SELECT COUNT(*) as count FROM attendance_record WHERE student_id = ?', [studentId]);
  if (Number(existingAtt[0].count) === 0) {
    // Generate ~20 attendance sessions across past 4 weeks
    const sessionDates = [
      '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09',
      '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16',
      '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23',
      '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'
    ];

    let [maxSess] = await query('SELECT COALESCE(MAX(session_id), 0) AS next_id FROM attendance_session');
    let [maxAtt] = await query('SELECT COALESCE(MAX(attendance_id), 0) AS next_id FROM attendance_record');
    let curSessId = maxSess[0].next_id;
    let curAttId = maxAtt[0].next_id;

    const subCodes = ['CS201', 'CS202', 'CS203', 'CS204', 'CS205'];
    const subFaculty = { CS201: 41, CS202: 31, CS203: 51, CS204: 26, CS205: 16 };

    for (let i = 0; i < sessionDates.length; i++) {
      const date = sessionDates[i];
      const code = subCodes[i % subCodes.length];
      const subId = subjectIdMap[code];
      const facId = subFaculty[code];
      curSessId++;
      curAttId++;

      // 85% attendance: attend most, miss every 7th class
      const isPresent = i % 7 !== 2;
      const status = isPresent ? 'Present' : 'Absent';

      await query(
        `INSERT INTO attendance_session (session_id, section_id, subject_id, faculty_id, session_date, period_no, topic, period, created_at, topic_covered, is_locked)
         VALUES (?, ?, ?, ?, ?, 1, ?, '1', NOW(), ?, false)`,
        [curSessId, sectionId, subId, facId, date, `${code} Lecture Session`, `${code} Core Topics`]
      );

      await query(
        `INSERT INTO attendance_record (attendance_id, session_id, student_id, attendance_status, marked_at, status)
         VALUES (?, ?, ?, ?, NOW(), ?)`,
        [curAttId, curSessId, studentId, status, status]
      );
    }
    console.log(`  Inserted ${sessionDates.length} attendance sessions & records (attendance ~85%)`);
  } else {
    console.log(`  Student already has ${existingAtt[0].count} attendance records.`);
  }

  // 10. Fees, Results, Library, Exams
  console.log('\n[10/10] Checking Fees, Results, Library & Exams...');

  // Fee Structure & Student Fee
  const [existingFee] = await query('SELECT student_fee_id FROM student_fee WHERE student_id = ?', [studentId]);
  if (existingFee.length === 0) {
    // Check fee structure for sem 3
    let feeStructId;
    const [fs] = await query('SELECT fee_structure_id FROM fee_structure WHERE department_id = 1 AND semester_id = 3');
    if (fs.length > 0) {
      feeStructId = fs[0].fee_structure_id;
    } else {
      const [maxFs] = await query('SELECT COALESCE(MAX(fee_structure_id), 0) + 1 AS next_id FROM fee_structure');
      feeStructId = maxFs[0].next_id;
      await query(
        `INSERT INTO fee_structure (fee_structure_id, department_id, semester_id, fee_type, amount, academic_year, due_date, course_id)
         VALUES (?, 1, 3, 'Tuition', 65000.00, '2026-2027', '2026-12-30', 1)`,
        [feeStructId]
      );
    }

    const [maxSF] = await query('SELECT COALESCE(MAX(student_fee_id), 0) + 1 AS next_id FROM student_fee');
    await query(
      `INSERT INTO student_fee (student_fee_id, student_id, fee_structure_id, scholarship_id, amount_due, scholarship_amount, amount_paid, balance_amount, status, due_date, invoice_no)
       VALUES (?, ?, ?, null, 65000.00, 0.00, 65000.00, 0.00, 'Paid', '2026-12-30', 'INV-2026-F25001')`,
      [maxSF[0].next_id, studentId, feeStructId]
    );
    console.log('  Configured student_fee: Paid ₹65,000 for Semester 3');
  }

  // Result for previous semester (Semester 2)
  const [existingRes] = await query('SELECT result_id FROM result WHERE student_id = ?', [studentId]);
  if (existingRes.length === 0) {
    const [maxRes] = await query('SELECT COALESCE(MAX(result_id), 0) + 1 AS next_id FROM result');
    await query(
      `INSERT INTO result (result_id, student_id, exam_id, sgpa, cgpa, result_date, overall_status)
       VALUES (?, ?, 6, 7.85, 7.62, '2026-06-15', 'PASS')`,
      [maxRes[0].next_id, studentId]
    );
    console.log('  Configured result: Sem 2 SGPA 7.85, CGPA 7.62 (PASS)');
  }

  // Library active loan
  const [existingBook] = await query('SELECT issue_id FROM book_issue WHERE student_id = ?', [studentId]);
  if (existingBook.length === 0) {
    const [maxIssue] = await query('SELECT COALESCE(MAX(issue_id), 0) + 1 AS next_id FROM book_issue');
    await query(
      `INSERT INTO book_issue (issue_id, student_id, copy_id, staff_id, issue_date, due_date, issue_status, status)
       VALUES (?, ?, 1, 1, '2026-10-25', '2026-11-15', 'Issued', 'Issued')`,
      [maxIssue[0].next_id, studentId]
    );
    console.log('  Configured library book issue: Issued copy 1 (Due 15-Nov-2026)');
  }

  // Exam Application
  const [existingExamApp] = await query('SELECT application_id FROM exam_application WHERE student_id = ?', [studentId]);
  if (existingExamApp.length === 0) {
    const [maxApp] = await query('SELECT COALESCE(MAX(application_id), 0) + 1 AS next_id FROM exam_application');
    await query(
      `INSERT INTO exam_application (application_id, app_code, student_id, type, semester_label, subject_code, submission_date, fee_status, approval_status, remarks, created_at)
       VALUES (?, 'EX-APP-21001', ?, 'Regular Semester Exam', 'Semester 3 (Autumn 2026)', null, '2026-10-20', 'Paid', 'Approved', null, NOW())`,
      [maxApp[0].next_id, studentId]
    );
    console.log('  Configured exam_application: Semester 3 Regular Exam (Approved)');
  }

  // Exam Schedules for Sem 3 Subjects (for Exam 1 and Exam 6)
  for (const s of sem3Subjects) {
    const subId = subjectIdMap[s.code];
    const [existingSched] = await query('SELECT schedule_id FROM exam_schedule WHERE subject_id = ?', [subId]);
    if (existingSched.length === 0) {
      const [maxSched] = await query('SELECT COALESCE(MAX(schedule_id), 0) + 1 AS next_id FROM exam_schedule');
      await query(
        `INSERT INTO exam_schedule (schedule_id, exam_id, subject_id, exam_date, start_time, end_time, room_no, max_marks)
         VALUES (?, 6, ?, '2026-11-15', '10:00:00', '13:00:00', 'EX-201', 100)`,
        [maxSched[0].next_id, subId]
      );
      console.log(`  Configured exam_schedule for ${s.code} -> schedule_id ${maxSched[0].next_id}`);
    }
  }

  console.log('\n=== ALL DATABASE OPERATIONS COMPLETED SUCCESSFULLY! ===\n');
}

createSecondYearStudent()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('ERROR:', e);
    process.exit(1);
  });
