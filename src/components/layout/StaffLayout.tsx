import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Briefcase, Users, Award, LogOut,
  Menu, X, Bell, BookOpen, BookMarked, RotateCcw, AlertCircle,
  DollarSign, FileText, CreditCard, BarChart3, ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const STAFF_ROLES = ['TNP_HEAD', 'FINANCE', 'LIBRARIAN'];

function getStaffConfig(role: string) {
  switch (role) {
    case 'TNP_HEAD':
      return {
        label: 'TNP Cell Head',
        portalName: 'TNP Portal',
        accent: '#2ECC71',
        accentLight: '#EAFAF1',
        accentBorder: 'rgba(46,204,113,0.2)',
        accentShadow: 'rgba(46,204,113,0.35)',
        accentText: '#1A8742',
        navSection: 'Placement Tools',
        navItems: [
          { to: '/staff/dashboard', label: 'TNP Dashboard', icon: LayoutDashboard },
          { to: '/staff/companies', label: 'Company Management', icon: Building2 },
          { to: '/staff/drives', label: 'Job Drives', icon: Briefcase },
          { to: '/staff/applications', label: 'Applications & Shortlist', icon: Users },
          { to: '/staff/placements', label: 'Placement Records', icon: Award },
        ]
      };
    case 'FINANCE':
      return {
        label: 'Finance Officer',
        portalName: 'Finance Portal',
        accent: '#9B59B6',
        accentLight: '#F5EEF8',
        accentBorder: 'rgba(155,89,182,0.2)',
        accentShadow: 'rgba(155,89,182,0.35)',
        accentText: '#6C3483',
        navSection: 'Finance Tools',
        navItems: [
          { to: '/staff/dashboard', label: 'Finance Dashboard', icon: LayoutDashboard },
          { to: '/staff/fees', label: 'Student Fees', icon: DollarSign },
          { to: '/staff/payments', label: 'Payment Receipts', icon: CreditCard },
          { to: '/staff/payroll', label: 'Faculty Payroll', icon: Users },
          { to: '/staff/library-fines', label: 'Library Collections', icon: BookOpen },
          { to: '/staff/fee-structures', label: 'Fee Structures', icon: FileText },
          { to: '/staff/reports', label: 'Financial Reports', icon: BarChart3 },
        ]
      };
    case 'LIBRARIAN':
    default:
      return {
        label: 'Librarian',
        portalName: 'Library Portal',
        accent: '#E67E22',
        accentLight: '#FEF9EF',
        accentBorder: 'rgba(230,126,34,0.2)',
        accentShadow: 'rgba(230,126,34,0.35)',
        accentText: '#A04000',
        navSection: 'Library Tools',
        navItems: [
          { to: '/staff/dashboard', label: 'Library Dashboard', icon: LayoutDashboard },
          { to: '/staff/books', label: 'Book Inventory', icon: BookOpen },
          { to: '/staff/issues', label: 'Issue / Return', icon: BookMarked },
          { to: '/staff/overdue', label: 'Overdue Books', icon: AlertCircle },
          { to: '/staff/returns', label: 'Return History', icon: RotateCcw },
        ]
      };
  }
}

export const StaffLayout: React.FC = () => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user || !role || !STAFF_ROLES.includes(role)) {
    return <Navigate to="/login" replace />;
  }

  const cfg = getStaffConfig(role);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col font-sans">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-64 lg:m-4 lg:h-[calc(100vh-2rem)]
        bg-white flex flex-col transition-transform duration-300 ease-in-out
        rounded-none lg:rounded-[24px] shadow-[0px_10px_30px_rgba(0,0,0,0.08)]
        border border-slate-100
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-md text-white"
              style={{ background: `linear-gradient(135deg, ${cfg.accent}, ${cfg.accent}CC)`, boxShadow: `0 4px 12px ${cfg.accentShadow}` }}
            >
              {role === 'TNP_HEAD' ? <Briefcase className="w-5 h-5" /> :
               role === 'FINANCE' ? <DollarSign className="w-5 h-5" /> :
               <BookOpen className="w-5 h-5" />}
            </div>
            <div>
              <span className="text-sm font-extrabold tracking-tight text-slate-800 block">CAMPUS ERP</span>
              <span className="text-[10px] font-bold tracking-wider uppercase block" style={{ color: cfg.accent }}>{cfg.portalName}</span>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-full text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Staff Profile Card */}
        <div className="px-3.5 py-3 m-3 rounded-2xl border flex items-center gap-3"
          style={{ background: cfg.accentLight, borderColor: cfg.accentBorder }}>
          <div className="w-10 h-10 rounded-full bg-white shadow-sm border flex items-center justify-center font-bold text-sm"
            style={{ color: cfg.accent, borderColor: cfg.accentBorder }}>
            {(user.name || 'S').charAt(0)}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-bold text-slate-800 truncate leading-tight">{user.name}</p>
            <p className="text-[10px] font-mono truncate font-semibold mt-0.5" style={{ color: cfg.accent }}>{user.email}</p>
            <p className="text-[9px] text-slate-500 truncate">{cfg.label}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          <div className="px-3 pb-1 pt-1 flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">{cfg.navSection}</span>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.accent }} />
          </div>
          {cfg.navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/staff/dashboard'}
                onClick={() => { if (window.innerWidth < 1024) setSidebarOpen(false); }}
                className={({ isActive }) => `
                  flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold
                  transition-all duration-150 group
                  ${isActive
                    ? 'text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                  }
                `}
                style={({ isActive }) => isActive ? {
                  background: `linear-gradient(135deg, ${cfg.accent}, ${cfg.accent}DD)`,
                  boxShadow: `0 2px 8px ${cfg.accentShadow}`
                } : {}}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
              </NavLink>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-72 flex flex-col flex-1 min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 lg:top-4 z-30 mx-0 lg:mr-4 lg:rounded-[20px] bg-white/95 backdrop-blur-md border border-slate-100 px-4 sm:px-6 h-16 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-full text-slate-700 hover:bg-slate-100 transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 hidden sm:inline">College ERP</span>
              <span className="text-xs text-slate-300 hidden sm:inline">•</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ color: cfg.accentText, background: cfg.accentLight }}>
                {cfg.portalName}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border"
              style={{ color: cfg.accentText, background: cfg.accentLight, borderColor: cfg.accentBorder }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: cfg.accent }} />
              <span>Active Session</span>
            </div>
            <div className="relative">
              <button className="p-2.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors relative">
                <Bell className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 pl-3 border-l border-slate-100">
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm text-white"
                style={{ background: cfg.accent }}>
                {(user.name || 'S').charAt(0)}
              </div>
              <div className="hidden sm:block">
                <span className="text-xs font-bold text-slate-700 block">{user.name}</span>
                <span className="text-[10px] text-slate-400 block">{cfg.label}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default StaffLayout;
