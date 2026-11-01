/**
 * University ERP - Shared Frontend Examination & Grading Store
 * 
 * Provides synchronized, reactive mock data shared between FacultyGradingPage
 * and StudentResultPage without requiring an active database connection.
 * Persists changes in localStorage so updates survive page reloads and portal switching.
 */

export interface ExamComponentLimits {
  mid_sem_max: 20;
  internal_max: 20;
  end_sem_max: 60;
  total_max: 100;
}

export const COMPONENT_LIMITS: ExamComponentLimits = {
  mid_sem_max: 20,
  internal_max: 20,
  end_sem_max: 60,
  total_max: 100
};

export interface ExamScheduleItem {
  schedule_id: number;
  exam_id: number;
  exam_name: string;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  semester_number: number;
  semester_label: string;
  academic_year: string;
  credits: number;
  exam_date: string;
}

export interface StudentMarkRecord {
  student_id: number;
  roll_no: string;
  name: string;
  schedule_id: number;
  subject_code: string;
  subject_name: string;
  semester_number: number;
  credits: number;
  mid_sem: number;       // Max: 20
  internal_marks: number;// Max: 20
  end_sem: number;       // Max: 60
  total_marks: number;   // Max: 100 (mid_sem + internal_marks + end_sem)
  grade_letter: string;
  grade_point: number;
  status: 'Pass' | 'Fail';
}

export interface SemesterResultSummary {
  result_id: number;
  semester_id: number;
  semester_number: number;
  semester_label: string;
  academic_year: string;
  sgpa: number;
  cgpa: number;
  overall_status: 'Pass' | 'Fail';
  result_date: string;
}

export function computeGrade(total: number): { letter: string; point: number; status: 'Pass' | 'Fail' } {
  const rounded = Math.round(total * 10) / 10;
  if (rounded >= 90) return { letter: 'O', point: 10.0, status: 'Pass' };
  if (rounded >= 80) return { letter: 'A+', point: 9.0, status: 'Pass' };
  if (rounded >= 70) return { letter: 'A', point: 8.0, status: 'Pass' };
  if (rounded >= 60) return { letter: 'B+', point: 7.0, status: 'Pass' };
  if (rounded >= 50) return { letter: 'B', point: 6.0, status: 'Pass' };
  if (rounded >= 40) return { letter: 'C', point: 5.0, status: 'Pass' };
  return { letter: 'F', point: 0.0, status: 'Fail' };
}

// Default initial exam schedules across semesters
const DEFAULT_SCHEDULES: ExamScheduleItem[] = [
  {
    schedule_id: 101,
    exam_id: 1,
    exam_name: 'Regular End-Semester Examination Autumn 2026',
    subject_id: 1,
    subject_code: 'CS302',
    subject_name: 'Database Management Systems',
    semester_number: 5,
    semester_label: 'Semester 5 (Autumn 2026)',
    academic_year: '2026-27',
    credits: 4,
    exam_date: '2026-11-12'
  },
  {
    schedule_id: 102,
    exam_id: 1,
    exam_name: 'Regular End-Semester Examination Autumn 2026',
    subject_id: 2,
    subject_code: 'CS301',
    subject_name: 'Data Structures & Algorithms',
    semester_number: 5,
    semester_label: 'Semester 5 (Autumn 2026)',
    academic_year: '2026-27',
    credits: 4,
    exam_date: '2026-11-15'
  },
  {
    schedule_id: 103,
    exam_id: 1,
    exam_name: 'Regular End-Semester Examination Autumn 2026',
    subject_id: 3,
    subject_code: 'CS303',
    subject_name: 'Computer Networks',
    semester_number: 5,
    semester_label: 'Semester 5 (Autumn 2026)',
    academic_year: '2026-27',
    credits: 4,
    exam_date: '2026-11-18'
  },
  {
    schedule_id: 104,
    exam_id: 1,
    exam_name: 'Regular End-Semester Examination Autumn 2026',
    subject_id: 4,
    subject_code: 'CS304',
    subject_name: 'Theory of Computation',
    semester_number: 5,
    semester_label: 'Semester 5 (Autumn 2026)',
    academic_year: '2026-27',
    credits: 4,
    exam_date: '2026-11-21'
  },
  {
    schedule_id: 105,
    exam_id: 1,
    exam_name: 'Regular End-Semester Examination Autumn 2026',
    subject_id: 5,
    subject_code: 'CS305',
    subject_name: 'Software Engineering & Agile',
    semester_number: 5,
    semester_label: 'Semester 5 (Autumn 2026)',
    academic_year: '2026-27',
    credits: 3,
    exam_date: '2026-11-24'
  },
  // Semester 3 schedules for demo parity
  {
    schedule_id: 201,
    exam_id: 2,
    exam_name: 'Regular Semester Examination Autumn 2025',
    subject_id: 6,
    subject_code: 'CS201',
    subject_name: 'Object-Oriented Programming (Java/C++)',
    semester_number: 3,
    semester_label: 'Semester 3 (Autumn 2025)',
    academic_year: '2025-26',
    credits: 4,
    exam_date: '2025-11-10'
  },
  {
    schedule_id: 202,
    exam_id: 2,
    exam_name: 'Regular Semester Examination Autumn 2025',
    subject_id: 7,
    subject_code: 'CS202',
    subject_name: 'Digital Logic & Computer Organization',
    semester_number: 3,
    semester_label: 'Semester 3 (Autumn 2025)',
    academic_year: '2025-26',
    credits: 4,
    exam_date: '2025-11-13'
  },
  {
    schedule_id: 203,
    exam_id: 2,
    exam_name: 'Regular Semester Examination Autumn 2025',
    subject_id: 8,
    subject_code: 'CS203',
    subject_name: 'Discrete Mathematics',
    semester_number: 3,
    semester_label: 'Semester 3 (Autumn 2025)',
    academic_year: '2025-26',
    credits: 4,
    exam_date: '2025-11-16'
  },
  // Semester 1 schedules (2nd Year student completed semester)
  {
    schedule_id: 301,
    exam_id: 11,
    exam_name: 'End-Semester Examination (Sem 1)',
    subject_id: 46,
    subject_code: 'CS101',
    subject_name: 'Engineering Mathematics I',
    semester_number: 1,
    semester_label: 'Semester 1 (2024-2025)',
    academic_year: '2024-2025',
    credits: 4,
    exam_date: '2025-01-12'
  },
  {
    schedule_id: 302,
    exam_id: 11,
    exam_name: 'End-Semester Examination (Sem 1)',
    subject_id: 47,
    subject_code: 'CS102',
    subject_name: 'Applied Physics',
    semester_number: 1,
    semester_label: 'Semester 1 (2024-2025)',
    academic_year: '2024-2025',
    credits: 4,
    exam_date: '2025-01-15'
  },
  {
    schedule_id: 303,
    exam_id: 11,
    exam_name: 'End-Semester Examination (Sem 1)',
    subject_id: 48,
    subject_code: 'CS103',
    subject_name: 'Basic Electrical & Electronics Engineering',
    semester_number: 1,
    semester_label: 'Semester 1 (2024-2025)',
    academic_year: '2024-2025',
    credits: 4,
    exam_date: '2025-01-18'
  },
  {
    schedule_id: 304,
    exam_id: 11,
    exam_name: 'End-Semester Examination (Sem 1)',
    subject_id: 49,
    subject_code: 'CS104',
    subject_name: 'Problem Solving & C Programming',
    semester_number: 1,
    semester_label: 'Semester 1 (2024-2025)',
    academic_year: '2024-2025',
    credits: 4,
    exam_date: '2025-01-21'
  },
  {
    schedule_id: 305,
    exam_id: 11,
    exam_name: 'End-Semester Examination (Sem 1)',
    subject_id: 50,
    subject_code: 'CS105',
    subject_name: 'Engineering Graphics & CAD',
    semester_number: 1,
    semester_label: 'Semester 1 (2024-2025)',
    academic_year: '2024-2025',
    credits: 4,
    exam_date: '2025-01-24'
  },
  // Semester 2 schedules (2nd Year student completed semester)
  {
    schedule_id: 401,
    exam_id: 12,
    exam_name: 'End-Semester Examination (Sem 2)',
    subject_id: 51,
    subject_code: 'CS106',
    subject_name: 'Engineering Mathematics II',
    semester_number: 2,
    semester_label: 'Semester 2 (2024-2025)',
    academic_year: '2024-2025',
    credits: 4,
    exam_date: '2025-06-18'
  },
  {
    schedule_id: 402,
    exam_id: 12,
    exam_name: 'End-Semester Examination (Sem 2)',
    subject_id: 52,
    subject_code: 'CS107',
    subject_name: 'Data Structures & Algorithms Fundamentals',
    semester_number: 2,
    semester_label: 'Semester 2 (2024-2025)',
    academic_year: '2024-2025',
    credits: 4,
    exam_date: '2025-06-21'
  },
  {
    schedule_id: 403,
    exam_id: 12,
    exam_name: 'End-Semester Examination (Sem 2)',
    subject_id: 53,
    subject_code: 'CS108',
    subject_name: 'Object-Oriented Programming using C++',
    semester_number: 2,
    semester_label: 'Semester 2 (2024-2025)',
    academic_year: '2024-2025',
    credits: 4,
    exam_date: '2025-06-24'
  },
  {
    schedule_id: 404,
    exam_id: 12,
    exam_name: 'End-Semester Examination (Sem 2)',
    subject_id: 54,
    subject_code: 'CS109',
    subject_name: 'Digital Logic & Processor Basics',
    semester_number: 2,
    semester_label: 'Semester 2 (2024-2025)',
    academic_year: '2024-2025',
    credits: 4,
    exam_date: '2025-06-27'
  },
  {
    schedule_id: 405,
    exam_id: 12,
    exam_name: 'End-Semester Examination (Sem 2)',
    subject_id: 55,
    subject_code: 'CS110',
    subject_name: 'Environmental Science & Green Computing',
    semester_number: 2,
    semester_label: 'Semester 2 (2024-2025)',
    academic_year: '2024-2025',
    credits: 4,
    exam_date: '2025-06-30'
  }
];

// Student Master Roster (covers standard demo accounts: 31001-31005, and 2nd Year 21001)
const DEMO_STUDENTS = [
  { student_id: 1, roll_no: '31001', name: 'Kavya Mohan Kulkarni', aliases: ['CS2023001', '31001', '1'] },
  { student_id: 2, roll_no: '31002', name: 'Siddharth Eknath Nale', aliases: ['CS2023002', '31002', '2'] },
  { student_id: 3, roll_no: '31003', name: 'Aditi Suresh Sharma', aliases: ['CS2023003', '31003', '3'] },
  { student_id: 4, roll_no: '31004', name: 'Rohan Rajendra Verma', aliases: ['CS2023004', '31004', '4'] },
  { student_id: 5, roll_no: '31005', name: 'Neha Deepak Joshi', aliases: ['CS2023005', '31005', '5'] },
  { student_id: 1022, roll_no: '21001', name: 'Aryan Rajesh Mehta', aliases: ['CS2024001', '21001', '1022', 'aryan.mehta@college.edu', 'f25ce001@student.example.edu'] }
];

function buildDefaultMarks(): StudentMarkRecord[] {
  const records: StudentMarkRecord[] = [];

  // Seed baseline realistic marks for each schedule and student
  const baseScores: Record<string, { mid: number; internal: number; end: number }> = {
    // Aryan Rajesh Mehta (2nd Year - Sem 1 Completed)
    '1022-301': { mid: 17.5, internal: 18, end: 52.5 }, // CS101 -> 88.0 (A+)
    '1022-302': { mid: 16, internal: 16.5, end: 49.5 },  // CS102 -> 82.0 (A+)
    '1022-303': { mid: 14.5, internal: 15.5, end: 45 },  // CS103 -> 75.0 (A)
    '1022-304': { mid: 18.5, internal: 19, end: 55.5 },  // CS104 -> 93.0 (O)
    '1022-305': { mid: 15.5, internal: 16.5, end: 47 },  // CS105 -> 79.0 (A)

    // Aryan Rajesh Mehta (2nd Year - Sem 2 Completed)
    '1022-401': { mid: 17, internal: 17.5, end: 50.5 },  // CS106 -> 85.0 (A+)
    '1022-402': { mid: 18, internal: 19, end: 54 },      // CS107 -> 91.0 (O)
    '1022-403': { mid: 17, internal: 18, end: 52 },      // CS108 -> 87.0 (A+)
    '1022-404': { mid: 15.5, internal: 16.5, end: 46 },  // CS109 -> 78.0 (A)
    '1022-405': { mid: 16.5, internal: 17.5, end: 49 },  // CS110 -> 83.0 (A+)

    // Student 1 (High achiever)
    '1-101': { mid: 18, internal: 19, end: 54 }, // CS302 -> 91 (O)
    '1-102': { mid: 17, internal: 18, end: 51 }, // CS301 -> 86 (A+)
    '1-103': { mid: 19, internal: 18, end: 52 }, // CS303 -> 89 (A+)
    '1-104': { mid: 16, internal: 17, end: 49 }, // CS304 -> 82 (A+)
    '1-105': { mid: 17, internal: 18, end: 50 }, // CS305 -> 85 (A+)
    // Semester 3 for Student 1
    '1-201': { mid: 17, internal: 18, end: 50 },
    '1-202': { mid: 16, internal: 17, end: 48 },
    '1-203': { mid: 18, internal: 17, end: 52 },

    // Student 2 (Consistent student)
    '2-101': { mid: 15, internal: 16, end: 44 }, // CS302 -> 75 (A)
    '2-102': { mid: 14, internal: 15, end: 42 }, // CS301 -> 71 (A)
    '2-103': { mid: 16, internal: 16, end: 46 }, // CS303 -> 78 (A)
    '2-104': { mid: 13, internal: 14, end: 40 }, // CS304 -> 67 (B+)
    '2-105': { mid: 15, internal: 16, end: 45 }, // CS305 -> 76 (A)

    // Student 3
    '3-101': { mid: 16, internal: 17, end: 48 },
    '3-102': { mid: 15, internal: 16, end: 47 },
    '3-103': { mid: 14, internal: 15, end: 43 },
    '3-104': { mid: 15, internal: 16, end: 45 },
    '3-105': { mid: 16, internal: 17, end: 46 },

    // Student 4
    '4-101': { mid: 19, internal: 20, end: 56 },
    '4-102': { mid: 18, internal: 19, end: 55 },
    '4-103': { mid: 19, internal: 19, end: 54 },
    '4-104': { mid: 17, internal: 18, end: 52 },
    '4-105': { mid: 18, internal: 19, end: 53 },

    // Student 5
    '5-101': { mid: 13, internal: 14, end: 38 },
    '5-102': { mid: 12, internal: 13, end: 36 },
    '5-103': { mid: 14, internal: 14, end: 39 },
    '5-104': { mid: 11, internal: 12, end: 34 },
    '5-105': { mid: 13, internal: 13, end: 37 }
  };

  for (const sched of DEFAULT_SCHEDULES) {
    for (const stu of DEMO_STUDENTS) {
      const key = `${stu.student_id}-${sched.schedule_id}`;
      const score = baseScores[key] || { mid: 14, internal: 15, end: 42 };
      const total = score.mid + score.internal + score.end;
      const g = computeGrade(total);

      records.push({
        student_id: stu.student_id,
        roll_no: stu.roll_no,
        name: stu.name,
        schedule_id: sched.schedule_id,
        subject_code: sched.subject_code,
        subject_name: sched.subject_name,
        semester_number: sched.semester_number,
        credits: sched.credits,
        mid_sem: score.mid,
        internal_marks: score.internal,
        end_sem: score.end,
        total_marks: total,
        grade_letter: g.letter,
        grade_point: g.point,
        status: g.status
      });
    }
  }

  return records;
}

const STORAGE_KEY = 'college_erp_shared_exam_data_v2';
const UPDATE_EVENT = 'erp-exam-marks-updated';

class SharedExamStore {
  private schedules: ExamScheduleItem[] = DEFAULT_SCHEDULES;
  private marks: StudentMarkRecord[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadFromStorage();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
          this.loadFromStorage();
          this.notify();
        }
      });
      window.addEventListener(UPDATE_EVENT, () => {
        this.loadFromStorage();
        this.notify();
      });
    }
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') {
      this.marks = buildDefaultMarks();
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.marks && Array.isArray(parsed.marks) && parsed.marks.length > 0) {
          this.marks = parsed.marks;
          if (parsed.schedules && Array.isArray(parsed.schedules)) {
            this.schedules = parsed.schedules;
          }
          return;
        }
      }
    } catch (e) {
      console.warn('[SharedExamStore] Failed to parse localStorage:', e);
    }
    // Initialize defaults if not present
    this.marks = buildDefaultMarks();
    this.saveToStorage();
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        schedules: this.schedules,
        marks: this.marks,
        lastUpdated: new Date().toISOString()
      }));
    } catch (e) {
      console.error('[SharedExamStore] Failed to write localStorage:', e);
    }
  }

  private notify() {
    this.listeners.forEach(cb => {
      try { cb(); } catch (err) { console.error('[SharedExamStore] Listener error:', err); }
    });
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public getSchedules(): ExamScheduleItem[] {
    return [...this.schedules];
  }

  public getScheduleById(scheduleId: number): ExamScheduleItem | undefined {
    return this.schedules.find(s => s.schedule_id === scheduleId);
  }

  /**
   * Retrieves student marks roster for a specific exam schedule.
   */
  public getRosterForSchedule(scheduleId: number): StudentMarkRecord[] {
    const list = this.marks.filter(m => m.schedule_id === scheduleId);
    if (list.length > 0) {
      return list.map(m => ({ ...m }));
    }
    // If schedule has no marks yet, initialize for demo students
    const sched = this.getScheduleById(scheduleId) || this.schedules[0];
    return DEMO_STUDENTS.map(stu => ({
      student_id: stu.student_id,
      roll_no: stu.roll_no,
      name: stu.name,
      schedule_id: sched.schedule_id,
      subject_code: sched.subject_code,
      subject_name: sched.subject_name,
      semester_number: sched.semester_number,
      credits: sched.credits,
      mid_sem: 0,
      internal_marks: 0,
      end_sem: 0,
      total_marks: 0,
      grade_letter: '—',
      grade_point: 0,
      status: 'Fail'
    }));
  }

  /**
   * Saves updated marks submitted by a teacher.
   * Automatically validates bounds, calculates total out of 100, assigns grade,
   * updates persistent storage and emits sync events across all pages/tabs.
   */
  public saveMarks(
    scheduleId: number,
    updatedMarks: Array<{
      student_id: number;
      mid_sem: number;
      internal_marks: number;
      end_sem: number;
      status?: 'Pass' | 'Fail';
    }>
  ): { success: boolean; updatedCount: number; message: string } {
    const sched = this.getScheduleById(scheduleId) || this.schedules[0];
    let updatedCount = 0;

    for (const input of updatedMarks) {
      // Validate bounds
      const mid = Math.min(Math.max(Number(input.mid_sem || 0), 0), COMPONENT_LIMITS.mid_sem_max);
      const internal = Math.min(Math.max(Number(input.internal_marks || 0), 0), COMPONENT_LIMITS.internal_max);
      const end = Math.min(Math.max(Number(input.end_sem || 0), 0), COMPONENT_LIMITS.end_sem_max);
      const total = Math.round((mid + internal + end) * 10) / 10;
      const g = computeGrade(total);

      const existingIndex = this.marks.findIndex(
        m => m.schedule_id === scheduleId && m.student_id === input.student_id
      );

      if (existingIndex >= 0) {
        this.marks[existingIndex] = {
          ...this.marks[existingIndex],
          mid_sem: mid,
          internal_marks: internal,
          end_sem: end,
          total_marks: total,
          grade_letter: g.letter,
          grade_point: g.point,
          status: g.status
        };
        updatedCount++;
      } else {
        const studentInfo = DEMO_STUDENTS.find(s => s.student_id === input.student_id) || {
          student_id: input.student_id,
          roll_no: `3100${input.student_id}`,
          name: `Student #${input.student_id}`
        };

        this.marks.push({
          student_id: input.student_id,
          roll_no: studentInfo.roll_no,
          name: studentInfo.name,
          schedule_id: sched.schedule_id,
          subject_code: sched.subject_code,
          subject_name: sched.subject_name,
          semester_number: sched.semester_number,
          credits: sched.credits,
          mid_sem: mid,
          internal_marks: internal,
          end_sem: end,
          total_marks: total,
          grade_letter: g.letter,
          grade_point: g.point,
          status: g.status
        });
        updatedCount++;
      }
    }

    this.saveToStorage();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: { scheduleId } }));
    }

    this.notify();

    return {
      success: true,
      updatedCount,
      message: `Marks successfully finalized and updated for ${updatedCount} candidates in ${sched.subject_code}.`
    };
  }

  /**
   * Retrieves results for a specific student identifier (roll number, email, or ID).
   * Aggregates subject marks, computes semester SGPA, and cumulative CGPA.
   */
  public getStudentResults(identifier?: string | number): {
    results: SemesterResultSummary[];
    marks: Array<{
      mark_id: number;
      code: string;
      name: string;
      credits: number;
      mid_sem_marks: number;
      internal_marks: number;
      endsem_marks: number;
      total_marks: number;
      grade_letter: string;
      grade_point: number;
      status: 'Pass' | 'Fail';
      semester_number: number;
      semester_id: number;
    }>;
  } {
    // Resolve which demo student this identifier corresponds to
    const targetStudent = this.resolveStudent(identifier);

    // Filter marks for this student
    const studentMarks = this.marks.filter(m => m.student_id === targetStudent.student_id);

    // Group marks by semester
    const semestersSet = new Set<number>();
    studentMarks.forEach(m => semestersSet.add(m.semester_number));

    // Ensure at least Semester 5 and Semester 3 exist for the demo
    if (semestersSet.size === 0) {
      semestersSet.add(5);
    }

    const sortedSemesters = Array.from(semestersSet).sort((a, b) => a - b); // ascending semester order: Sem 1, Sem 2, etc.

    const results: SemesterResultSummary[] = [];
    const formattedMarks: any[] = [];
    let cumulativePoints = 0;
    let cumulativeCredits = 0;

    sortedSemesters.forEach((semNum, idx) => {
      const semMarks = studentMarks.filter(m => m.semester_number === semNum);
      const totalCredits = semMarks.reduce((acc, m) => acc + (m.credits || 4), 0);
      const weightedPoints = semMarks.reduce((acc, m) => acc + (m.credits || 4) * (m.grade_point || 0), 0);

      const sgpa = totalCredits > 0 ? Math.round((weightedPoints / totalCredits) * 100) / 100 : 8.50;
      cumulativePoints += weightedPoints;
      cumulativeCredits += totalCredits;

      const hasFail = semMarks.some(m => m.status === 'Fail');

      const label = semNum === 1 ? 'Semester 1 (2024-2025)' :
                    semNum === 2 ? 'Semester 2 (2024-2025)' :
                    `Semester ${semNum} (${semNum % 2 === 1 ? 'Autumn' : 'Spring'} ${2026 - Math.floor((6 - semNum) / 2)})`;
      const acadYear = (semNum === 1 || semNum === 2) ? '2024-2025' : semNum === 3 ? '2025-2026' : '2026-27';
      const pubDate = semNum === 1 ? 'Jan 12, 2026' : semNum === 2 ? 'Jun 18, 2026' : semNum === 5 ? 'Oct 25, 2026' : 'Nov 20, 2025';

      results.push({
        result_id: semNum,
        semester_id: semNum,
        semester_number: semNum,
        semester_label: label,
        academic_year: acadYear,
        sgpa,
        cgpa: sgpa, // updated below
        overall_status: hasFail ? 'Fail' : 'Pass',
        result_date: pubDate
      });

      semMarks.forEach((m, mIdx) => {
        formattedMarks.push({
          mark_id: (semNum * 100) + mIdx + 1,
          code: m.subject_code,
          name: m.subject_name,
          credits: m.credits,
          mid_sem_marks: m.mid_sem,
          internal_marks: m.internal_marks,
          endsem_marks: m.end_sem,
          total_marks: m.total_marks,
          grade_letter: m.grade_letter,
          grade_point: m.grade_point,
          status: m.status,
          semester_number: semNum,
          semester_id: semNum
        });
      });
    });

    // Compute cumulative CGPA across all semesters
    const overallCgpa = cumulativeCredits > 0
      ? Math.round((cumulativePoints / cumulativeCredits) * 100) / 100
      : (results[0]?.sgpa || 8.50);

    results.forEach(r => {
      r.cgpa = overallCgpa;
    });

    return {
      results,
      marks: formattedMarks
    };
  }

  private resolveStudent(identifier?: string | number): { student_id: number; roll_no: string; name: string } {
    if (!identifier) return DEMO_STUDENTS[0];

    const str = String(identifier).trim().toLowerCase();

    // Check exact match in aliases
    const found = DEMO_STUDENTS.find(s =>
      s.aliases.some(a => a.toLowerCase() === str) ||
      s.roll_no.toLowerCase() === str ||
      String(s.student_id) === str ||
      s.name.toLowerCase().includes(str)
    );

    return found || DEMO_STUDENTS[0];
  }
}

export const sharedExamStore = new SharedExamStore();
export default sharedExamStore;
