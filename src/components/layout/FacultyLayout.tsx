import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Award, 
  CalendarOff, 
  Receipt, 
  LogOut, 
  Menu, 
  X, 
  Bell, 
  Briefcase,
  Eye,
  Users
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { StudentPreviewModal } from '../common/StudentPreviewModal';

export const FacultyLayout: React.FC = () => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showStudentPreview, setShowStudentPreview] = useState(false);

  // Strict route protection: If not logged in as faculty, block access
  if (!user || role !== 'FACULTY') {
    return <Navigate to="/login" replace />;
  }

  const navItems = [
    { to: "/faculty/dashboard", label: "Faculty Dashboard", icon: LayoutDashboard },
    { to: "/faculty/students", label: "My Students Roster", icon: Users },
    { to: "/faculty/attendance", label: "Attendance Management", icon: CheckSquare },
    { to: "/faculty/grading", label: "Examination & Grading", icon: Award },
    { to: "/faculty/leave", label: "Leave Application", icon: CalendarOff },
    { to: "/faculty/payroll", label: "Payroll & Payslips", icon: Receipt },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EBF0F9] to-[#F4F7FC] flex flex-col font-sans">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-[#2C3E50]/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Floating Capsule Sidebar */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-64 lg:m-4 lg:h-[calc(100vh-2rem)] bg-white text-[#2C3E50] flex flex-col transition-transform duration-300 ease-in-out
        rounded-none lg:rounded-[24px] shadow-[0px_10px_30px_rgba(112,144,176,0.14)] border border-white/80
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#4D8DFF] to-[#5687F6] text-white flex items-center justify-center font-bold shadow-[0px_4px_12px_rgba(77,141,255,0.35)]">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-sm font-extrabold tracking-tight text-[#2C3E50] block font-sans">
                CAMPUS ERP
              </span>
              <span className="text-[10px] font-bold tracking-wider text-[#4D8DFF] block uppercase">
                Faculty Portal
              </span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-full text-[#718096] hover:text-[#2C3E50] hover:bg-[#E8F0FE]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Faculty Profile Card */}
        <div className="px-3.5 py-3 m-3 bg-[#E8F0FE]/60 rounded-2xl border border-[#4D8DFF]/15 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-blue-100 flex items-center justify-center text-[#4D8DFF] font-bold text-sm">
            {user.name.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-bold text-[#2C3E50] truncate leading-tight">{user.name}</p>
            <p className="text-[10px] font-mono text-[#4D8DFF] truncate font-semibold mt-0.5">{user.codeOrRoll}</p>
            <p className="text-[9px] text-[#718096] truncate">{user.programOrDesignation} • {user.department}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-1 pt-1 flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider uppercase text-[#718096]">
              Teaching Tools
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#2ECC71]" title="Faculty Session Active" />
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => {
                  if (window.innerWidth < 1024) setSidebarOpen(false);
                }}
                className={({ isActive }) => `
                  flex items-center gap-3 px-4 py-2.5 rounded-full text-xs font-semibold transition-all duration-200
                  ${isActive 
                    ? 'bg-[#4D8DFF] text-white font-bold shadow-[0px_6px_18px_rgba(77,141,255,0.35)]' 
                    : 'text-[#718096] hover:bg-[#E8F0FE] hover:text-[#2C3E50]'}
                `}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer info & Logout */}
        <div className="p-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#718096]">
          <span className="font-medium text-[11px] pl-1">Faculty Workspace</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-[#FF6B4A] hover:bg-[#FF6B4A]/10 font-bold transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-72 flex flex-col flex-1 min-h-screen">
        {/* Floating Top Header Bar */}
        <header className="sticky top-0 lg:top-4 z-30 mx-0 lg:mr-4 lg:rounded-[20px] bg-white/95 backdrop-blur-md border border-white/80 px-4 sm:px-6 h-16 flex items-center justify-between shadow-[0px_10px_30px_rgba(112,144,176,0.10)] transition-all">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-full text-[#2C3E50] hover:bg-[#E8F0FE] transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#2C3E50] hidden sm:inline">
                College ERP Academic Management
              </span>
              <span className="text-xs text-slate-300 hidden sm:inline">•</span>
              <span className="text-xs font-semibold text-[#4D8DFF] bg-[#E8F0FE] px-2.5 py-0.5 rounded-full">
                Faculty Workspace
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Student View Demonstration Preview Button */}
            <button
              onClick={() => setShowStudentPreview(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold transition-all shadow-sm"
              title="Demonstrate student dashboard without exposing student passwords"
            >
              <Eye className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Student View Preview</span>
            </button>

            {/* Quick Duty Status */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#2ECC71] border border-emerald-100 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#2ECC71] animate-pulse" />
              <span>Duty Session Active</span>
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2.5 rounded-full text-[#718096] hover:text-[#2C3E50] hover:bg-[#E8F0FE] transition-colors relative"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#FF6B4A] rounded-full ring-2 ring-white" />
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-[0px_14px_36px_rgba(112,144,176,0.20)] border border-slate-100 p-4 z-50">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                    <span className="text-xs font-bold text-[#2C3E50]">Faculty Notices</span>
                    <span className="text-[10px] font-bold text-[#FF6B4A] bg-[#FF6B4A]/10 px-2 py-0.5 rounded-full">1 Pending</span>
                  </div>
                  <div className="divide-y divide-slate-100 text-xs py-1">
                    <div className="py-2.5">
                      <p className="font-bold text-[#2C3E50]">Mid-Term Evaluation Duty</p>
                      <p className="text-[11px] text-[#718096] mt-0.5">Submit internal assessment marks for CS302 before Oct 25.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Pill */}
            <div className="flex items-center gap-2 pl-3 border-l border-slate-100">
              <div className="w-8 h-8 rounded-full bg-[#E8F0FE] text-[#4D8DFF] font-bold flex items-center justify-center text-xs shadow-sm">
                {user.name.charAt(0)}
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <span className="text-xs font-bold text-[#2C3E50] block">{user.name}</span>
                <span className="text-[10px] text-[#718096] block font-mono">{user.codeOrRoll}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-6 lg:pr-6 max-w-7xl w-full">
          <Outlet />
        </main>
      </div>

      {/* Faculty Demonstration Student Preview Modal */}
      <StudentPreviewModal
        isOpen={showStudentPreview}
        onClose={() => setShowStudentPreview(false)}
        defaultStudentId={1}
      />
    </div>
  );
};

export default FacultyLayout;
