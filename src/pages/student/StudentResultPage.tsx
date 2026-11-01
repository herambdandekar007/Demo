import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  GraduationCap, 
  Printer, 
  Loader2,
  Sparkles,
  BookOpen,
  AlertCircle
} from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { sharedExamStore, SemesterResultSummary } from '../../data/sharedExamStore';

interface SubjectGrade {
  mark_id?: number;
  code: string;
  name: string;
  credits: number;
  mid_sem_marks?: number;
  internal_marks?: number;
  endsem_marks?: number;
  total_marks?: number;
  grade_letter: string;
  grade_point: number;
  status: 'Pass' | 'Fail';
  semester_id?: number;
  semester_number?: number;
}

export const StudentResultPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<SemesterResultSummary[]>([]);
  const [marks, setMarks] = useState<SubjectGrade[]>([]);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const isLiveApiRef = useRef(false);

  // Load results from backend API (with offline fallback if genuinely unreachable)
  const loadStudentResults = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Primary: Fetch authoritative results from backend API
      try {
        const res = await api.getStudentResults();
        if (res && res.success) {
          const apiResults: SemesterResultSummary[] = res.data?.results || [];
          const apiMarks: SubjectGrade[] = res.data?.marks || [];

          isLiveApiRef.current = true;
          setIsOfflineData(false);
          setResults(apiResults);
          setMarks(apiMarks);

          if (apiResults.length > 0) {
            setSelectedSemester(prev => {
              const exists = prev && apiResults.some(r => r.semester_number === prev || r.semester_id === prev);
              if (exists) return prev;
              const studentSem = Number(user?.semester);
              if (studentSem && apiResults.some(r => r.semester_number === studentSem || r.semester_id === studentSem)) {
                return studentSem;
              }
              const latest = apiResults[apiResults.length - 1];
              return latest.semester_number || latest.semester_id || apiResults[0].semester_number;
            });
          } else if (apiMarks.length > 0) {
            const semNum = apiMarks[0].semester_number || apiMarks[0].semester_id || Number(user?.semester) || 5;
            setSelectedSemester(semNum);
            setResults([{
              result_id: 0,
              semester_id: semNum,
              semester_number: semNum,
              semester_label: `Semester ${semNum}`,
              academic_year: '2026-27',
              sgpa: 0,
              cgpa: 0,
              overall_status: 'Pass',
              result_date: 'Under Evaluation'
            }]);
          } else {
            setSelectedSemester(null);
          }
          return;
        }
      } catch (apiErr) {
        console.warn('[StudentResultPage] Backend API unavailable, falling back to offline demonstration store:', apiErr);
      }

      // 2. Fallback: Used ONLY when API request genuinely fails
      isLiveApiRef.current = false;
      setIsOfflineData(true);
      const studentIdentifier = user?.codeOrRoll || user?.id || '31001';
      const storeData = sharedExamStore.getStudentResults(studentIdentifier);
      const storeResults = storeData.results || [];
      const storeMarks = storeData.marks || [];

      setResults(storeResults);
      setMarks(storeMarks);

      if (storeResults.length > 0) {
        setSelectedSemester(prev => {
          if (prev && storeResults.some(r => r.semester_number === prev)) {
            return prev;
          }
          const studentSem = Number(user?.semester);
          if (studentSem && storeResults.some(r => r.semester_number === studentSem)) {
            return studentSem;
          }
          const latest = storeResults[storeResults.length - 1];
          return latest.semester_number || storeResults[0].semester_number;
        });
      } else {
        setSelectedSemester(null);
      }
    } catch (err) {
      console.warn('[StudentResultPage] Load results notice:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial load and reactive subscription to teacher grading changes
  useEffect(() => {
    loadStudentResults();

    // Auto-refresh when tab gains focus (e.g. after teacher saves marks in another tab)
    const handleFocus = () => {
      loadStudentResults();
    };
    window.addEventListener('focus', handleFocus);

    // Subscribe to live updates dispatched when faculty saves marks (only in offline/mock mode)
    const unsubscribe = sharedExamStore.subscribe(() => {
      if (isLiveApiRef.current) return; // Prevent overwriting live database records
      const studentIdentifier = user?.codeOrRoll || user?.id || '31001';
      const updated = sharedExamStore.getStudentResults(studentIdentifier);
      setResults(updated.results || []);
      setMarks(updated.marks || []);
    });

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadStudentResults, user]);

  // Find active semester outcome
  const currentResult = results.find(
    r => r.semester_number === selectedSemester || r.semester_id === selectedSemester
  ) || results[0];

  // Filter marks corresponding to current active semester
  const currentSubjects = marks.filter(m => 
    currentResult && (m.semester_number === currentResult.semester_number || m.semester_id === currentResult.semester_id)
  );

  const totalCredits = currentSubjects.reduce((acc, s) => acc + (s.credits || 0), 0);

  // Mathematically calculated SGPA: sum(credits * grade_point) / sum(credits)
  const currentGradedSubjects = currentSubjects.filter(s => s.grade_point != null && !isNaN(Number(s.grade_point)));
  const currentEarnedPoints = currentGradedSubjects.reduce((acc, s) => acc + (Number(s.credits) || 0) * Number(s.grade_point), 0);
  const currentGradedCredits = currentGradedSubjects.reduce((acc, s) => acc + (Number(s.credits) || 0), 0);
  const activeSgpa = currentGradedCredits > 0 
    ? (currentEarnedPoints / currentGradedCredits) 
    : Number(currentResult?.sgpa || 0);

  // Mathematically calculated Cumulative CGPA across completed semesters
  const completedSemesters = results
    .filter(r => currentResult && r.semester_number <= currentResult.semester_number)
    .map(r => r.semester_number);
  
  const cumulativeSubjects = marks.filter(m => 
    m.semester_number && completedSemesters.includes(m.semester_number) && m.grade_point != null && !isNaN(Number(m.grade_point))
  );
  const cumulativeEarnedPoints = cumulativeSubjects.reduce((acc, s) => acc + (Number(s.credits) || 0) * Number(s.grade_point), 0);
  const cumulativeCredits = cumulativeSubjects.reduce((acc, s) => acc + (Number(s.credits) || 0), 0);
  const activeCgpa = cumulativeCredits > 0 
    ? (cumulativeEarnedPoints / cumulativeCredits) 
    : Number(currentResult?.cgpa || 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <Loader2 className="w-8 h-8 text-navy-800 animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Loading official examination records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-navy-800" />
            Official Semester Result Sheet
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Certified academic transcripts, subject-wise component marks, SGPA, and cumulative CGPA.
          </p>
        </div>

        {/* Dynamic Semester Selector */}
        {results.length > 0 && (
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-600">Select Semester:</label>
            <select
              value={selectedSemester ?? (currentResult?.semester_number || '')}
              onChange={(e) => setSelectedSemester(Number(e.target.value))}
              className="px-3.5 py-1.5 text-xs font-bold text-navy-950 bg-white border border-slate-300 rounded-xl shadow-sm outline-none cursor-pointer focus:ring-2 focus:ring-navy-800"
            >
              {results.map((r) => (
                <option key={r.result_id || r.semester_number} value={r.semester_number || r.semester_id}>
                  {r.semester_label || `Semester ${r.semester_number}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {results.length === 0 ? (
        <EmptyState
          title="No Published Semester Results"
          description="Your examination results and grade sheets have not been finalized or published by the Controller of Examinations yet."
        />
      ) : currentResult ? (
        <div className="space-y-6">
          {/* GPA & Performance Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="erp-card p-5 !bg-[#0b1329] text-white shadow-md border border-slate-700">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300 block mb-1">
                Semester Grade Point Average (SGPA)
              </span>
              <h3 className="text-3xl font-extrabold font-mono text-white tracking-tight">
                {Number(activeSgpa || 0).toFixed(2)}
              </h3>
              <p className="text-xs text-sky-200/80 mt-1">Scale of 10.00 • {currentResult.semester_label}</p>
            </div>

            <div className="erp-card p-5 bg-white border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Cumulative CGPA
              </span>
              <h3 className="text-3xl font-extrabold font-mono text-navy-950">
                {Number(activeCgpa || 0).toFixed(2)}
              </h3>
              <p className="text-xs text-slate-400 mt-1">Overall Cumulative Score</p>
            </div>

            <div className="erp-card p-5 bg-white border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Credits Registered
              </span>
              <h3 className="text-3xl font-extrabold font-mono text-navy-950">
                {totalCredits > 0 ? totalCredits : 20}
              </h3>
              <p className="text-xs text-slate-400 mt-1">Earned in Academic Term</p>
            </div>

            <div className="erp-card p-5 bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Overall Outcome
                </span>
                <Badge variant={String(currentResult.overall_status).toUpperCase() === 'PASS' ? 'success' : 'danger'} size="md">
                  {String(currentResult.overall_status).toUpperCase() === 'PASS' ? 'PASSED WITH DISTINCTION' : 'APPEAR FOR BACKLOG'}
                </Badge>
              </div>
              <button
                onClick={() => setIsPrintModalOpen(true)}
                className="mt-3 w-full py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-navy-950 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Result Sheet
              </button>
            </div>
          </div>

          {/* Subject Marks Table */}
          <div className="erp-card p-6 bg-white overflow-hidden border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-bold text-navy-950 flex items-center gap-2">
                  {currentResult.semester_label}
                  <span className="text-xs font-normal text-slate-500">
                    ({currentSubjects.length} Registered Courses)
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Official Session: {currentResult.academic_year || 'Current'} • Published on {currentResult.result_date}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isOfflineData ? (
                  <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-600" />
                    Offline Demonstration Data (Local Store)
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    Live Official Database Record
                  </span>
                )}
                <Badge variant={isOfflineData ? 'warning' : 'navy'}>
                  {isOfflineData ? 'Demo Store' : 'Official Controller Record'}
                </Badge>
              </div>
            </div>

            {currentSubjects.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No individual subject mark breakdowns found for this semester.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#FAFBFD] border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                      <th className="p-3">Course Code</th>
                      <th className="p-3">Course Subject Title</th>
                      <th className="p-3 text-center">Credits</th>
                      <th className="p-3 text-right">
                        Mid-Sem / In-Sem
                        <span className="block text-[9px] text-slate-400 font-normal">Max: 20</span>
                      </th>
                      <th className="p-3 text-right">
                        Internal Assessment
                        <span className="block text-[9px] text-slate-400 font-normal">Max: 20</span>
                      </th>
                      <th className="p-3 text-right">
                        End-Sem Exam
                        <span className="block text-[9px] text-slate-400 font-normal">Max: 60</span>
                      </th>
                      <th className="p-3 text-right">
                        Total Marks
                        <span className="block text-[9px] text-slate-400 font-normal">Out of 100</span>
                      </th>
                      <th className="p-3 text-center">Grade Letter</th>
                      <th className="p-3 text-center">Grade Point</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentSubjects.map((sub, idx) => {
                      const fmt = (v: number | null | undefined) => 
                        (v === null || v === undefined ? '—' : Number(v).toFixed(1));

                      const midVal = sub.mid_sem_marks !== undefined ? sub.mid_sem_marks : null;
                      const intVal = sub.internal_marks !== undefined ? sub.internal_marks : null;
                      const endVal = sub.endsem_marks !== undefined ? sub.endsem_marks : null;
                      const totalVal = sub.total_marks !== undefined ? sub.total_marks : null;

                      return (
                        <tr key={sub.code || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-mono font-bold text-navy-950">{sub.code}</td>
                          <td className="p-3 font-semibold text-slate-800">{sub.name}</td>
                          <td className="p-3 text-center font-mono text-slate-600">{sub.credits}</td>

                          {/* Mid-Sem / In-Sem out of 20 */}
                          <td className="p-3 text-right">
                            <span className="font-mono font-bold text-navy-900">{fmt(midVal)}</span>
                            <span className="text-[10px] text-slate-400 font-semibold ml-1">/ 20</span>
                          </td>

                          {/* Internal marks out of 20 */}
                          <td className="p-3 text-right">
                            <span className="font-mono font-bold text-navy-900">{fmt(intVal)}</span>
                            <span className="text-[10px] text-slate-400 font-semibold ml-1">/ 20</span>
                          </td>

                          {/* End-Sem marks out of 60 */}
                          <td className="p-3 text-right">
                            <span className="font-mono font-bold text-navy-900">{fmt(endVal)}</span>
                            <span className="text-[10px] text-slate-400 font-semibold ml-1">/ 60</span>
                          </td>

                          {/* Total marks out of 100 */}
                          <td className="p-3 text-right">
                            <span className="font-mono font-extrabold text-navy-950 text-xs">
                              {fmt(totalVal)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold ml-1">/ 100</span>
                          </td>

                          {/* Grade Letter */}
                          <td className="p-3 text-center">
                            <span className={`font-mono font-extrabold px-2 py-0.5 rounded border text-xs ${
                              sub.grade_letter === 'O' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                              sub.grade_letter === 'A+' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                              sub.grade_letter === 'A' ? 'bg-teal-50 text-teal-800 border-teal-200' :
                              sub.grade_letter === 'B+' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                              sub.grade_letter === 'B' ? 'bg-cyan-50 text-cyan-800 border-cyan-200' :
                              sub.grade_letter === 'C' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                              'bg-rose-50 text-rose-800 border-rose-200'
                            }`}>
                              {sub.grade_letter || '—'}
                            </span>
                          </td>

                          {/* Grade Point */}
                          <td className="p-3 text-center font-mono font-semibold text-navy-900">
                            {sub.grade_point != null ? Number(sub.grade_point).toFixed(1) : '—'}
                          </td>

                          {/* Pass/Fail Status */}
                          <td className="p-3 text-center">
                            <Badge variant={sub.status === 'Pass' ? 'success' : 'danger'}>
                              {sub.status || 'Pass'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="erp-card p-12 text-center">
          <p className="text-slate-500 text-xs">No result records published for this semester yet.</p>
        </div>
      )}

      {/* Printable Sheet Modal */}
      {isPrintModalOpen && currentResult && (
        <Modal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title="Grade Card Transcript"
          subtitle="Official University Controller Document"
          maxWidth="2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] text-slate-400 font-mono">Digitally verified grade registry</span>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-xl cursor-pointer"
              >
                Close Transcript
              </button>
            </div>
          }
        >
          <div className="border-2 border-navy-950 p-6 rounded-2xl bg-white space-y-4 text-xs font-sans">
            <div className="text-center border-b-2 border-navy-950 pb-3">
              <h2 className="font-extrabold text-base text-navy-950">UNIVERSITY INSTITUTE OF TECHNOLOGY</h2>
              <p className="text-[11px] text-slate-600 uppercase font-semibold">Semester Grade Statement</p>
              <p className="text-[10px] text-slate-500 font-mono">{currentResult.semester_label}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-slate-800 text-[11px] border-b border-slate-200 pb-3">
              <div>Student Name: <strong>{user?.name || 'Enrolled Student'}</strong></div>
              <div>Roll No: <strong className="font-mono">{user?.codeOrRoll || '31001'}</strong></div>
              <div>PRN: <strong className="font-mono">{`PRN2024${String(user?.id || 1).padStart(4, '0')}`}</strong></div>
              <div>Branch: <strong>{user?.programOrDesignation || user?.department || 'Computer Science & Engineering'}</strong></div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 font-bold text-slate-700">
                    <th className="py-1">Code</th>
                    <th className="py-1">Subject</th>
                    <th className="py-1 text-center">Credits</th>
                    <th className="py-1 text-right">Mid-Sem [20]</th>
                    <th className="py-1 text-right">Internal [20]</th>
                    <th className="py-1 text-right">End-Sem [60]</th>
                    <th className="py-1 text-right">Total [100]</th>
                    <th className="py-1 text-center">Grade</th>
                    <th className="py-1 text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {currentSubjects.map((s, idx) => (
                    <tr key={s.code || idx}>
                      <td className="py-1 font-bold">{s.code}</td>
                      <td className="py-1 font-sans">{s.name}</td>
                      <td className="py-1 text-center">{s.credits}</td>
                      <td className="py-1 text-right">{s.mid_sem_marks ?? '—'}</td>
                      <td className="py-1 text-right">{s.internal_marks ?? '—'}</td>
                      <td className="py-1 text-right">{s.endsem_marks ?? '—'}</td>
                      <td className="py-1 text-right font-bold">{s.total_marks ?? '—'}</td>
                      <td className="py-1 text-center font-bold text-emerald-800">{s.grade_letter || '—'}</td>
                      <td className="py-1 text-right">{s.grade_point != null ? Number(s.grade_point).toFixed(1) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t-2 border-navy-950 pt-3 flex items-center justify-between text-xs">
              <div>
                Semester SGPA: <strong className="font-mono text-navy-950 text-sm">{Number(activeSgpa || 0).toFixed(2)}</strong>
              </div>
              <div>
                Cumulative CGPA: <strong className="font-mono text-navy-950 text-sm">{Number(activeCgpa || 0).toFixed(2)}</strong>
              </div>
              <div>
                Status: <strong className="text-emerald-700">{String(currentResult.overall_status).toUpperCase()}</strong>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default StudentResultPage;
