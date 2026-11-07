// frontend/src/components/common/Sidebar.jsx

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
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  X,
} from 'lucide-react';

export default function Sidebar({
  currentUser,
  activeTab,
  setActiveTab,
  onLogout,
  pendingTasksCount = 0,
  isOpen = false,
  onClose,
  isMinimized = false,
  onToggleMinimize,
}) {
  if (!currentUser) return null;

  const role = currentUser?.role || 'EMPLOYEE';
  const isPrivileged = ['SUPERVISOR', 'ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD', 'BUSINESS_ADMIN'].includes(role);
  const canManageMatrix = ['SUPER_ADMIN', 'ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD', 'SUPERVISOR'].includes(role);

  const navItems = [
    { id: 'landing', label: 'Workspace Cockpit', icon: LayoutDashboard, visible: true },
    { id: 'tasks', label: 'Task Backlog', icon: CheckSquare, visible: true, badge: pendingTasksCount > 0 ? pendingTasksCount : null },
    { id: 'matrix', label: 'Business & Matrix', icon: Building2, visible: canManageMatrix },
    { id: 'users', label: 'User Management', icon: UserCog, visible: isPrivileged },
    { id: 'reviews', label: 'Reason Forms Hub', icon: MessageSquare, visible: isPrivileged },
    { id: 'tree', label: 'Organization Tree', icon: Network, visible: isPrivileged },
    { id: 'profile', label: 'Personal Details', icon: User, visible: true },
    { id: 'audit', label: 'Audit Trail', icon: History, visible: true },
  ];

  const handleSelectTab = (tabKey) => {
    setActiveTab(tabKey);
    if (typeof window !== 'undefined' && window.innerWidth < 768 && onClose) {
      onClose();
    }
  };

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
    return getCapitalizedDisplayName().split(' ').slice(0, 2).join(' ');
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Shell: Highlighted original Amber/Gold border with subtle ambient halo */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50 h-full
          bg-[#0b0c0e] text-neutral-400
          flex flex-col shrink-0
          border border-amber-400/60
          shadow-[0_0_20px_rgba(245,158,11,0.18),0_20px_50px_rgba(0,0,0,0.9)]
          rounded-3xl md:rounded-[2rem] overflow-hidden
          transition-all duration-300 ease-in-out
          ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
          ${isMinimized ? 'md:w-20' : 'md:w-64'}
          w-72
        `}
      >
        {/* Top Header */}
        <div
          className={`h-16 flex items-center shrink-0 border-b border-amber-500/25 ${
            isMinimized ? 'md:justify-center md:px-0 px-5 justify-between' : 'justify-between px-5'
          }`}
        >
          {/* Brand Logo & Name */}
          <div className={`flex items-center gap-3 overflow-hidden ${isMinimized ? 'md:hidden' : 'flex'}`}>
            <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-black flex items-center justify-center font-bold text-xs shadow-[0_0_12px_rgba(212,175,55,0.35)] shrink-0">
              TP
            </div>
            <span className="text-base font-bold tracking-tight text-white truncate">
              Team<span className="text-amber-400">Pulse</span>
            </span>
          </div>

          {/* Desktop Toggle Button */}
          <button
            type="button"
            onClick={onToggleMinimize}
            className={`hidden md:flex p-2 rounded-2xl text-neutral-400 hover:text-white hover:bg-amber-500/10 border border-transparent hover:border-amber-400/30 transition cursor-pointer ${
              isMinimized ? 'mx-auto' : ''
            }`}
            title={isMinimized ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isMinimized ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>

          {/* Mobile Drawer Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="md:hidden p-2 text-neutral-400 hover:text-white rounded-2xl hover:bg-amber-500/10 transition cursor-pointer"
            title="Close Drawer"
          >
            <X size={20} />
          </button>
        </div>

        {/* User Identity Chip */}
        <div className={`p-4 border-b border-amber-500/20 bg-gradient-to-b from-[#141518] to-[#101114] flex items-center gap-3 shrink-0 ${isMinimized ? 'md:hidden' : 'flex'}`}>
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#1c1917] via-[#161412] to-[#0a0a0a] text-amber-300 border border-amber-400/40 flex items-center justify-center font-bold text-xs uppercase shrink-0 shadow-[0_2px_10px_rgba(212,175,55,0.15)] ring-1 ring-amber-400/20">
            {(currentUser.username || 'U').substring(0, 2)}
          </div>
          <div className="overflow-hidden min-w-0">
            <h4 className="text-xs font-semibold text-neutral-200 tracking-wide truncate">{getShortName()}</h4>
            <p className="text-[10px] text-amber-400 font-mono uppercase tracking-wider truncate">
              {role.replace('_', ' ')}
            </p>
          </div>
        </div>

        {/* Module Navigation List */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1.5 text-xs font-medium [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {navItems
            .filter((item) => item.visible)
            .map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectTab(item.id)}
                  title={isMinimized ? item.label : undefined}
                  className={`w-full flex items-center rounded-2xl transition-all duration-200 cursor-pointer ${
                    isMinimized
                      ? 'md:justify-center md:h-11 md:w-11 md:mx-auto px-3 py-2.5 justify-between'
                      : 'justify-between px-3.5 py-2.5'
                  } ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold shadow-[0_0_18px_rgba(212,175,55,0.28)] border border-amber-400/60'
                      : 'text-neutral-400 hover:text-white hover:bg-[#141518] border border-transparent hover:border-amber-500/25'
                  }`}
                >
                  <div className={`flex items-center ${isMinimized ? 'md:justify-center gap-3' : 'gap-3'}`}>
                    <Icon size={18} className={isActive ? 'text-black shrink-0' : 'text-amber-400/80 shrink-0'} />
                    <span className={`truncate ${isActive ? 'text-black font-bold' : 'text-neutral-400'} ${isMinimized ? 'md:hidden' : 'inline'}`}>
                      {item.label}
                    </span>
                  </div>

                  {item.badge && (
                    <span
                      className={`font-bold rounded-full px-1.5 py-0.2 text-[10px] shrink-0 ${
                        isActive
                          ? 'bg-black text-amber-300 border border-amber-400/50'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      } ${isMinimized ? 'md:hidden' : 'inline-block'}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
        </nav>

        {/* Bottom Sign Out Control */}
        <div className="p-3 md:p-4 border-t border-amber-500/20 shrink-0 bg-gradient-to-t from-[#141518] to-transparent">
          <button
            type="button"
            onClick={onLogout}
            title={isMinimized ? 'Sign Out' : undefined}
            className={`w-full flex items-center justify-center rounded-2xl border border-amber-500/25 bg-neutral-900/60 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-500/30 text-neutral-400 hover:text-white text-xs py-2.5 transition duration-150 cursor-pointer font-semibold ${
              isMinimized ? 'md:w-11 md:h-11 md:p-0 md:mx-auto gap-0' : 'gap-2 px-3'
            }`}
          >
            <LogOut size={16} className="shrink-0 text-amber-400" />
            <span className={isMinimized ? 'md:hidden' : 'inline'}>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}