import React from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  Network,
  User,
  LogOut,
  Building2,
  History,
  UserCog,
  X,
  MessageSquare,
} from 'lucide-react';

export default function Sidebar({
  currentUser,
  activeTab,
  setActiveTab,
  onLogout,
  pendingTasksCount = 0,
  isOpen = false,
  onClose,
}) {
  if (!currentUser) return null;

  const isPrivileged = ['SUPERVISOR', 'ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD', 'BUSINESS_ADMIN'].includes(currentUser.role);
  // Allowed SUPERVISOR to view and manage their assigned matrix branch
  const canManageMatrix = ['SUPER_ADMIN', 'ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD', 'SUPERVISOR'].includes(currentUser.role);

  const getCapitalizedDisplayName = () => {
    const raw = (currentUser.full_name && currentUser.full_name.trim().length > 0)
      ? currentUser.full_name
      : (currentUser.username || 'User');
    return raw
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  const getShortName = () => {
    const full = getCapitalizedDisplayName();
    return full.split(' ').slice(0, 2).join(' ');
  };

  const handleNavClick = (tabKey) => {
    setActiveTab(tabKey);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-base shadow-xs">
              T
            </div>
            <span className="text-lg font-bold tracking-tight text-white">TeamPulse</span>
          </div>
          {/* Close button for mobile drawer */}
          <button
            onClick={onClose}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* User Identity Snapshot */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-sm">
            {(currentUser.username || 'U').substring(0, 2).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <h4 className="text-xs font-semibold text-white truncate">{getShortName()}</h4>
            <p className="text-[11px] text-slate-400 truncate">{currentUser.designation || 'Staff Member'}</p>
          </div>
        </div>

        {/* Navigation Tab Links */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1 text-xs font-medium">
          <button
            onClick={() => handleNavClick('landing')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition cursor-pointer ${
              activeTab === 'landing'
                ? 'bg-blue-600 text-white font-semibold'
                : 'hover:bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <LayoutDashboard size={16} /> Overview Landing
          </button>

          <button
            onClick={() => handleNavClick('tasks')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition cursor-pointer ${
              activeTab === 'tasks'
                ? 'bg-blue-600 text-white font-semibold'
                : 'hover:bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <CheckSquare size={16} /> Tasks & Work Log
            </div>
            {pendingTasksCount > 0 && (
              <span className="bg-amber-500 text-slate-950 font-bold px-1.5 py-0.2 rounded-full text-[10px]">
                {pendingTasksCount}
              </span>
            )}
          </button>

          {/* User Management Console */}
          {isPrivileged && (
            <button
              onClick={() => handleNavClick('users')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <UserCog size={16} /> User Management
            </button>
          )}

          {/* Reporting Tree */}
          {isPrivileged && (
            <button
              onClick={() => handleNavClick('tree')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition cursor-pointer ${
                activeTab === 'tree'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Network size={16} /> Organization Tree
            </button>
          )}

          {/* Cross-Matrix Branch Directory */}
          {canManageMatrix && (
            <button
              onClick={() => handleNavClick('matrix')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition cursor-pointer ${
                activeTab === 'matrix'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Building2 size={16} /> Business & Matrix
            </button>
          )}

          {/* Reason Reviews Hub */}
          {isPrivileged && (
            <button
              type="button"
              onClick={() => handleNavClick('reviews')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition cursor-pointer ${
                activeTab === 'reviews'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare size={16} /> Reason Forms Hub
            </button>
          )}

          <button
            onClick={() => handleNavClick('profile')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-blue-600 text-white font-semibold'
                : 'hover:bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <User size={16} /> Personal Details
          </button>

          <button
            onClick={() => handleNavClick('audit')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-blue-600 text-white font-semibold'
                : 'hover:bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <History size={16} /> Audit Trail & History
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 shrink-0">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white text-xs py-2 rounded-lg transition cursor-pointer"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}