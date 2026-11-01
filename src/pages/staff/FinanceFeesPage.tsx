import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  DollarSign, FileText, CreditCard, Search, Filter, Plus,
  RefreshCw, CheckCircle2, ChevronRight, Eye, Receipt, Calendar, ArrowRight, X,
  Users, BookOpen, BarChart3, TrendingUp, AlertCircle, Building, Wallet, Download, Check, AlertTriangle
} from 'lucide-react';
import { api } from '../../services/api';
import { Modal } from '../../components/common/Modal';

type FinanceTab = 'fees' | 'structures' | 'payments' | 'payroll' | 'library-fines' | 'reports';

interface FinanceFeesPageProps {
  initialTab?: FinanceTab;
}

export const FinanceFeesPage: React.FC<FinanceFeesPageProps> = ({ initialTab = 'fees' }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const getTabFromPath = (): FinanceTab => {
    if (location.pathname.includes('/fee-structures')) return 'structures';
    if (location.pathname.includes('/payments')) return 'payments';
    if (location.pathname.includes('/payroll')) return 'payroll';
    if (location.pathname.includes('/library-fines')) return 'library-fines';
    if (location.pathname.includes('/reports')) return 'reports';
    return initialTab || 'fees';
  };

  const [activeTab, setActiveTab] = useState<FinanceTab>(getTabFromPath());

  useEffect(() => {
    setActiveTab(getTabFromPath());
  }, [location.pathname]);

  const handleTabChange = (tab: FinanceTab) => {
    setActiveTab(tab);
    if (tab === 'fees') navigate('/staff/fees');
    else if (tab === 'payments') navigate('/staff/payments');
    else if (tab === 'payroll') navigate('/staff/payroll');
    else if (tab === 'library-fines') navigate('/staff/library-fines');
    else if (tab === 'structures') navigate('/staff/fee-structures');
    else if (tab === 'reports') navigate('/staff/reports');
  };

  // ─────────────────────────────────────────────
  // Data States
  // ─────────────────────────────────────────────
  const [students, setStudents] = useState<any[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [payrollSummary, setPayrollSummary] = useState<any>({
    totalPayroll: 0,
    totalDisbursed: 0,
    pendingSalary: 0,
    facultyCount: 0
  });
  const [libraryData, setLibraryData] = useState<any[]>([]);
  const [librarySummary, setLibrarySummary] = useState<any>({
    totalGenerated: 0,
    totalCollected: 0,
    totalOutstanding: 0,
    totalTransactions: 0
  });
  const [reportsData, setReportsData] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const notify = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 4000);
  };

  // ─────────────────────────────────────────────
  // Filters: Tab 1 (Student Dues)
  // ─────────────────────────────────────────────
  const [stuSearch, setStuSearch] = useState('');
  const [stuDept, setStuDept] = useState('');
  const [stuStatus, setStuStatus] = useState('');

  // Filters: Tab 2 (Payment Receipts)
  const [payReceiptNo, setPayReceiptNo] = useState('');
  const [payStudentName, setPayStudentName] = useState('');
  const [payMethod, setPayMethod] = useState('');
  const [payFeeType, setPayFeeType] = useState('');
  const [payStartDate, setPayStartDate] = useState('');
  const [payEndDate, setPayEndDate] = useState('');

  // Filters: Tab 3 (Faculty Payroll)
  const [facName, setFacName] = useState('');
  const [facId, setFacId] = useState('');
  const [facDept, setFacDept] = useState('');
  const [facMonth, setFacMonth] = useState('');
  const [facStatus, setFacStatus] = useState('');

  // Filters: Tab 4 (Library Collections)
  const [libStudent, setLibStudent] = useState('');
  const [libStatus, setLibStatus] = useState('');
  const [libStartDate, setLibStartDate] = useState('');
  const [libEndDate, setLibEndDate] = useState('');

  // Filters: Tab 6 (Financial Reports)
  const [repStartDate, setRepStartDate] = useState('');
  const [repEndDate, setRepEndDate] = useState('');
  const [repDept, setRepDept] = useState('');
  const [repCategory, setRepCategory] = useState('All');

  // Modals
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [studentDetails, setStudentDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payStudent, setPayStudent] = useState<any>(null);
  const [payStudentFees, setPayStudentFees] = useState<any[]>([]);
  const [selectedFeeId, setSelectedFeeId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('Cash');
  const [payRef, setPayRef] = useState('');
  const [submittingPay, setSubmittingPay] = useState(false);

  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  const [newStructure, setNewStructure] = useState({
    course_id: '1',
    semester_id: '1',
    fee_type: '',
    amount: '',
    academic_year: '2026-2027',
    due_date: ''
  });
  const [submittingStructure, setSubmittingStructure] = useState(false);

  // Payslip Modal
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);

  // Receipt Modal
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);

  // ─────────────────────────────────────────────
  // Load Functions
  // ─────────────────────────────────────────────
  const loadFeesData = async () => {
    try {
      const res = await api.getStudentsWithFees({
        search: stuSearch,
        dept: stuDept,
        status: stuStatus
      });
      if (res.success) setStudents(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadPaymentsData = async () => {
    try {
      const res = await api.getAllPayments({
        receiptNumber: payReceiptNo,
        studentName: payStudentName,
        paymentMethod: payMethod,
        feeType: payFeeType,
        startDate: payStartDate,
        endDate: payEndDate
      });
      if (res.success) setPayments(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadStructuresData = async () => {
    try {
      const res = await api.getFeeStructures();
      if (res.success) setStructures(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadPayrollData = async () => {
    try {
      const res = await api.getFinanceFacultyPayroll({
        facultyName: facName,
        facultyId: facId,
        department: facDept,
        salaryMonth: facMonth,
        status: facStatus
      });
      if (res.success) {
        setPayrollData(res.data || []);
        if (res.summary) setPayrollSummary(res.summary);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadLibraryData = async () => {
    try {
      const res = await api.getFinanceLibraryFinancials({
        studentName: libStudent,
        status: libStatus,
        startDate: libStartDate,
        endDate: libEndDate
      });
      if (res.success) {
        setLibraryData(res.data || []);
        if (res.summary) setLibrarySummary(res.summary);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadReportsData = async () => {
    try {
      const res = await api.getFinancialReports({
        startDate: repStartDate,
        endDate: repEndDate,
        department: repDept,
        category: repCategory
      });
      if (res.success) setReportsData(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadCurrentTabData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'fees') {
        await loadFeesData();
      } else if (activeTab === 'payments') {
        await loadPaymentsData();
      } else if (activeTab === 'structures') {
        await loadStructuresData();
      } else if (activeTab === 'payroll') {
        await loadPayrollData();
      } else if (activeTab === 'library-fines') {
        await loadLibraryData();
      } else if (activeTab === 'reports') {
        await loadReportsData();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentTabData();
  }, [activeTab]);

  // Initial load for tab counts
  useEffect(() => {
    api.getStudentsWithFees().then(r => r.success && setStudents(r.data || [])).catch(() => {});
    api.getAllPayments().then(r => r.success && setPayments(r.data || [])).catch(() => {});
    api.getFeeStructures().then(r => r.success && setStructures(r.data || [])).catch(() => {});
    api.getFinanceFacultyPayroll().then(r => r.success && setPayrollData(r.data || [])).catch(() => {});
    api.getFinanceLibraryFinancials().then(r => r.success && setLibraryData(r.data || [])).catch(() => {});
  }, []);

  // Student Details
  const viewStudentDetails = async (studentId: number) => {
    setSelectedStudentId(studentId);
    setLoadingDetails(true);
    try {
      const res = await api.getStudentFeeDetails(studentId);
      if (res.success) {
        setStudentDetails(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Collect Fee Modal
  const openPaymentForStudent = async (stu: any) => {
    setPayStudent(stu);
    try {
      const res = await api.getStudentFeeDetails(stu.student_id);
      if (res.success) {
        const fees = (res.data.fees || []).filter((f: any) => f.status !== 'Paid');
        setPayStudentFees(fees);
        if (fees.length > 0) {
          setSelectedFeeId(String(fees[0].student_fee_id));
          const bal = parseFloat(fees[0].balance_amount !== undefined ? fees[0].balance_amount : (fees[0].amount_due - fees[0].amount_paid));
          setPayAmount(String(bal > 0 ? bal : ''));
        }
      }
    } catch (e) {
      console.error(e);
    }
    setIsPayModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFeeId || !payAmount) return;
    setSubmittingPay(true);
    try {
      const res = await api.recordPayment(Number(selectedFeeId), {
        amount: parseFloat(payAmount),
        payment_mode: payMode,
        transaction_reference: payRef || `TXN-${Date.now().toString().slice(-6)}`,
        roll_no: payStudent?.roll_no
      });
      if (res.success) {
        setIsPayModalOpen(false);
        notify(res.message || 'Payment recorded successfully.');
        loadFeesData();
        loadPaymentsData();
        if (payStudent?.student_id) {
          viewStudentDetails(payStudent.student_id);
        } else if (selectedStudentId) {
          viewStudentDetails(selectedStudentId);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to record payment');
    } finally {
      setSubmittingPay(false);
    }
  };

  const handleAddStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStructure.fee_type || !newStructure.amount) return;
    setSubmittingStructure(true);
    try {
      const res = await api.addFeeStructure(newStructure);
      if (res.success) {
        setIsStructureModalOpen(false);
        notify('Fee structure created successfully.');
        loadStructuresData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to add fee structure');
    } finally {
      setSubmittingStructure(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Finance & Institutional Treasury</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage student fee dues, counter receipts, faculty payroll disbursements, library fine revenue, and financial reports
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsStructureModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#6C3483] border border-purple-200 text-xs font-bold transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Fee Structure</span>
          </button>
          <button
            onClick={loadCurrentTabData}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
            title="Refresh current section"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {notice && (
        <div className="flex items-center gap-2 p-4 bg-purple-50 border border-purple-200 text-purple-800 rounded-2xl text-xs font-semibold animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-px">
        <button
          onClick={() => handleTabChange('fees')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'fees'
              ? 'border-[#9B59B6] text-[#9B59B6]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Student Dues ({students.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('payments')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'payments'
              ? 'border-[#9B59B6] text-[#9B59B6]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Payment Receipts ({payments.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('payroll')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'payroll'
              ? 'border-[#9B59B6] text-[#9B59B6]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Faculty Payroll & Disbursements ({payrollData.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('library-fines')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'library-fines'
              ? 'border-[#9B59B6] text-[#9B59B6]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Library Collections & Fines ({libraryData.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('structures')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'structures'
              ? 'border-[#9B59B6] text-[#9B59B6]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Fee Structures ({structures.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('reports')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'reports'
              ? 'border-[#9B59B6] text-[#9B59B6]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Financial Reports</span>
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 1: STUDENT FEES & DUES */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === 'fees' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search student name, roll number, or email..."
                value={stuSearch}
                onChange={e => setStuSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') loadFeesData(); }}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9B59B6]"
              />
            </div>

            <div className="w-44">
              <select
                value={stuDept}
                onChange={e => setStuDept(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9B59B6]"
              >
                <option value="">All Departments</option>
                <option value="1">Computer Science</option>
                <option value="2">Electronics & Telecomm</option>
                <option value="3">Information Technology</option>
                <option value="4">AIDS</option>
                <option value="5">ENCE</option>
              </select>
            </div>

            <div className="w-36">
              <select
                value={stuStatus}
                onChange={e => setStuStatus(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9B59B6]"
              >
                <option value="">All Statuses</option>
                <option value="Paid">Fully Paid</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Unpaid">Unpaid</option>
              </select>
            </div>

            <button
              onClick={loadFeesData}
              className="px-4 py-2 bg-[#9B59B6] hover:bg-[#8e44ad] text-white text-xs font-bold rounded-xl transition-all shadow-sm"
            >
              Filter
            </button>

            {(stuSearch || stuDept || stuStatus) && (
              <button
                onClick={() => { setStuSearch(''); setStuDept(''); setStuStatus(''); setTimeout(loadFeesData, 10); }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all"
              >
                Reset
              </button>
            )}
          </div>

          {/* Dues Table */}
          <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Student Fee Accounts ({students.length})</h2>
              <span className="text-xs text-slate-400 font-mono">Real-time ledger balances</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Student</th>
                    <th className="px-4 py-3.5">Department</th>
                    <th className="px-4 py-3.5">Total Invoiced</th>
                    <th className="px-4 py-3.5">Amount Paid</th>
                    <th className="px-4 py-3.5">Remaining Balance</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map(s => {
                    const due = parseFloat(s.total_due) || 0;
                    const paid = parseFloat(s.total_paid) || 0;
                    const bal = parseFloat(s.balance) || 0;

                    return (
                      <tr key={s.student_id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-slate-800">{s.student_name}</p>
                          <p className="text-[11px] font-mono text-slate-400">{s.roll_no} • {s.email}</p>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-600">
                          {s.branch || s.department_name}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-slate-700">
                          ₹{due.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3.5 font-mono font-semibold text-emerald-700">
                          ₹{paid.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3.5 font-mono font-extrabold text-purple-700">
                          ₹{bal.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                            s.overall_status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                            s.overall_status === 'Partially Paid' ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {s.overall_status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-2">
                          <button
                            onClick={() => viewStudentDetails(s.student_id)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors"
                          >
                            Breakdown
                          </button>
                          {bal > 0 && (
                            <button
                              onClick={() => openPaymentForStudent(s)}
                              className="px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#6C3483] font-bold text-[11px] border border-purple-200 transition-colors"
                            >
                              Collect Fee
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {students.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400 text-xs">
                        No student fee records match your search or filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 2: PAYMENT RECEIPTS */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          {/* Payment Receipts Filters Bar */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-wrap items-center gap-3">
            <div className="w-44 relative">
              <input
                type="text"
                placeholder="Receipt / TXN Ref..."
                value={payReceiptNo}
                onChange={e => setPayReceiptNo(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') loadPaymentsData(); }}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9B59B6]"
              />
            </div>

            <div className="flex-1 min-w-[180px]">
              <input
                type="text"
                placeholder="Student Name or Roll No..."
                value={payStudentName}
                onChange={e => setPayStudentName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') loadPaymentsData(); }}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9B59B6]"
              />
            </div>

            <div className="w-36">
              <select
                value={payMethod}
                onChange={e => setPayMethod(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9B59B6]"
              >
                <option value="">All Payment Modes</option>
                <option value="Cash">Cash (Counter)</option>
                <option value="UPI">UPI / Online</option>
                <option value="Net Banking">Net Banking</option>
                <option value="Cheque / DD">Cheque / DD</option>
              </select>
            </div>

            <div className="w-36">
              <input
                type="text"
                placeholder="Fee Type (e.g. Tuition)"
                value={payFeeType}
                onChange={e => setPayFeeType(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') loadPaymentsData(); }}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9B59B6]"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <input
                type="date"
                value={payStartDate}
                onChange={e => setPayStartDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs"
                title="Start Date"
              />
              <span>to</span>
              <input
                type="date"
                value={payEndDate}
                onChange={e => setPayEndDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs"
                title="End Date"
              />
            </div>

            <button
              onClick={loadPaymentsData}
              className="px-4 py-2 bg-[#9B59B6] hover:bg-[#8e44ad] text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              Filter
            </button>

            {(payReceiptNo || payStudentName || payMethod || payFeeType || payStartDate || payEndDate) && (
              <button
                onClick={() => {
                  setPayReceiptNo('');
                  setPayStudentName('');
                  setPayMethod('');
                  setPayFeeType('');
                  setPayStartDate('');
                  setPayEndDate('');
                  setTimeout(loadPaymentsData, 10);
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all"
              >
                Reset
              </button>
            )}
          </div>

          {/* Payments Table */}
          <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Verified Payment Receipts ({payments.length})</h2>
              <span className="text-xs text-slate-400 font-mono">Official treasury transactions</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Receipt ID / Ref</th>
                    <th className="px-4 py-3.5">Student</th>
                    <th className="px-4 py-3.5">Fee Type</th>
                    <th className="px-4 py-3.5">Payment Mode</th>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-4 py-3.5">Amount</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map(p => (
                    <tr key={p.payment_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-bold text-purple-900">
                        {p.transaction_reference || `REC-${p.payment_id}`}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-slate-800">{p.student_name}</p>
                        <p className="text-[11px] font-mono text-slate-400">{p.roll_no}</p>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 font-medium">
                        {p.fee_type || 'Tuition Fee'}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-700">
                        {p.payment_mode}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px]">
                        {p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                      </td>
                      <td className="px-4 py-3.5 font-mono font-extrabold text-emerald-700">
                        ₹{parseFloat(p.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                          {p.status || 'Success'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedReceipt(p)}
                          className="px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#6C3483] font-bold text-[11px] border border-purple-200 transition-colors inline-flex items-center gap-1"
                        >
                          <Receipt className="w-3 h-3" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && !loading && (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400 text-xs">
                        No payment receipts matched your filter parameters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 3: FACULTY PAYROLL & DISBURSEMENTS */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === 'payroll' && (
        <div className="space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-[20px] p-5 shadow-sm border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-[#9B59B6] mb-3">
                <Wallet className="w-5 h-5" />
              </div>
              <p className="text-2xl font-extrabold text-slate-800">
                ₹{(payrollSummary.totalPayroll / 100000).toFixed(2)} L
              </p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Total Faculty Payroll</p>
            </div>

            <div className="bg-white rounded-[20px] p-5 shadow-sm border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3">
                <Check className="w-5 h-5" />
              </div>
              <p className="text-2xl font-extrabold text-slate-800">
                ₹{(payrollSummary.totalDisbursed / 100000).toFixed(2)} L
              </p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Total Salary Disbursed</p>
            </div>

            <div className="bg-white rounded-[20px] p-5 shadow-sm border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 mb-3">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <p className="text-2xl font-extrabold text-slate-800">
                ₹{(payrollSummary.pendingSalary / 100000).toFixed(2)} L
              </p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Pending Salary Payments</p>
            </div>

            <div className="bg-white rounded-[20px] p-5 shadow-sm border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-3">
                <Users className="w-5 h-5" />
              </div>
              <p className="text-2xl font-extrabold text-slate-800">
                {payrollSummary.facultyCount || payrollData.length}
              </p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Faculty Members</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[180px] relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search faculty name or email..."
                value={facName}
                onChange={e => setFacName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') loadPayrollData(); }}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9B59B6]"
              />
            </div>

            <div className="w-32">
              <input
                type="text"
                placeholder="Faculty ID..."
                value={facId}
                onChange={e => setFacId(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') loadPayrollData(); }}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9B59B6]"
              />
            </div>

            <div className="w-44">
              <select
                value={facDept}
                onChange={e => setFacDept(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9B59B6]"
              >
                <option value="">All Departments</option>
                <option value="1">Computer Science</option>
                <option value="2">Electronics & Telecomm</option>
                <option value="3">Information Technology</option>
                <option value="4">AIDS</option>
                <option value="5">ENCE</option>
              </select>
            </div>

            <div className="w-36">
              <input
                type="text"
                placeholder="Month (e.g. October 2026)"
                value={facMonth}
                onChange={e => setFacMonth(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') loadPayrollData(); }}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9B59B6]"
              />
            </div>

            <div className="w-32">
              <select
                value={facStatus}
                onChange={e => setFacStatus(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9B59B6]"
              >
                <option value="">All Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            <button
              onClick={loadPayrollData}
              className="px-4 py-2 bg-[#9B59B6] hover:bg-[#8e44ad] text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              Filter
            </button>

            {(facName || facId || facDept || facMonth || facStatus) && (
              <button
                onClick={() => {
                  setFacName('');
                  setFacId('');
                  setFacDept('');
                  setFacMonth('');
                  setFacStatus('');
                  setTimeout(loadPayrollData, 10);
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all"
              >
                Reset
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Faculty Payroll Ledger ({payrollData.length})</h2>
                <p className="text-[11px] text-slate-400">Institutional personnel expenditure and disbursement records</p>
              </div>
              <span className="text-xs text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1 rounded-xl font-bold">
                Institutional Expense Ledger
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Faculty Member</th>
                    <th className="px-4 py-3.5">Department</th>
                    <th className="px-4 py-3.5">Salary Month</th>
                    <th className="px-4 py-3.5">Basic Pay</th>
                    <th className="px-4 py-3.5">Gross Earnings</th>
                    <th className="px-4 py-3.5">Deductions</th>
                    <th className="px-4 py-3.5">Net Salary</th>
                    <th className="px-4 py-3.5">Disbursement Date</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Payslip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payrollData.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-slate-800">{p.faculty_name}</p>
                        <p className="text-[11px] font-mono text-slate-400">ID: {p.faculty_id} • {p.designation}</p>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-600">
                        {p.department_name}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-purple-950 font-mono">
                        {p.month_year}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-700">
                        ₹{Number(p.basic_salary).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3.5 font-mono font-semibold text-slate-800">
                        ₹{Number(p.gross_salary).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-rose-600 font-semibold">
                        -₹{Number(p.total_deductions).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3.5 font-mono font-extrabold text-emerald-800 bg-emerald-50/50">
                        ₹{Number(p.net_salary).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-500 text-[11px]">
                        {p.disbursement_date ? new Date(p.disbursement_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Pending'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          p.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedPayslip(p)}
                          className="px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#6C3483] font-bold text-[11px] border border-purple-200 transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Slip</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {payrollData.length === 0 && !loading && (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-slate-400 text-xs">
                        No faculty payroll records matched your filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 4: LIBRARY COLLECTIONS & FINES */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === 'library-fines' && (
        <div className="space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-[20px] p-5 shadow-sm border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-[#9B59B6] mb-3">
                <Receipt className="w-5 h-5" />
              </div>
              <p className="text-2xl font-extrabold text-slate-800">
                ₹{librarySummary.totalGenerated.toLocaleString('en-IN')}
              </p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Total Fines Generated</p>
            </div>

            <div className="bg-white rounded-[20px] p-5 shadow-sm border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3">
                <Check className="w-5 h-5" />
              </div>
              <p className="text-2xl font-extrabold text-slate-800">
                ₹{librarySummary.totalCollected.toLocaleString('en-IN')}
              </p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Library Amount Collected</p>
            </div>

            <div className="bg-white rounded-[20px] p-5 shadow-sm border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 mb-3">
                <AlertCircle className="w-5 h-5" />
              </div>
              <p className="text-2xl font-extrabold text-slate-800">
                ₹{librarySummary.totalOutstanding.toLocaleString('en-IN')}
              </p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Outstanding Library Fines</p>
            </div>

            <div className="bg-white rounded-[20px] p-5 shadow-sm border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-3">
                <BookOpen className="w-5 h-5" />
              </div>
              <p className="text-2xl font-extrabold text-slate-800">
                {librarySummary.totalTransactions}
              </p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Fine Transactions</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search student name or roll number..."
                value={libStudent}
                onChange={e => setLibStudent(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') loadLibraryData(); }}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9B59B6]"
              />
            </div>

            <div className="w-40">
              <select
                value={libStatus}
                onChange={e => setLibStatus(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9B59B6]"
              >
                <option value="">All Fine Statuses</option>
                <option value="Paid">Collected / Paid</option>
                <option value="Pending">Outstanding / Pending</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <input
                type="date"
                value={libStartDate}
                onChange={e => setLibStartDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs"
                title="Start Date"
              />
              <span>to</span>
              <input
                type="date"
                value={libEndDate}
                onChange={e => setLibEndDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs"
                title="End Date"
              />
            </div>

            <button
              onClick={loadLibraryData}
              className="px-4 py-2 bg-[#9B59B6] hover:bg-[#8e44ad] text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              Filter
            </button>

            {(libStudent || libStatus || libStartDate || libEndDate) && (
              <button
                onClick={() => {
                  setLibStudent('');
                  setLibStatus('');
                  setLibStartDate('');
                  setLibEndDate('');
                  setTimeout(loadLibraryData, 10);
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all"
              >
                Reset
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Library Fines & Collection Records ({libraryData.length})</h2>
                <p className="text-[11px] text-slate-400">Institutional non-tuition revenue stream from library late returns</p>
              </div>
              <span className="text-xs text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1 rounded-xl font-bold">
                Ancillary Income
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Reference No.</th>
                    <th className="px-4 py-3.5">Student</th>
                    <th className="px-4 py-3.5">Book Details</th>
                    <th className="px-4 py-3.5">Fine Amount</th>
                    <th className="px-4 py-3.5">Amount Paid</th>
                    <th className="px-4 py-3.5">Outstanding Fine</th>
                    <th className="px-4 py-3.5">Payment Date</th>
                    <th className="px-4 py-3.5">Payment Method</th>
                    <th className="px-5 py-3.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {libraryData.map(f => (
                    <tr key={f.fine_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-bold text-purple-900">
                        {f.receipt_ref}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-slate-800">{f.student_name}</p>
                        <p className="text-[11px] font-mono text-slate-400">{f.roll_no} • {f.department_name}</p>
                      </td>
                      <td className="px-4 py-3.5 max-w-[220px]">
                        <p className="font-semibold text-slate-800 truncate" title={f.book_title}>{f.book_title}</p>
                        <p className="text-[10px] font-mono text-slate-400">{f.book_id} • {f.fine_type}</p>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-700 font-semibold">
                        ₹{Number(f.fine_amount).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-emerald-700 font-bold">
                        ₹{Number(f.amount_paid).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3.5 font-mono font-extrabold text-rose-700">
                        ₹{Number(f.outstanding_fine).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-500 text-[11px]">
                        {f.payment_date ? new Date(f.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Unsettled'}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 font-medium text-[11px]">
                        {f.payment_method}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          f.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {f.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {libraryData.length === 0 && !loading && (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400 text-xs">
                        No library fine records match the specified search filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 5: FEE STRUCTURES */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === 'structures' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {structures.map(fs => (
              <div
                key={fs.fee_structure_id || fs.id}
                className="bg-white rounded-[20px] p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-bold text-slate-800">{fs.fee_type}</h3>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800">
                      {fs.academic_year}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{fs.course_name || 'B.Tech Program'}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Semester {fs.semester_number || 1}</p>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Total Amount:</span>
                    <span className="text-base font-extrabold text-purple-800">
                      ₹{parseFloat(fs.amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="mt-3 text-[10px] font-mono text-slate-400">
                  Due: {fs.due_date ? new Date(fs.due_date).toLocaleDateString() : 'Standard Term'}
                </div>
              </div>
            ))}
            {structures.length === 0 && !loading && (
              <div className="col-span-full py-12 text-center text-slate-400 text-xs">
                No fee structures defined yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 6: FINANCIAL REPORTS (RESTORATION & FIX) */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Reports Filter Bar */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="font-bold text-slate-700">Date Range:</span>
              <input
                type="date"
                value={repStartDate}
                onChange={e => setRepStartDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs"
              />
              <span>to</span>
              <input
                type="date"
                value={repEndDate}
                onChange={e => setRepEndDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs"
              />
            </div>

            <div className="w-44">
              <select
                value={repDept}
                onChange={e => setRepDept(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9B59B6]"
              >
                <option value="">All Departments</option>
                <option value="1">Computer Science</option>
                <option value="2">Electronics & Telecomm</option>
                <option value="3">Information Technology</option>
                <option value="4">AIDS</option>
                <option value="5">ENCE</option>
              </select>
            </div>

            <div className="w-40">
              <select
                value={repCategory}
                onChange={e => setRepCategory(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9B59B6]"
              >
                <option value="All">All Categories</option>
                <option value="Income">Income Only</option>
                <option value="Expenses">Expenses Only</option>
              </select>
            </div>

            <button
              onClick={loadReportsData}
              className="px-4 py-2 bg-[#9B59B6] hover:bg-[#8e44ad] text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              Generate Report
            </button>

            {(repStartDate || repEndDate || repDept || repCategory !== 'All') && (
              <button
                onClick={() => {
                  setRepStartDate('');
                  setRepEndDate('');
                  setRepDept('');
                  setRepCategory('All');
                  setTimeout(loadReportsData, 10);
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all"
              >
                Reset
              </button>
            )}
          </div>

          {reportsData ? (
            <div className="space-y-6">
              {/* Executive Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Income Card */}
                {(repCategory === 'All' || repCategory === 'Income') && (
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 rounded-[24px] p-5 border border-emerald-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                        Total Income Realized
                      </span>
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-3xl font-extrabold text-emerald-950 font-mono">
                      ₹{(reportsData.summary.income.totalIncomeCollected / 10000000).toFixed(2)} Cr
                    </p>
                    <div className="mt-3 pt-3 border-t border-emerald-200/60 text-xs space-y-1 text-emerald-900 font-medium">
                      <div className="flex justify-between">
                        <span>Student Tuition Fees:</span>
                        <span className="font-bold">₹{(reportsData.summary.income.feeCollected / 100000).toFixed(1)} L</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Library Fine Revenue:</span>
                        <span className="font-bold">₹{reportsData.summary.income.fineCollected.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 pt-1 border-t border-emerald-200/40">
                        <span>Outstanding Receivables:</span>
                        <span className="font-extrabold">₹{(reportsData.summary.income.totalReceivables / 100000).toFixed(1)} L</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Expenses Card */}
                {(repCategory === 'All' || repCategory === 'Expenses') && (
                  <div className="bg-gradient-to-br from-rose-50 to-orange-50/50 rounded-[24px] p-5 border border-rose-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-rose-800">
                        Institutional Expenses
                      </span>
                      <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-700">
                        <Wallet className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-3xl font-extrabold text-rose-950 font-mono">
                      ₹{(reportsData.summary.expenses.salaryDisbursed / 100000).toFixed(2)} L
                    </p>
                    <div className="mt-3 pt-3 border-t border-rose-200/60 text-xs space-y-1 text-rose-900 font-medium">
                      <div className="flex justify-between">
                        <span>Faculty Salary Disbursed:</span>
                        <span className="font-bold">₹{(reportsData.summary.expenses.salaryDisbursed / 100000).toFixed(1)} L</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Pending Salary Liabilities:</span>
                        <span className="font-bold">₹{(reportsData.summary.expenses.salaryPending / 100000).toFixed(1)} L</span>
                      </div>
                      <div className="flex justify-between text-rose-700 pt-1 border-t border-rose-200/40">
                        <span>Total Salary Budgeted:</span>
                        <span className="font-extrabold">₹{(reportsData.summary.expenses.totalBudgeted / 100000).toFixed(1)} L</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Net Operating Surplus Card */}
                {repCategory === 'All' && (
                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50/50 rounded-[24px] p-5 border border-purple-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-purple-800">
                        Net Operating Balance
                      </span>
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-[#6C3483]">
                        <Building className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-3xl font-extrabold text-purple-950 font-mono">
                      ₹{(reportsData.summary.netInstitutionalSurplus / 10000000).toFixed(2)} Cr
                    </p>
                    <div className="mt-3 pt-3 border-t border-purple-200/60 text-xs space-y-1 text-purple-900 font-medium">
                      <div className="flex justify-between">
                        <span>Operating Surplus:</span>
                        <span className="font-bold">Positive Treasury Balance</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Fee Collection Rate:</span>
                        <span className="font-bold">
                          {reportsData.summary.income.feeTotalInvoiced > 0
                            ? Math.round((reportsData.summary.income.feeCollected / reportsData.summary.income.feeTotalInvoiced) * 100)
                            : 100}%
                        </span>
                      </div>
                      <div className="flex justify-between text-purple-700 pt-1 border-t border-purple-200/40">
                        <span>Audited Ledger:</span>
                        <span className="font-extrabold text-emerald-700">Verified & Reconciled</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Department Fee Collections Table */}
              <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-[#9B59B6]">
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-800">Department-wise Fee Collection</h2>
                      <p className="text-[11px] text-slate-400">Total invoiced fees, counter collections, and outstanding dues by branch</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-purple-700">Audited Branch Breakdown</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Department</th>
                        <th className="px-4 py-3">Enrolled Students</th>
                        <th className="px-4 py-3">Total Invoiced</th>
                        <th className="px-4 py-3">Collected (Income)</th>
                        <th className="px-4 py-3">Outstanding (Receivable)</th>
                        <th className="px-4 py-3 text-right">Recovery Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportsData.departmentCollections.map((dept: any) => (
                        <tr key={dept.department_id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3.5">
                            <p className="font-bold text-slate-800">{dept.department_name}</p>
                            <p className="text-[10px] font-mono text-slate-400">Code: {dept.branch_code}</p>
                          </td>
                          <td className="px-4 py-3.5 font-bold text-slate-700">
                            {dept.student_count}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-700">
                            ₹{dept.invoiced.toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3.5 font-mono font-bold text-emerald-700">
                            ₹{dept.collected.toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3.5 font-mono font-extrabold text-purple-700">
                            ₹{dept.balance.toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-24 bg-slate-200 h-2 rounded-full overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-[#9B59B6] to-[#8e44ad] h-full rounded-full"
                                  style={{ width: `${dept.collectionPercentage}%` }}
                                />
                              </div>
                              <span className="font-bold font-mono text-purple-800 text-[11px]">
                                {dept.collectionPercentage}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment Mode Breakdown */}
              <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-[#9B59B6]">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-800">Payment Mode Breakdown</h2>
                      <p className="text-[11px] text-slate-400">Collection volume and transaction distribution across payment channels</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {reportsData.paymentModes.map((m: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <p className="text-xs font-bold text-slate-500 uppercase">{m.payment_mode}</p>
                      <p className="text-xl font-extrabold text-slate-800 mt-1 font-mono">
                        ₹{m.total.toLocaleString('en-IN')}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {m.count} successful transactions
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[24px] p-12 text-center text-slate-400 border border-slate-100">
              <BarChart3 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold">Generating Financial Reports...</p>
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* MODAL 1: STUDENT DETAILS BREAKDOWN */}
      {/* ────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!selectedStudentId}
        onClose={() => { setSelectedStudentId(null); setStudentDetails(null); }}
        title="Student Fee Breakdown"
        subtitle={studentDetails?.student ? `${studentDetails.student.student_name} (${studentDetails.student.roll_no}) — ${studentDetails.student.branch || studentDetails.student.department_name}` : ''}
        maxWidth="2xl"
      >
        {loadingDetails ? (
          <div className="py-12 flex justify-center"><RefreshCw className="w-6 h-6 animate-spin text-[#9B59B6]" /></div>
        ) : studentDetails ? (
          <div className="space-y-5">
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Invoiced Fee Components</h4>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {(studentDetails.fees || []).map((f: any) => (
                  <div key={f.student_fee_id} className="p-3 flex items-center justify-between text-xs bg-white">
                    <div>
                      <p className="font-bold text-slate-800">{f.fee_type || 'Tuition Fee'}</p>
                      <p className="text-[10px] text-slate-400">Due Date: {f.due_date ? new Date(f.due_date).toLocaleDateString() : 'Standard Term'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-slate-700">₹{parseFloat(f.amount_due).toLocaleString('en-IN')}</p>
                      <p className="text-[10px] text-emerald-600 font-semibold">Paid: ₹{parseFloat(f.amount_paid).toLocaleString('en-IN')}</p>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        f.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                        f.status === 'Partially Paid' ? 'bg-amber-100 text-amber-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {f.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Recorded Payments</h4>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {(studentDetails.payments || []).map((p: any) => (
                  <div key={p.payment_id} className="p-3 flex items-center justify-between text-xs bg-white">
                    <div>
                      <p className="font-bold text-purple-900">{p.transaction_reference || `REC-${p.payment_id}`}</p>
                      <p className="text-[10px] text-slate-400">{p.payment_mode} • {p.payment_date ? new Date(p.payment_date).toLocaleDateString() : 'N/A'}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-extrabold text-emerald-700">₹{parseFloat(p.amount).toLocaleString('en-IN')}</span>
                      <span className="text-[9px] font-bold text-emerald-600 block">{p.status || 'Success'}</span>
                    </div>
                  </div>
                ))}
                {(!studentDetails.payments?.length) && (
                  <div className="p-4 text-center text-slate-400 text-xs">No payments recorded for this student yet.</div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ────────────────────────────────────────────────────────── */}
      {/* MODAL 2: COLLECT FEE PAYMENT */}
      {/* ────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title="Record Fee Payment"
        subtitle={payStudent ? `${payStudent.student_name} (${payStudent.roll_no})` : ''}
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Fee Item *</label>
            <select
              value={selectedFeeId}
              onChange={e => {
                setSelectedFeeId(e.target.value);
                const fee = payStudentFees.find(f => String(f.student_fee_id) === e.target.value);
                if (fee) {
                  const bal = parseFloat(fee.balance_amount !== undefined ? fee.balance_amount : (fee.amount_due - fee.amount_paid));
                  setPayAmount(String(bal > 0 ? bal : ''));
                }
              }}
              required
              className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9B59B6]"
            >
              {payStudentFees.map(f => {
                const bal = parseFloat(f.balance_amount !== undefined ? f.balance_amount : (f.amount_due - f.amount_paid));
                return (
                  <option key={f.student_fee_id} value={f.student_fee_id}>
                    {f.fee_type || 'Tuition Fee'} (Due: ₹{bal.toLocaleString('en-IN')})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount to Pay (₹) *</label>
              <input
                type="number"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                required
                min="1"
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9B59B6]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Mode</label>
              <select
                value={payMode}
                onChange={e => setPayMode(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9B59B6]"
              >
                <option value="Cash">Cash (Counter)</option>
                <option value="UPI">UPI / QR</option>
                <option value="Net Banking">Net Banking</option>
                <option value="Cheque / DD">Cheque / DD</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Transaction Ref / Receipt No</label>
            <input
              type="text"
              placeholder="e.g. REC-10293 or bank reference"
              value={payRef}
              onChange={e => setPayRef(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9B59B6]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsPayModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingPay || !selectedFeeId}
              className="px-4 py-2 rounded-xl bg-[#9B59B6] hover:bg-[#8e44ad] text-white text-xs font-bold shadow-md disabled:opacity-50"
            >
              {submittingPay ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ────────────────────────────────────────────────────────── */}
      {/* MODAL 3: ADD FEE STRUCTURE */}
      {/* ────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isStructureModalOpen}
        onClose={() => setIsStructureModalOpen(false)}
        title="Add Fee Structure"
        subtitle="Define new institutional fee component"
      >
        <form onSubmit={handleAddStructure} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Fee Type / Component Name *</label>
            <input
              type="text"
              placeholder="e.g. Annual Tuition Fee, Hostel Deposit"
              value={newStructure.fee_type}
              onChange={e => setNewStructure({ ...newStructure, fee_type: e.target.value })}
              required
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9B59B6]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹) *</label>
              <input
                type="number"
                placeholder="e.g. 75000"
                value={newStructure.amount}
                onChange={e => setNewStructure({ ...newStructure, amount: e.target.value })}
                required
                min="100"
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9B59B6]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Academic Year</label>
              <input
                type="text"
                placeholder="2026-2027"
                value={newStructure.academic_year}
                onChange={e => setNewStructure({ ...newStructure, academic_year: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9B59B6]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Due Date</label>
            <input
              type="date"
              value={newStructure.due_date}
              onChange={e => setNewStructure({ ...newStructure, due_date: e.target.value })}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9B59B6]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsStructureModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingStructure}
              className="px-4 py-2 rounded-xl bg-[#9B59B6] hover:bg-[#8e44ad] text-white text-xs font-bold shadow-md disabled:opacity-50"
            >
              {submittingStructure ? 'Creating...' : 'Create Structure'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ────────────────────────────────────────────────────────── */}
      {/* MODAL 4: FACULTY PAYSLIP DETAIL */}
      {/* ────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!selectedPayslip}
        onClose={() => setSelectedPayslip(null)}
        title="Faculty Salary Payslip"
        subtitle={selectedPayslip ? `${selectedPayslip.faculty_name} (ID: ${selectedPayslip.faculty_id}) — ${selectedPayslip.month_year}` : ''}
        maxWidth="lg"
      >
        {selectedPayslip && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-extrabold text-purple-950 font-mono">{selectedPayslip.slip_ref_no}</p>
                <p className="text-[11px] text-purple-700">{selectedPayslip.department_name} • {selectedPayslip.designation}</p>
              </div>
              <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                {selectedPayslip.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
                <p className="font-bold text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-100 pb-1">Earnings</p>
                <div className="flex justify-between"><span>Basic Pay:</span><span className="font-mono font-bold">₹{Number(selectedPayslip.basic_salary).toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between"><span>HRA Allowance:</span><span className="font-mono font-bold">₹{Number(selectedPayslip.hra_allowance).toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between"><span>DA Allowance:</span><span className="font-mono font-bold">₹{Number(selectedPayslip.da_allowance).toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between pt-1 border-t border-slate-100 font-extrabold text-purple-900">
                  <span>Gross Salary:</span>
                  <span className="font-mono">₹{Number(selectedPayslip.gross_salary).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
                <p className="font-bold text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-100 pb-1">Deductions & Net</p>
                <div className="flex justify-between"><span>PF & Tax:</span><span className="font-mono text-rose-600 font-bold">-₹{Number(selectedPayslip.total_deductions).toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between"><span>Mode:</span><span className="font-medium text-slate-600">{selectedPayslip.payment_mode}</span></div>
                <div className="flex justify-between"><span>Date:</span><span className="font-mono text-slate-600">{selectedPayslip.disbursement_date ? new Date(selectedPayslip.disbursement_date).toLocaleDateString() : 'N/A'}</span></div>
                <div className="flex justify-between pt-1 border-t border-slate-100 font-extrabold text-emerald-800">
                  <span>Net Take-Home:</span>
                  <span className="font-mono">₹{Number(selectedPayslip.net_salary).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedPayslip(null)}
                className="px-4 py-2 rounded-xl bg-[#9B59B6] text-white text-xs font-bold hover:bg-[#8e44ad]"
              >
                Close Payslip
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ────────────────────────────────────────────────────────── */}
      {/* MODAL 5: PAYMENT RECEIPT DETAIL */}
      {/* ────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        title="Official Payment Receipt"
        subtitle={selectedReceipt ? `Receipt No: ${selectedReceipt.transaction_reference || selectedReceipt.payment_id}` : ''}
        maxWidth="md"
      >
        {selectedReceipt && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Central College Treasury Receipt</span>
              <p className="text-2xl font-extrabold text-purple-900 font-mono">
                ₹{parseFloat(selectedReceipt.amount).toLocaleString('en-IN')}
              </p>
              <span className="inline-block px-3 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                {selectedReceipt.status || 'Verified Successful'}
              </span>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
              <div className="p-2.5 flex justify-between bg-white"><span className="text-slate-500">Student Name:</span><span className="font-bold text-slate-800">{selectedReceipt.student_name}</span></div>
              <div className="p-2.5 flex justify-between bg-white"><span className="text-slate-500">Roll Number:</span><span className="font-mono font-bold text-slate-800">{selectedReceipt.roll_no}</span></div>
              <div className="p-2.5 flex justify-between bg-white"><span className="text-slate-500">Fee Category:</span><span className="font-medium text-slate-700">{selectedReceipt.fee_type || 'Tuition Fee'}</span></div>
              <div className="p-2.5 flex justify-between bg-white"><span className="text-slate-500">Payment Mode:</span><span className="font-semibold text-slate-700">{selectedReceipt.payment_mode}</span></div>
              <div className="p-2.5 flex justify-between bg-white"><span className="text-slate-500">Transaction Date:</span><span className="font-mono text-slate-600">{selectedReceipt.payment_date ? new Date(selectedReceipt.payment_date).toLocaleDateString() : 'N/A'}</span></div>
              <div className="p-2.5 flex justify-between bg-white"><span className="text-slate-500">Reference Ref:</span><span className="font-mono text-purple-900 font-bold">{selectedReceipt.transaction_reference || `TXN-${selectedReceipt.payment_id}`}</span></div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 rounded-xl bg-[#9B59B6] text-white text-xs font-bold hover:bg-[#8e44ad]"
              >
                Close Receipt
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FinanceFeesPage;
