const { query } = require('../server/config/db');

async function setupSem1AndSem2Results() {
  console.log('=== SETTING UP SEMESTER 1 & 2 RESULTS & MARKS IN SUPABASE ===\n');

  // 1. Define distinct subjects for Semester 1 and Semester 2
  const sem1Subjects = [
    { code: 'CS101', name: 'Engineering Mathematics I', credits: 4, type: 'Core' },
    { code: 'CS102', name: 'Applied Physics', credits: 4, type: 'Core' },
    { code: 'CS103', name: 'Basic Electrical & Electronics Engineering', credits: 4, type: 'Core' },
    { code: 'CS104', name: 'Problem Solving & C Programming', credits: 4, type: 'Core' },
    { code: 'CS105', name: 'Engineering Graphics & CAD', credits: 4, type: 'Core' }
  ];

  const sem2Subjects = [
    { code: 'CS106', name: 'Engineering Mathematics II', credits: 4, type: 'Core' },
    { code: 'CS107', name: 'Data Structures & Algorithms Fundamentals', credits: 4, type: 'Core' },
    { code: 'CS108', name: 'Object-Oriented Programming using C++', credits: 4, type: 'Core' },
    { code: 'CS109', name: 'Digital Logic & Processor Basics', credits: 4, type: 'Core' },
    { code: 'CS110', name: 'Environmental Science & Green Computing', credits: 4, type: 'Core' }
  ];

  const subjectMap = {};

  // Insert Semester 1 Subjects
  console.log('[1/7] Adding Semester 1 CSE Subjects...');
  for (const s of sem1Subjects) {
    const [existing] = await query('SELECT subject_id FROM subject WHERE subject_code = ?', [s.code]);
    if (existing.length > 0) {
      subjectMap[s.code] = existing[0].subject_id;
      console.log(`  Existing subject: ${s.code} -> subject_id ${subjectMap[s.code]}`);
    } else {
      const [maxSub] = await query('SELECT COALESCE(MAX(subject_id), 0) + 1 AS next_id FROM subject');
      const nextId = maxSub[0].next_id;
      await query(
        `INSERT INTO subject (subject_id, subject_code, subject_name, department_id, credits, semester_number, subject_type)
         VALUES (?, ?, ?, 1, ?, 1, ?)`,
        [nextId, s.code, s.name, s.credits, s.type]
      );
      subjectMap[s.code] = nextId;
      console.log(`  Inserted subject: ${s.code} (${s.name}) -> subject_id ${nextId}`);
    }

    // Course table
    const [existingCourse] = await query('SELECT course_id FROM course WHERE course_code = ?', [s.code]);
    if (existingCourse.length === 0) {
      const [maxC] = await query('SELECT COALESCE(MAX(course_id), 0) + 1 AS next_id FROM course');
      await query(
        `INSERT INTO course (course_id, course_code, course_name, department_id, duration_semesters, course_type, total_credits)
         VALUES (?, ?, ?, 1, 1, ?, ?)`,
        [maxC[0].next_id, s.code, s.name, s.type, s.credits]
      );
    }
  }

  // Insert Semester 2 Subjects
  console.log('\n[2/7] Adding Semester 2 CSE Subjects (Completely Different)...');
  for (const s of sem2Subjects) {
    const [existing] = await query('SELECT subject_id FROM subject WHERE subject_code = ?', [s.code]);
    if (existing.length > 0) {
      subjectMap[s.code] = existing[0].subject_id;
      console.log(`  Existing subject: ${s.code} -> subject_id ${subjectMap[s.code]}`);
    } else {
      const [maxSub] = await query('SELECT COALESCE(MAX(subject_id), 0) + 1 AS next_id FROM subject');
      const nextId = maxSub[0].next_id;
      await query(
        `INSERT INTO subject (subject_id, subject_code, subject_name, department_id, credits, semester_number, subject_type)
         VALUES (?, ?, ?, 1, ?, 2, ?)`,
        [nextId, s.code, s.name, s.credits, s.type]
      );
      subjectMap[s.code] = nextId;
      console.log(`  Inserted subject: ${s.code} (${s.name}) -> subject_id ${nextId}`);
    }

    // Course table
    const [existingCourse] = await query('SELECT course_id FROM course WHERE course_code = ?', [s.code]);
    if (existingCourse.length === 0) {
      const [maxC] = await query('SELECT COALESCE(MAX(course_id), 0) + 1 AS next_id FROM course');
      await query(
        `INSERT INTO course (course_id, course_code, course_name, department_id, duration_semesters, course_type, total_credits)
         VALUES (?, ?, ?, 1, 1, ?, ?)`,
        [maxC[0].next_id, s.code, s.name, s.type, s.credits]
      );
    }
  }

  // 2. Exams for Semester 1 and Semester 2
  console.log('\n[3/7] Setting up Exam records for Semester 1 & Semester 2...');
  let exam1Id, exam2Id;

  // Sem 1 Exam
  const [ex1] = await query("SELECT exam_id FROM exam WHERE exam_name = 'End-Semester Examination (Sem 1)' AND semester_id = 1");
  if (ex1.length > 0) {
    exam1Id = ex1[0].exam_id;
    console.log(`  Existing Sem 1 Exam -> exam_id ${exam1Id}`);
  } else {
    const [maxE] = await query('SELECT COALESCE(MAX(exam_id), 0) + 1 AS next_id FROM exam');
    exam1Id = maxE[0].next_id;
    await query(
      `INSERT INTO exam (exam_id, exam_name, semester_id, academic_year, exam_type, exam_date, status)
       VALUES (?, 'End-Semester Examination (Sem 1)', 1, '2025-2026', 'Theory', '2025-12-15', 'Completed')`,
      [exam1Id]
    );
    console.log(`  Inserted Sem 1 Exam -> exam_id ${exam1Id}`);
  }

  // Sem 2 Exam
  const [ex2] = await query("SELECT exam_id FROM exam WHERE exam_name = 'End-Semester Examination (Sem 2)' AND semester_id = 2");
  if (ex2.length > 0) {
    exam2Id = ex2[0].exam_id;
    console.log(`  Existing Sem 2 Exam -> exam_id ${exam2Id}`);
  } else {
    const [maxE] = await query('SELECT COALESCE(MAX(exam_id), 0) + 1 AS next_id FROM exam');
    exam2Id = maxE[0].next_id;
    await query(
      `INSERT INTO exam (exam_id, exam_name, semester_id, academic_year, exam_type, exam_date, status)
       VALUES (?, 'End-Semester Examination (Sem 2)', 2, '2025-2026', 'Theory', '2026-05-20', 'Completed')`,
      [exam2Id]
    );
    console.log(`  Inserted Sem 2 Exam -> exam_id ${exam2Id}`);
  }

  // 3. Exam Schedule for each Sem 1 & Sem 2 subject
  console.log('\n[4/7] Setting up Exam Schedules for all 10 subjects...');
  const scheduleMap = {};

  for (const s of sem1Subjects) {
    const subId = subjectMap[s.code];
    const [existing] = await query('SELECT schedule_id FROM exam_schedule WHERE exam_id = ? AND subject_id = ?', [exam1Id, subId]);
    if (existing.length > 0) {
      scheduleMap[s.code] = existing[0].schedule_id;
    } else {
      const [maxS] = await query('SELECT COALESCE(MAX(schedule_id), 0) + 1 AS next_id FROM exam_schedule');
      scheduleMap[s.code] = maxS[0].next_id;
      await query(
        `INSERT INTO exam_schedule (schedule_id, exam_id, subject_id, exam_date, start_time, end_time, room_no, max_marks)
         VALUES (?, ?, ?, '2025-12-15', '10:00:00', '13:00:00', 'EX-101', 100)`,
        [scheduleMap[s.code], exam1Id, subId]
      );
    }
  }

  for (const s of sem2Subjects) {
    const subId = subjectMap[s.code];
    const [existing] = await query('SELECT schedule_id FROM exam_schedule WHERE exam_id = ? AND subject_id = ?', [exam2Id, subId]);
    if (existing.length > 0) {
      scheduleMap[s.code] = existing[0].schedule_id;
    } else {
      const [maxS] = await query('SELECT COALESCE(MAX(schedule_id), 0) + 1 AS next_id FROM exam_schedule');
      scheduleMap[s.code] = maxS[0].next_id;
      await query(
        `INSERT INTO exam_schedule (schedule_id, exam_id, subject_id, exam_date, start_time, end_time, room_no, max_marks)
         VALUES (?, ?, ?, '2026-05-20', '10:00:00', '13:00:00', 'EX-102', 100)`,
        [scheduleMap[s.code], exam2Id, subId]
      );
    }
  }
  console.log('  Exam schedules verified.');

  // 4. Enroll Aryan (student 1022) in Sem 1 and Sem 2 subjects
  console.log('\n[5/7] Enrolling Aryan (student_id: 1022) in Sem 1 & Sem 2 subjects...');
  const studentId = 1022;

  for (const s of sem1Subjects) {
    const subId = subjectMap[s.code];
    const [ex] = await query('SELECT enrollment_id FROM student_subject_enrollment WHERE student_id = ? AND subject_id = ?', [studentId, subId]);
    if (ex.length === 0) {
      const [maxE] = await query('SELECT COALESCE(MAX(enrollment_id), 0) + 1 AS next_id FROM student_subject_enrollment');
      await query(
        `INSERT INTO student_subject_enrollment (enrollment_id, student_id, subject_id, semester_id, enrollment_date, status)
         VALUES (?, ?, ?, 1, '2025-07-20', 'Completed')`,
        [maxE[0].next_id, studentId, subId]
      );
    }
  }

  for (const s of sem2Subjects) {
    const subId = subjectMap[s.code];
    const [ex] = await query('SELECT enrollment_id FROM student_subject_enrollment WHERE student_id = ? AND subject_id = ?', [studentId, subId]);
    if (ex.length === 0) {
      const [maxE] = await query('SELECT COALESCE(MAX(enrollment_id), 0) + 1 AS next_id FROM student_subject_enrollment');
      await query(
        `INSERT INTO student_subject_enrollment (enrollment_id, student_id, subject_id, semester_id, enrollment_date, status)
         VALUES (?, ?, ?, 2, '2026-01-15', 'Completed')`,
        [maxE[0].next_id, studentId, subId]
      );
    }
  }
  console.log('  Subject enrollments completed.');

  // 5. Component Marks for Aryan
  console.log('\n[6/7] Adding Subject Marks for Aryan (Sem 1 & Sem 2)...');

  // Semester 1 Marks (Out of 20, 20, 60 = 100) -> SGPA: 7.55
  const sem1MarksData = [
    { code: 'CS101', mid: 17.5, int: 18.0, end: 52.5, max: 100 }, // 88 (A+, 9.0)
    { code: 'CS102', mid: 16.0, int: 16.5, end: 49.5, max: 100 }, // 82 (A, 8.0)
    { code: 'CS103', mid: 14.5, int: 15.5, end: 45.0, max: 100 }, // 75 (B+, 7.0)
    { code: 'CS104', mid: 18.5, int: 19.0, end: 55.5, max: 100 }, // 93 (O, 10.0)
    { code: 'CS105', mid: 15.5, int: 16.5, end: 47.0, max: 100 }  // 79 (A, 8.0)
  ];

  // Semester 2 Marks (Out of 20, 20, 60 = 100) -> SGPA: 7.85
  const sem2MarksData = [
    { code: 'CS106', mid: 17.0, int: 17.5, end: 50.5, max: 100 }, // 85 (A+, 9.0)
    { code: 'CS107', mid: 18.0, int: 19.0, end: 54.0, max: 100 }, // 91 (O, 10.0)
    { code: 'CS108', mid: 17.0, int: 18.0, end: 52.0, max: 100 }, // 87 (A+, 9.0)
    { code: 'CS109', mid: 15.5, int: 16.5, end: 46.0, max: 100 }, // 78 (A, 8.0)
    { code: 'CS110', mid: 16.5, int: 17.5, end: 49.0, max: 100 }  // 83 (A, 8.0)
  ];

  const allMarks = [...sem1MarksData, ...sem2MarksData];

  for (const item of allMarks) {
    const schedId = scheduleMap[item.code];
    const [existingMark] = await query('SELECT mark_id FROM marks WHERE student_id = ? AND schedule_id = ?', [studentId, schedId]);
    if (existingMark.length > 0) {
      await query(
        `UPDATE marks
         SET mid_sem = ?, internal_marks = ?, end_sem = ?, max_marks = ?
         WHERE mark_id = ?`,
        [item.mid, item.int, item.end, item.max, existingMark[0].mark_id]
      );
      console.log(`  Updated mark for ${item.code}`);
    } else {
      const [maxM] = await query('SELECT COALESCE(MAX(mark_id), 0) + 1 AS next_id FROM marks');
      await query(
        `INSERT INTO marks (mark_id, schedule_id, student_id, mid_sem, internal_marks, end_sem, max_marks)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [maxM[0].next_id, schedId, studentId, item.mid, item.int, item.end, item.max]
      );
      console.log(`  Inserted mark for ${item.code} -> mark_id ${maxM[0].next_id}`);
    }
  }

  // 6. Setup Semester Results in `result` table
  console.log('\n[7/7] Configuring Result table for Semester 1 & Semester 2...');

  // Remove invalid Semester 5 result for Aryan (exam_id = 6)
  await query('DELETE FROM result WHERE student_id = ? AND exam_id = 6', [studentId]);
  console.log('  Cleaned up invalid Semester 5 result for Aryan.');

  // Semester 1 Result (Credits: 20, Points: 166.8 -> SGPA: 8.34, CGPA: 8.34)
  const [res1] = await query('SELECT result_id FROM result WHERE student_id = ? AND exam_id = ?', [studentId, exam1Id]);
  if (res1.length > 0) {
    await query(
      `UPDATE result
       SET sgpa = 8.34, cgpa = 8.34, result_date = '2026-01-12', overall_status = 'PASS'
       WHERE result_id = ?`,
      [res1[0].result_id]
    );
    console.log(`  Updated Result for Sem 1 -> result_id ${res1[0].result_id} (SGPA: 8.34, CGPA: 8.34)`);
  } else {
    const [maxR] = await query('SELECT COALESCE(MAX(result_id), 0) + 1 AS next_id FROM result');
    await query(
      `INSERT INTO result (result_id, student_id, exam_id, sgpa, cgpa, result_date, overall_status)
       VALUES (?, ?, ?, 8.34, 8.34, '2026-01-12', 'PASS')`,
      [maxR[0].next_id, studentId, exam1Id]
    );
    console.log(`  Inserted Result for Sem 1 -> result_id ${maxR[0].next_id} (SGPA: 8.34, CGPA: 8.34)`);
  }

  // Semester 2 Result (Credits: 20, Points: 169.6 -> SGPA: 8.48, Combined CGPA: 336.4 / 40 = 8.41)
  const [res2] = await query('SELECT result_id FROM result WHERE student_id = ? AND exam_id = ?', [studentId, exam2Id]);
  if (res2.length > 0) {
    await query(
      `UPDATE result
       SET sgpa = 8.48, cgpa = 8.41, result_date = '2026-06-18', overall_status = 'PASS'
       WHERE result_id = ?`,
      [res2[0].result_id]
    );
    console.log(`  Updated Result for Sem 2 -> result_id ${res2[0].result_id} (SGPA: 8.48, CGPA: 8.41)`);
  } else {
    const [maxR] = await query('SELECT COALESCE(MAX(result_id), 0) + 1 AS next_id FROM result');
    await query(
      `INSERT INTO result (result_id, student_id, exam_id, sgpa, cgpa, result_date, overall_status)
       VALUES (?, ?, ?, 8.48, 8.41, '2026-06-18', 'PASS')`,
      [maxR[0].next_id, studentId, exam2Id]
    );
    console.log(`  Inserted Result for Sem 2 -> result_id ${maxR[0].next_id} (SGPA: 8.48, CGPA: 8.41)`);
  }

  console.log('\n=== SEMESTER 1 & 2 RESULTS & MARKS CONFIGURED SUCCESSFULLY! ===\n');
}

setupSem1AndSem2Results()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('ERROR:', e);
    process.exit(1);
  });
