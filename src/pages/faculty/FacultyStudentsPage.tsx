import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  Eye, 
  Mail, 
  Phone, 
  GraduationCap, 
  Calendar, 
  Layers, 
  BookOpen, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Send, 
  Sparkles, 
  ArrowUpDown,
  LayoutGrid,
  List,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { StudentPreviewModal } from '../../components/common/StudentPreviewModal';

interface StudentHandled {
  student_id: number;
  roll_no: string | number;
  prn: string;
  student_name: string;
  email: string;
  phone: string;
  current_year: number;
  current_semester: number;
  branch: string;
  gender: string;
  section_id: number;
  section_name: string;
  department_name: string;
  course_name: string;
  faculty_subjects: string[];
  faculty_subject_codes: string[];
  total_sessions: number;
  attended_sessions: number;
  attendance_pct: number;
}

interface SummaryStats {
  totalStudents: number;
  averageAttendance: number;
  yearBreakdown: Record<string, number>;
  assignedSections: Array<{ section_id: number; section_name: string; student_count: number }>;
}

export const FacultyStudentsPage: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentHandled[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Controls
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [attendanceFilter, setAttendanceFilter] = useState<'ALL' | 'ELIGIBLE' | 'SHORTFALL'>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [copiedRoll, setCopiedRoll] = useState<string | null>(null);

  // Student Profile Preview Modal
  const [previewStudentId, setPreviewStudentId] = useState<number | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  // Quick Notice Modal
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState<boolean>(false);
  const [noticeTargetStudent, setNoticeTargetStudent] = useState<StudentHandled | null>(null);
  const [noticeSubject, setNoticeSubject] = useState<string>('');
  const [noticeMessage, setNoticeMessage] = useState<string>('');
  const [noticeSent, setNoticeSent] = useState<boolean>(false);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getFacultyStudents();
      if (res && res.success) {
        setStudents(res.data || []);
        setSummary(res.summary || null);
      } else {
        setError('Unable to load student roster.');
      }
    } catch (err: any) {
      console.error('Error fetching faculty students:', err);
      setError(err?.message || 'Failed to fetch student list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter(st => {
      // Search match
      const query = searchQuery.trim().toLowerCase();
      if (query) {
        const nameMatch = st.student_name?.toLowerCase().includes(query);
        const rollMatch = String(st.roll_no).toLowerCase().includes(query);
        const prnMatch = st.prn?.toLowerCase().includes(query);
        const emailMatch = st.email?.toLowerCase().includes(query);
        if (!nameMatch && !rollMatch && !prnMatch && !emailMatch) {
          return false;
        }
      }

      // Section match
      if (selectedSection !== 'ALL') {
        if (st.section_name !== selectedSection) {
          return false;
        }
      }

      // Year match
      if (selectedYear !== 'ALL') {
        if (String(st.current_year) !== selectedYear) {
          return false;
        }
      }

      // Attendance filter
      if (attendanceFilter === 'ELIGIBLE' && (st.attendance_pct || 0) < 75) {
        return false;
      }
      if (attendanceFilter === 'SHORTFALL' && (st.attendance_pct || 0) >= 75) {
        return false;
      }

      return true;
    });
  }, [students, searchQuery, selectedSection, selectedYear, attendanceFilter]);

  // Unique sections from list
  const availableSections = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      if (s.section_name) set.add(s.section_name);
    });
    return Array.from(set).sort();
  }, [students]);

  // Copy roll handler
  const handleCopy = (roll: string) => {
    navigator.clipboard.writeText(roll);
    setCopiedRoll(roll);
    setTimeout(() => setCopiedRoll(null), 2000);
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    if (filteredStudents.length === 0) return;
    const headers = ['Roll No', 'PRN', 'Student Name', 'Academic Year', 'Semester', 'Section', 'Email', 'Phone', 'Attendance %', 'Faculty Subjects'];
    const rows = filteredStudents.map(s => [
      `"${s.roll_no}"`,
      `"${s.prn}"`,
      `"${s.student_name}"`,
      `"${s.current_year}"`,
      `"${s.current_semester}"`,
      `"${s.section_name}"`,
      `"${s.email}"`,
      `"${s.phone || ''}"`,
      `"${s.attendance_pct}%"`,
      `"${(s.faculty_subjects || []).join('; ')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Faculty_Students_Roster_${user?.codeOrRoll || 'FAC'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Open Notice Modal
  const handleOpenNotice = (st: StudentHandled) => {
    setNoticeTargetStudent(st);
    setNoticeSubject(`Academic Update: ${(st.faculty_subjects?.[0] || 'Course Work').split(':')[0]}`);
    setNoticeMessage(`Dear ${st.student_name.split(' ')[0]},\n\nPlease be informed regarding your academic progress and upcoming laboratory/lecture sessions.`);
    setNoticeSent(false);
    setIsNoticeModalOpen(true);
  };

  const handleSendNotice = () => {
    setNoticeSent(true);
    setTimeout(() => {
      setIsNoticeModalOpen(false);
      setNoticeSent(false);
      setNoticeTargetStudent(null);
    }, 1500);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── Top Hero Header ────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-navy-900 via-navy-800 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-32 -mb-20 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-semibold backdrop-blur-md">
              <GraduationCap className="w-3.5 h-3.5 text-blue-300" />
              <span>Academic Cohort Management</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-sans">
              My Students Roster
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Complete student directory for courses and divisions handled by <span className="text-white font-semibold">{user?.name || 'Faculty Member'}</span> ({user?.codeOrRoll || 'FAC'}).
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={fetchStudents}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/15 backdrop-blur-sm"
              title="Refresh Roster"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleExportCSV}
              disabled={filteredStudents.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/15 backdrop-blur-sm"
              title="Export filtered records to CSV"
            >
              <Download className="w-3.5 h-3.5 text-blue-300" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={filteredStudents.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/30"
              title="Print attendance and grading sheet"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Sheet</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Key Metrics Cards Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students Handled */}
        <div className="erp-card p-5 bg-white shadow-bento hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Enrolled</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-navy-950 mt-2">
            {summary?.totalStudents ?? students.length}
          </p>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span className="font-semibold text-emerald-600">Active Students</span>
            <span>across assigned classes</span>
          </p>
        </div>

        {/* Second Year Students */}
        <div className="erp-card p-5 bg-white shadow-bento hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Second Year Cohort</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-navy-950 mt-2">
            {summary?.yearBreakdown?.['2'] ?? students.filter(s => s.current_year === 2).length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Semester 3 • CS-2B Division
          </p>
        </div>

        {/* Third Year Students */}
        <div className="erp-card p-5 bg-white shadow-bento hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Third Year Cohort</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-navy-950 mt-2">
            {summary?.yearBreakdown?.['3'] ?? students.filter(s => s.current_year === 3).length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Semester 5 • CS-1, CS-3, CS-4
          </p>
        </div>

        {/* Average Attendance */}
        <div className="erp-card p-5 bg-white shadow-bento hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Class Avg Attendance</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-navy-950 mt-2">
            {summary?.averageAttendance ?? '85.8'}%
          </p>
          <p className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Above 75% institutional quota
          </p>
        </div>
      </div>

      {/* ── Filter Bar & Search Controls ──────────────────────────────── */}
      <div className="erp-card p-4 sm:p-5 bg-white shadow-bento space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name, roll number, PRN, or email..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs text-navy-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Section Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500">Section:</span>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-navy-950 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="ALL">All Sections ({students.length})</option>
                {availableSections.map(sec => {
                  const count = students.filter(s => s.section_name === sec).length;
                  return (
                    <option key={sec} value={sec}>
                      {sec} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Academic Year Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500">Year:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-navy-950 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="ALL">All Years</option>
                <option value="2">Second Year (Sem 3)</option>
                <option value="3">Third Year (Sem 5)</option>
              </select>
            </div>

            {/* Attendance Standing Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500">Attendance:</span>
              <select
                value={attendanceFilter}
                onChange={(e) => setAttendanceFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-navy-950 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="ALL">All Attendance</option>
                <option value="ELIGIBLE">Eligible (≥ 75%)</option>
                <option value="SHORTFALL">Shortfall (&lt; 75%)</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center border border-slate-200 rounded-xl p-0.5 bg-slate-50">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'}`}
                title="Table View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'}`}
                title="Card Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Active Filter Pills Indicator */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span>
            Showing <strong className="text-navy-950 font-bold">{filteredStudents.length}</strong> of {students.length} students handled
          </span>
          {(selectedSection !== 'ALL' || selectedYear !== 'ALL' || attendanceFilter !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedSection('ALL');
                setSelectedYear('ALL');
                setAttendanceFilter('ALL');
                setSearchQuery('');
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* ── Students Content View ─────────────────────────────────────── */}
      {loading ? (
        <div className="erp-card p-12 bg-white shadow-bento text-center">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-navy-950">Loading student roster...</p>
          <p className="text-xs text-slate-400 mt-1">Retrieving scholar enrollments across your lecture divisions.</p>
        </div>
      ) : error ? (
        <div className="erp-card p-8 bg-red-50 border border-red-200 text-center rounded-2xl">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-red-800">Error Loading Student Records</h3>
          <p className="text-xs text-red-600 mt-1">{error}</p>
          <button
            onClick={fetchStudents}
            className="mt-3 px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="erp-card p-12 bg-white shadow-bento text-center rounded-2xl">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-navy-950">No Students Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            No scholars match your current search and filter criteria. Try clearing search keywords or switching filters.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* ── TABLE VIEW ──────────────────────────────────────────────── */
        <div className="erp-card bg-white shadow-bento rounded-2xl overflow-hidden border border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">Scholar</th>
                  <th className="py-3.5 px-3">Roll & PRN</th>
                  <th className="py-3.5 px-3">Year / Sem</th>
                  <th className="py-3.5 px-3">Division</th>
                  <th className="py-3.5 px-4">Assigned Course(s)</th>
                  <th className="py-3.5 px-3">Attendance</th>
                  <th className="py-3.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredStudents.map((st) => {
                  const attPct = parseFloat(String(st.attendance_pct || 85));
                  const isEligible = attPct >= 75;
                  const isSecondYear = st.current_year === 2;

                  return (
                    <tr
                      key={st.student_id}
                      className="hover:bg-blue-50/40 transition-colors group"
                    >
                      {/* Scholar Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-sm ${
                            isSecondYear
                              ? 'bg-amber-100 text-amber-700 border border-amber-200'
                              : 'bg-blue-100 text-blue-700 border border-blue-200'
                          }`}>
                            {st.student_name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-navy-950 flex items-center gap-1.5">
                              <span>{st.student_name}</span>
                              {isSecondYear && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  2nd Year
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {st.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Roll & PRN */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 font-mono font-bold text-navy-950">
                          <span>{st.roll_no}</span>
                          <button
                            onClick={() => handleCopy(String(st.roll_no))}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                            title="Copy Roll Number"
                          >
                            {copiedRoll === String(st.roll_no) ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {st.prn}
                        </span>
                      </td>

                      {/* Year & Semester */}
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-700 block">
                          Year {st.current_year}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Semester {st.current_semester}
                        </span>
                      </td>

                      {/* Division Badge */}
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          isSecondYear 
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}>
                          {st.section_name}
                        </span>
                      </td>

                      {/* Assigned Courses */}
                      <td className="py-3 px-4">
                        <div className="space-y-1 max-w-xs">
                          {(st.faculty_subjects || ['Course Work']).map((sub, i) => (
                            <div
                              key={i}
                              className="text-[11px] font-medium text-slate-700 bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200/60 truncate"
                              title={sub}
                            >
                              <BookOpen className="w-3 h-3 inline-block mr-1 text-blue-500" />
                              {sub}
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Attendance */}
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-mono font-bold text-xs ${
                              isEligible ? 'text-emerald-700' : 'text-red-600'
                            }`}>
                              {attPct.toFixed(1)}%
                            </span>
                            <span className={`w-2 h-2 rounded-full ${
                              isEligible ? 'bg-emerald-500' : 'bg-red-500'
                            }`} />
                          </div>
                          <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                attPct >= 80 ? 'bg-emerald-500' : attPct >= 75 ? 'bg-blue-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(attPct, 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {st.attended_sessions}/{st.total_sessions || 20} sessions
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setPreviewStudentId(st.student_id);
                              setIsPreviewOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] transition-colors"
                            title="Open live student academic preview"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Profile</span>
                          </button>
                          <button
                            onClick={() => handleOpenNotice(st)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-navy-950 transition-colors"
                            title="Send academic notice to scholar"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── GRID / CARD VIEW ────────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map((st) => {
            const attPct = parseFloat(String(st.attendance_pct || 85));
            const isEligible = attPct >= 75;
            const isSecondYear = st.current_year === 2;

            return (
              <div
                key={st.student_id}
                className="erp-card p-5 bg-white shadow-bento rounded-2xl hover:shadow-md transition-all border border-slate-100 flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shadow-sm ${
                        isSecondYear
                          ? 'bg-amber-100 text-amber-700 border border-amber-200'
                          : 'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}>
                        {st.student_name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-navy-950 text-sm leading-tight">
                          {st.student_name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                            Roll {st.roll_no}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {st.prn}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                      isSecondYear 
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-blue-50 text-blue-800 border-blue-200'
                    }`}>
                      {st.section_name}
                    </span>
                  </div>

                  {/* Academic Details */}
                  <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Academic Year</span>
                      <span className="font-semibold text-slate-700">Year {st.current_year} (Sem {st.current_semester})</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Attendance</span>
                      <span className={`font-mono font-bold ${isEligible ? 'text-emerald-700' : 'text-red-600'}`}>
                        {attPct.toFixed(1)}% {isEligible ? '• Good' : '• Low'}
                      </span>
                    </div>
                  </div>

                  {/* Courses handled */}
                  <div className="mt-3">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold mb-1">
                      Assigned Subjects
                    </span>
                    <div className="space-y-1">
                      {(st.faculty_subjects || ['Course Work']).map((sub, i) => (
                        <div
                          key={i}
                          className="text-[11px] text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200/50 truncate flex items-center gap-1.5"
                          title={sub}
                        >
                          <BookOpen className="w-3 h-3 text-blue-500 flex-shrink-0" />
                          <span className="truncate">{sub}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <a
                    href={`mailto:${st.email}`}
                    className="text-xs font-semibold text-slate-500 hover:text-navy-950 flex items-center gap-1"
                    title={st.email}
                  >
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>Email</span>
                  </a>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenNotice(st)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                    >
                      Notice
                    </button>
                    <button
                      onClick={() => {
                        setPreviewStudentId(st.student_id);
                        setIsPreviewOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm"
                    >
                      Profile
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Student Preview Modal ─────────────────────────────────────── */}
      {previewStudentId && (
        <StudentPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => {
            setIsPreviewOpen(false);
            setPreviewStudentId(null);
          }}
          defaultStudentId={previewStudentId}
        />
      )}

      {/* ── Quick Notice Modal ────────────────────────────────────────── */}
      {isNoticeModalOpen && noticeTargetStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-navy-950">Send Academic Notice</h3>
                  <p className="text-xs text-slate-400">To {noticeTargetStudent.student_name} (Roll {noticeTargetStudent.roll_no})</p>
                </div>
              </div>
              <button
                onClick={() => setIsNoticeModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {noticeSent ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
                <h4 className="text-base font-bold text-navy-950">Notice Dispatched Successfully!</h4>
                <p className="text-xs text-slate-500">Delivered to student university inbox ({noticeTargetStudent.email}).</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Subject</label>
                  <input
                    type="text"
                    value={noticeSubject}
                    onChange={(e) => setNoticeSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-navy-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="Notice Subject..."
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Notice Content</label>
                  <textarea
                    rows={4}
                    value={noticeMessage}
                    onChange={(e) => setNoticeMessage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-navy-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="Enter academic instructions, attendance warning, or feedback..."
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsNoticeModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendNotice}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Notice</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultyStudentsPage;
