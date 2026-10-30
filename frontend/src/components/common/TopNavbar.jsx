import  { useState, useEffect } from 'react';
import api from '../../api/axios';
import AttendanceToggle from '../AttendanceToggle'
import NotificationDrawer from '../NotificationDrawer';
import {
  Menu,
  Calendar,
  PlusCircle,
  Bell,
} from 'lucide-react';

export default function TopNavbar({
  currentUser,
  isOnDuty,
  onOpenMobileMenu,
  onOpenPlanner,
  onOpenCreateTask,
  onAttendanceChanged,
}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  // Poll unread notification count
  const fetchUnreadCount = async () => {
    try {
      const res = await api.get('/notifications/unread-count/');
      setUnreadCount(res.data.unread_count || 0);
    } catch (err) {
      // Graceful fallback
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 30000); // 30s polling
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  if (!currentUser) return null;

  // Format display name: Capitalized, maximum 2 words
  const getShortName = () => {
    const raw = (currentUser.full_name && currentUser.full_name.trim().length > 0)
      ? currentUser.full_name
      : (currentUser.username || 'User');
    return raw
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .slice(0, 2)
      .join(' ');
  };

  const roleBadgeStyles = {
    SUPER_ADMIN: 'bg-rose-50 text-rose-700 border-rose-200',
    DEPT_HEAD: 'bg-purple-50 text-purple-700 border-purple-200',
    BUSINESS_ADMIN: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    ADMIN: 'bg-amber-50 text-amber-700 border-amber-200',
    SUPERVISOR: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    EMPLOYEE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  return (
    <>
      <header className="h-16 md:h-20 bg-white border-b border-slate-200 px-4 md:px-8 flex justify-between items-center sticky top-0 z-30 shadow-2xs">
        {/* Left: Mobile Hamburger & Identity Info */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="md:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <h1 className="text-sm md:text-base font-bold text-slate-900 tracking-tight truncate">
              {getShortName()}
            </h1>
            <span
              className={`text-[9px] md:text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold shrink-0 ${
                roleBadgeStyles[currentUser.role] || 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {currentUser.role}
            </span>
          </div>
        </div>

        {/* Right: Actions & Attendance Gating */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {/* Attendance / Duty Status Toggle */}
          <AttendanceToggle onStatusChange={onAttendanceChanged} />

          {/* Daily Work Planner Button */}
          <button
            type="button"
            onClick={onOpenPlanner}
            disabled={!isOnDuty}
            title={!isOnDuty ? "You must mark On-Duty / Present to access your daily planner." : "Open Daily Work Planner"}
            className={`flex items-center gap-1.5 text-xs px-2.5 md:px-3 py-1.5 md:py-2 rounded-lg font-medium transition shadow-2xs ${
              isOnDuty
                ? 'bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 cursor-pointer'
                : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
            }`}
          >
            <Calendar size={14} className={isOnDuty ? "text-blue-600" : "text-slate-400"} />
            <span className="hidden sm:inline">Daily Plan</span>
          </button>

          {/* Create Task Button */}
          <button
            type="button"
            onClick={onOpenCreateTask}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 md:px-3.5 py-1.5 md:py-2 rounded-lg font-medium transition shadow-xs cursor-pointer"
          >
            <PlusCircle size={15} />
            <span className="hidden sm:inline">+ Create Task</span>
            <span className="sm:hidden font-semibold">New</span>
          </button>

          {/* Notification Bell with Badge */}
          <button
            type="button"
            onClick={() => setIsNotificationOpen(true)}
            className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute 1 top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-600 rounded-full ring-2 ring-white animate-pulse" />
            )}
          </button>
        </div>
      </header>

      {/* Slide-out Notification Drawer */}
      <NotificationDrawer
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        onRefreshCount={fetchUnreadCount}
      />
    </>
  );
}