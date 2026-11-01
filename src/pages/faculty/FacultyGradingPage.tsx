import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Award, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Edit3,
  Unlock,
  Check,
  Calendar
} from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { COMPONENT_LIMITS, computeGrade } from '../../data/sharedExamStore';

interface RealExamSchedule {
  schedule_id: number;
  exam_id: number;
  exam_name: string;
  exam_type?: string;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  semester_number: number;
  semester_label?: string;
  exam_date?: string;
}

interface UnscheduledSubject {
  subject_id: number;
  subject_code: string;
  subject_name: string;
}

interface StudentMarkInput {
  student_id: number;
  schedule_id?: number;
  roll_no: string;
  name: string;
  mid_sem: number;       // Max: 20
  internal_marks: number;// Max: 20
  end_sem: number;       // Max: 60
  total_marks: number;   // Max: 100
  grade_letter: string;
  grade_point: number;
  status: 'Pass' | 'Fail';
}

export const FacultyGradingPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const requestSeqRef = useRef<number>(0);

  // Real database schedules and unscheduled subjects
  const [schedules, setSchedules] = useState<RealExamSchedule[]>([]);
  const [unscheduledSubjects, setUnscheduledSubjects] = useState<UnscheduledSubject[]>([]);
  const [activeScheduleId, setActiveScheduleId] = useState<number | null>(null);

  const [marksRoster, setMarksRoster] = useState<StudentMarkInput[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [editedStudentIds, setEditedStudentIds] = useState<Set<number>>(new Set());

  // Load real schedules and candidate roster from the backend API
  const loadRoster = useCallback(async (scheduleId?: number) => {
    const currentSeq = ++requestSeqRef.current;
    try {
      setLoading(true);
      setValidationError(null);
      setEditedStudentIds(new Set());
      // Clear roster immediately so stale data from a previous schedule is never retained
      setMarksRoster([]);

      const targetId = scheduleId !== undefined ? scheduleId : (activeScheduleId || undefined);
      const apiRes: any = await api.getFacultyGrading(targetId);

      // Discard response if a newer request was dispatched while this was in flight
      if (currentSeq !== requestSeqRef.current) {
        return;
      }

      if (apiRes && apiRes.success) {
        const realSchedules: RealExamSchedule[] = apiRes.schedules || [];
        const unscheduled: UnscheduledSubject[] = apiRes.unscheduledSubjects || [];

        setSchedules(realSchedules);
        setUnscheduledSubjects(unscheduled);

        if (realSchedules.length > 0) {
          const chosenId = targetId && realSchedules.some(s => s.schedule_id === targetId)
            ? targetId
            : (apiRes.activeScheduleId || realSchedules[0].schedule_id);
          setActiveScheduleId(chosenId);

          const rosterList = apiRes.data || [];
          const apiMapped: StudentMarkInput[] = rosterList.map((m: any) => {
            const mid = m.mid_sem !== null && m.mid_sem !== undefined ? Number(m.mid_sem) : 0;
            const internal = m.internal_marks !== null && m.internal_marks !== undefined ? Number(m.internal_marks) : 0;
            const endsem = m.end_sem !== null && m.end_sem !== undefined ? Number(m.end_sem) : 0;
            const total = Math.round((mid + internal + endsem) * 10) / 10;
            const g = computeGrade(total);
            return {
              student_id: m.student_id,
              schedule_id: chosenId,
              roll_no: m.roll_no,
              name: m.name,
              mid_sem: Math.min(Math.max(mid, 0), COMPONENT_LIMITS.mid_sem_max),
              internal_marks: Math.min(Math.max(internal, 0), COMPONENT_LIMITS.internal_max),
              end_sem: Math.min(Math.max(endsem, 0), COMPONENT_LIMITS.end_sem_max),
              total_marks: total,
              grade_letter: m.grade_letter || g.letter,
              grade_point: m.grade_point !== null && m.grade_point !== undefined ? Number(m.grade_point) : g.point,
              status: m.status || (total >= 40 ? 'Pass' : 'Fail')
            };
          });
          setMarksRoster(apiMapped);
        } else {
          setActiveScheduleId(null);
          setMarksRoster([]);
        }
      } else {
        throw new Error(apiRes?.message || 'Failed to retrieve grading roster from server.');
      }
    } catch (err: any) {
      if (currentSeq === requestSeqRef.current) {
        setValidationError(err.message || 'Failed to load grading data from the backend.');
        setMarksRoster([]);
      }
    } finally {
      if (currentSeq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [activeScheduleId]);

  useEffect(() => {
    loadRoster();
  }, []);

  // Handle component mark input with bounds validation & live total computation
  const handleComponentChange = (
    student_id: number,
    field: 'mid_sem' | 'internal_marks' | 'end_sem',
    val: string
  ) => {
    setValidationError(null);
    setSuccessMessage(null);

    const num = val === '' ? 0 : Number(val);
    const maxVal = field === 'end_sem' 
      ? COMPONENT_LIMITS.end_sem_max 
      : field === 'mid_sem' 
      ? COMPONENT_LIMITS.mid_sem_max 
      : COMPONENT_LIMITS.internal_max;

    const fieldLabel = field === 'mid_sem' 
      ? 'Mid-Sem / In-Sem' 
      : field === 'internal_marks' 
      ? 'Internal Assessment' 
      : 'End-Sem';

    if (isNaN(num)) {
      setValidationError(`Please enter a valid numeric score for ${fieldLabel}.`);
      return;
    }

    if (num < 0 || num > maxVal) {
      setValidationError(`Invalid score: ${fieldLabel} marks must be between 0 and ${maxVal}.`);
      return;
    }

    setEditedStudentIds(prev => {
      const next = new Set(prev);
      next.add(student_id);
      return next;
    });

    setMarksRoster(prev => prev.map(s => {
      if (s.student_id === student_id) {
        const updated = { ...s, [field]: num };
        const total = Math.round((updated.mid_sem + updated.internal_marks + updated.end_sem) * 10) / 10;
        const { letter, point, status } = computeGrade(total);
        return {
          ...updated,
          total_marks: total,
          grade_letter: letter,
          grade_point: point,
          status: status
        };
      }
      return s;
    }));
  };

  // Confirm and persist marks to live database via backend API
  const handleConfirmSubmit = async () => {
    if (!activeScheduleId) {
      setValidationError('Cannot save marks: No active examination schedule selected.');
      return;
    }

    try {
      setSubmitting(true);
      setValidationError(null);
      setSuccessMessage(null);

      // Filter to only students whose marks were actively edited
      const editedStudents = marksRoster.filter(s => editedStudentIds.has(s.student_id));
      if (editedStudents.length === 0) {
        throw new Error('No student marks have been edited. Please edit at least one student before saving.');
      }

      // Validate only edited records before saving
      for (const m of editedStudents) {
        if (m.mid_sem < 0 || m.mid_sem > COMPONENT_LIMITS.mid_sem_max) {
          throw new Error(`Roll ${m.roll_no}: Mid-Sem score (${m.mid_sem}) exceeds maximum limit of ${COMPONENT_LIMITS.mid_sem_max}.`);
        }
        if (m.internal_marks < 0 || m.internal_marks > COMPONENT_LIMITS.internal_max) {
          throw new Error(`Roll ${m.roll_no}: Internal score (${m.internal_marks}) exceeds maximum limit of ${COMPONENT_LIMITS.internal_max}.`);
        }
        if (m.end_sem < 0 || m.end_sem > COMPONENT_LIMITS.end_sem_max) {
          throw new Error(`Roll ${m.roll_no}: End-Sem score (${m.end_sem}) exceeds maximum limit of ${COMPONENT_LIMITS.end_sem_max}.`);
        }
      }

      // Await live backend API save sending ONLY edited students
      const apiRes: any = await api.saveFacultyGrading({
        schedule_id: activeScheduleId,
        marks: editedStudents.map(s => ({
          student_id: s.student_id,
          mid_sem: s.mid_sem,
          internal_marks: s.internal_marks,
          end_sem: s.end_sem,
          status: s.status
        }))
      });

      if (!apiRes || !apiRes.success) {
        throw new Error(apiRes?.message || 'Failed to save marks to the database.');
      }

      // Live database updated; do NOT write to localStorage
      setEditedStudentIds(new Set());
      setIsSubmitted(true);
      setIsSubmitModalOpen(false);
      setSuccessMessage(apiRes.message || `Marks saved successfully for ${editedStudents.length} student(s) to the database. Grades and results recalculated.`);
    } catch (err: any) {
      // Show real backend error message clearly to the faculty
      setValidationError(err.message || 'Failed to finalize marks.');
      setIsSubmitModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const activeSchedule = schedules.find(s => s.schedule_id === activeScheduleId) || schedules[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight flex items-center gap-2">
            <Award className="w-6 h-6 text-navy-800" />
            Digital Gradebook & Examination Grading
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Official marks-entry registry with 3-tier component validation: Mid-Sem (20), Internal (20), and End-Sem (60).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={isSubmitted ? "success" : "warning"}>
            {isSubmitted ? "Grades Finalized & Synced" : "Draft In Progress"}
          </Badge>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-800 font-semibold shadow-sm animate-fade-in">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Assessment Scope & Exam Schedule Selector */}
      <div className="erp-card p-6 bg-white space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h3 className="text-sm font-bold text-navy-950 uppercase tracking-wide">
            Gradebook Assessment Scope
          </h3>
          <p className="text-xs text-slate-500">
            Select examination schedule across course semesters to enter and evaluate candidate scores
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="sm:col-span-2">
            <label className="block font-bold text-slate-700 mb-1">
              Select Exam &amp; Subject *
            </label>
            {schedules.length > 0 ? (
              <select
                value={activeScheduleId ?? ''}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setActiveScheduleId(id);
                  loadRoster(id);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold text-navy-950 focus:ring-2 focus:ring-navy-800"
              >
                {schedules.map((s) => (
                  <option key={s.schedule_id} value={s.schedule_id}>
                    {s.subject_code} — {s.subject_name} (Sem {s.semester_number}) • {s.exam_name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-medium">
                No examination scheduled yet for assigned subjects
              </div>
            )}
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Official Component Scheme *
            </label>
            <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-semibold text-navy-950 text-xs">
              Mid-Sem [20] + Internal [20] + End-Sem [60] = 100
            </div>
          </div>
        </div>
      </div>

      {/* Validation Error Alert */}
      {validationError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-rose-800 font-semibold shadow-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Unscheduled Subject Notice for Faculty */}
      {unscheduledSubjects.length > 0 && schedules.length === 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-amber-700" />
            Awaiting Controller Examination Schedule
          </div>
          <p className="text-amber-800">
            You are assigned to{' '}
            <strong>
              {unscheduledSubjects.map(u => `${u.subject_code} - ${u.subject_name}`).join(', ')}
            </strong>
            . The Examination Controller has not scheduled an exam for this course yet. Marks entry will unlock as soon as the examination schedule is published.
          </p>
        </div>
      )}

      {/* Candidate Marks Roster Table */}
      <div className="erp-card p-6 bg-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-base font-bold text-navy-950 flex items-center gap-2">
              Student Marks Roster ({marksRoster.length} Candidates)
              {activeSchedule && (
                <span className="text-xs font-mono font-normal text-navy-700 bg-navy-50 px-2 py-0.5 rounded border border-navy-200">
                  {activeSchedule.subject_code} • Sem {activeSchedule.semester_number} ({activeSchedule.exam_name})
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter individual component scores: <strong className="text-slate-700">Mid-Sem [Max: 20]</strong>, <strong className="text-slate-700">Internal [Max: 20]</strong>, and <strong className="text-slate-700">End-Sem [Max: 60]</strong>
            </p>
          </div>

          {/* Action Buttons: Save & Unlock/Edit */}
          <div className="flex items-center gap-2">
            {isSubmitted ? (
              <button
                type="button"
                onClick={() => {
                  setIsSubmitted(false);
                  setSuccessMessage(null);
                  setValidationError(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-navy-950 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                title="Click to edit previously submitted marks"
              >
                <Edit3 className="w-3.5 h-3.5 text-navy-800" />
                Unlock &amp; Edit Marks
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (editedStudentIds.size === 0) {
                    setValidationError('No student marks have been edited yet. Please edit marks for at least one student before saving.');
                    return;
                  }
                  setValidationError(null);
                  setIsSubmitModalOpen(true);
                }}
                disabled={editedStudentIds.size === 0}
                title={editedStudentIds.size === 0 ? "Edit marks for at least one student to enable save" : `Save marks for ${editedStudentIds.size} student(s)`}
                className="px-4 py-2 bg-navy-950 hover:bg-navy-900 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Save &amp; Finalize Grades{editedStudentIds.size > 0 ? ` (${editedStudentIds.size})` : ''}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-navy-800" />
            <span className="text-xs text-slate-500 ml-2">Loading enrolled candidates...</span>
          </div>
        ) : marksRoster.length === 0 ? (
          <p className="text-xs text-slate-500 py-8 text-center">
            No students found for this subject's department and semester.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAFBFD] border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="p-3 w-12 text-center">#</th>
                  <th className="p-3">Roll Number</th>
                  <th className="p-3">Candidate Name</th>
                  <th className="p-3 text-center">
                    Mid-Sem
                    <span className="block text-[9px] text-slate-400 font-normal">Max: 20</span>
                  </th>
                  <th className="p-3 text-center">
                    Internal
                    <span className="block text-[9px] text-slate-400 font-normal">Max: 20</span>
                  </th>
                  <th className="p-3 text-center">
                    End-Sem
                    <span className="block text-[9px] text-slate-400 font-normal">Max: 60</span>
                  </th>
                  <th className="p-3 text-center">
                    Total Marks
                    <span className="block text-[9px] text-slate-400 font-normal">Out of 100</span>
                  </th>
                  <th className="p-3 text-center">Grade</th>
                  <th className="p-3 text-center">Grade Point</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {marksRoster.map((student, idx) => (
                  <tr 
                    key={student.student_id} 
                    className={editedStudentIds.has(student.student_id) 
                      ? "bg-amber-50/70 border-l-4 border-l-amber-500 transition-colors" 
                      : "hover:bg-slate-50/80 transition-colors"}
                  >
                    <td className="p-3 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-3 font-mono font-bold text-navy-950">{student.roll_no}</td>
                    <td className="p-3 font-semibold text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <span>{student.name}</span>
                        {editedStudentIds.has(student.student_id) && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-200 text-amber-900 rounded">
                            Edited
                          </span>
                        )}
                      </div>
                    </td>
                    
                    {/* Mid-Sem [Max: 20] */}
                    <td className="p-3 text-center">
                      <div className="inline-flex items-center gap-1.5 justify-center">
                        <input
                          type="number"
                          min={0}
                          max={COMPONENT_LIMITS.mid_sem_max}
                          step="0.5"
                          disabled={isSubmitted}
                          value={student.mid_sem}
                          onChange={(e) => handleComponentChange(student.student_id, 'mid_sem', e.target.value)}
                          className="w-14 px-2 py-1 text-center font-mono font-bold text-navy-950 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-navy-800 disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                        />
                        <span className="text-[11px] font-bold text-slate-400">/ 20</span>
                      </div>
                    </td>

                    {/* Internal Assessment [Max: 20] */}
                    <td className="p-3 text-center">
                      <div className="inline-flex items-center gap-1.5 justify-center">
                        <input
                          type="number"
                          min={0}
                          max={COMPONENT_LIMITS.internal_max}
                          step="0.5"
                          disabled={isSubmitted}
                          value={student.internal_marks}
                          onChange={(e) => handleComponentChange(student.student_id, 'internal_marks', e.target.value)}
                          className="w-14 px-2 py-1 text-center font-mono font-bold text-navy-950 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-navy-800 disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                        />
                        <span className="text-[11px] font-bold text-slate-400">/ 20</span>
                      </div>
                    </td>

                    {/* End-Sem [Max: 60] */}
                    <td className="p-3 text-center">
                      <div className="inline-flex items-center gap-1.5 justify-center">
                        <input
                          type="number"
                          min={0}
                          max={COMPONENT_LIMITS.end_sem_max}
                          step="0.5"
                          disabled={isSubmitted}
                          value={student.end_sem}
                          onChange={(e) => handleComponentChange(student.student_id, 'end_sem', e.target.value)}
                          className="w-14 px-2 py-1 text-center font-mono font-bold text-navy-950 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-navy-800 disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                        />
                        <span className="text-[11px] font-bold text-slate-400">/ 60</span>
                      </div>
                    </td>

                    {/* Automatically Calculated Total Marks [Out of 100] */}
                    <td className="p-3 text-center">
                      <div className="inline-flex items-center gap-1 justify-center">
                        <span className="font-mono font-extrabold text-navy-950 text-sm">
                          {student.total_marks.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">/ 100</span>
                      </div>
                    </td>

                    {/* Calculated Grade Letter */}
                    <td className="p-3 text-center">
                      <span className={`font-mono font-extrabold px-2.5 py-0.5 rounded border text-xs ${
                        student.grade_letter === 'O' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                        student.grade_letter === 'A+' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                        student.grade_letter === 'A' ? 'bg-teal-50 text-teal-800 border-teal-200' :
                        student.grade_letter === 'B+' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                        student.grade_letter === 'B' ? 'bg-cyan-50 text-cyan-800 border-cyan-200' :
                        student.grade_letter === 'C' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                        'bg-rose-50 text-rose-800 border-rose-200'
                      }`}>
                        {student.grade_letter}
                      </span>
                    </td>

                    {/* Grade Point */}
                    <td className="p-3 text-center font-mono font-bold text-slate-700">
                      {student.grade_point.toFixed(1)}
                    </td>

                    {/* Outcome Status */}
                    <td className="p-3 text-center">
                      <Badge variant={student.status === 'Pass' ? 'success' : 'danger'}>
                        {student.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {isSubmitModalOpen && (
        <Modal
          isOpen={isSubmitModalOpen}
          onClose={() => setIsSubmitModalOpen(false)}
          title="Confirm Examination Marks Finalization"
          subtitle="Official Controller of Examinations Grade Record Submission"
          maxWidth="md"
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold text-white bg-navy-950 hover:bg-navy-900 rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm &amp; Sync Marks
              </button>
            </div>
          }
        >
          <div className="space-y-3 text-xs">
            <p className="text-slate-700">
              You are saving marks for <strong>{editedStudentIds.size} student{editedStudentIds.size === 1 ? '' : 's'}</strong> whose grades were edited:
            </p>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 font-mono text-slate-800 text-[11px]">
              <div>Subject: <strong>{activeSchedule?.subject_code} - {activeSchedule?.subject_name}</strong></div>
              <div>Semester: <strong>Semester {activeSchedule?.semester_number} ({activeSchedule?.exam_name || 'Regular Examination'})</strong></div>
              <div>Exam Scheme: <strong>Mid-Sem [20] + Internal [20] + End-Sem [60] = 100 Marks</strong></div>
              <div className="pt-1.5 text-navy-950 font-semibold border-t border-slate-200 mt-1">
                Edited student{editedStudentIds.size === 1 ? '' : 's'}:{' '}
                {marksRoster
                  .filter(s => editedStudentIds.has(s.student_id))
                  .map(s => `Roll ${s.roll_no} (${s.name}) - Total: ${s.total_marks}/100`)
                  .join(', ')}
              </div>
            </div>
            <p className="text-[11px] text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 font-medium">
              Safety Guard Active: The remaining <strong>{marksRoster.length - editedStudentIds.size} untouched students</strong> will NOT be modified or submitted to the database.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default FacultyGradingPage;
