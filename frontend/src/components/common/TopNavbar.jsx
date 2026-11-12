// frontend/src/components/common/TopNavbar.jsx

import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import NotificationDrawer from '../NotificationDrawer';
import { 
  Menu, 
  Calendar, 
  Plus, 
  Bell,
  UserCheck, 
  UserX
} from 'lucide-react';

export default function TopNavbar({
  currentUser,
  isOnDuty,
  onOpenMobileMenu,
  onOpenPlanner,
  onOpenCreateTask,
  onAttendanceChanged,
  isSidebarMinimized = false,
}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [togglingDuty, setTogglingDuty] = useState(false);

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
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  if (!currentUser) return null;

  const handleToggleDuty = async () => {
    setTogglingDuty(true);
    try {
      const res = await api.post('/auth/attendance/today/', {
        is_present: !isOnDuty
      });
      if (onAttendanceChanged) {
        onAttendanceChanged(res.data.is_present);
      }
    } catch (err) {
      console.error('Failed to update attendance status:', err);
    } finally {
      setTogglingDuty(false);
    }
  };

  const role = currentUser?.role || 'EMPLOYEE';
  const isSuperAdminOrAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(role);

  return (
    <>
      {/* 
        Top Navigation Bar:
        - Absolute top-0 inset-x-0 locks to the main section boundary.
        - Automatically glides horizontally when the sidebar expands or collapses.
        - pointer-events-none lets clicks pass through to content underneath, with pointer-events-auto on buttons.
        - z-40 ensures it floats cleanly above scrolling content on the light-grey canvas.
      */}
      <header className="absolute top-0 inset-x-0 z-40 h-20 w-full flex items-center justify-between md:justify-center px-3 sm:px-4 md:px-0 pointer-events-none transition-all duration-300 ease-in-out">
        {/* Left: Mobile Expand / Menu Trigger (Mobile only) */}
        <div className="flex items-center md:hidden pointer-events-auto">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="w-11 h-11 flex items-center justify-center bg-white/95 backdrop-blur-md border border-slate-200/90 ring-1 ring-blue-500/10 hover:ring-blue-500/30 rounded-2xl text-slate-700 hover:text-blue-600 hover:bg-blue-50/50 hover:border-blue-300 transition-all shadow-[0_8px_20px_rgba(15,23,42,0.06)] cursor-pointer active:scale-95"
            title="Expand Navigation Menu"
            aria-label="Expand Navigation Menu"
          >
            <Menu size={20} className="shrink-0" />
          </button>
        </div>

        {/* 
          Floating Capsule Cluster:
          - Crisp pure white frosted glass base with refined hairline border
          - Elevated soft slate shadow to pop cleanly off the light-grey background
        */}
        <div className="flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-1.5 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-3xl shadow-[0_12px_30px_rgba(15,23,42,0.07),0_2px_8px_rgba(37,99,235,0.04)] pointer-events-auto">
          
          {/* 1. Present / Absent Attendance Toggle */}
          {!isSuperAdminOrAdmin && (
            <button
              type="button"
              disabled={togglingDuty}
              onClick={handleToggleDuty}
              className={`h-11 flex items-center justify-center rounded-2xl text-xs font-bold transition-all duration-300 border cursor-pointer active:scale-95 tracking-wide ring-1 ${
                isOnDuty
                  ? 'bg-blue-50 text-blue-700 border-blue-300/90 ring-blue-500/20 hover:bg-blue-100/80 shadow-[0_2px_10px_rgba(37,99,235,0.12)]'
                  : 'bg-slate-50/90 text-slate-500 border-slate-200/90 ring-transparent hover:border-blue-300 hover:bg-white hover:text-slate-800 shadow-2xs'
              } w-11 md:w-auto md:px-4 md:gap-2`}
              title={isOnDuty ? 'Status: Present (Click to set Absent)' : 'Status: Absent (Click to set Present)'}
            >
              {isOnDuty ? (
                <UserCheck size={18} className="text-blue-600 shrink-0" />
              ) : (
                <UserX size={18} className="text-slate-400 shrink-0" />
              )}
              <span className="hidden md:inline">
                {isOnDuty ? 'Present' : 'Absent'}
              </span>
            </button>
          )}

          {/* 2. Daily Commits / Planner */}
          {!isSuperAdminOrAdmin && (
            <button
              type="button"
              disabled={!isOnDuty}
              onClick={onOpenPlanner}
              className={`h-11 flex items-center justify-center rounded-2xl text-xs font-semibold border transition-all duration-300 tracking-wide ring-1 ${
                isOnDuty
                  ? 'bg-white border-slate-200/90 ring-blue-500/5 hover:border-blue-300 hover:ring-blue-500/20 hover:bg-blue-50/40 text-slate-700 hover:text-blue-700 shadow-2xs cursor-pointer active:scale-95'
                  : 'bg-slate-100/80 border-slate-200/60 ring-transparent text-slate-400 cursor-not-allowed'
              } w-11 md:w-auto md:px-4 md:gap-2`}
              title={isOnDuty ? 'Daily Plan & Commits' : 'Must be present to view commits'}
            >
              <Calendar size={18} className={isOnDuty ? 'text-blue-600 shrink-0' : 'text-slate-400 shrink-0'} />
              <span className="hidden md:inline">Daily Plan</span>
            </button>
          )}

          {/* 3. Create Task (Primary Royal Blue Executive Pill) */}
          <button
            type="button"
            onClick={onOpenCreateTask}
            className="h-11 w-11 md:w-auto md:px-4 md:gap-2 flex items-center justify-center bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 border border-blue-500/30 text-white rounded-2xl text-xs font-semibold tracking-wide shadow-[0_4px_14px_rgba(37,99,235,0.28)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.38)] transition-all duration-300 cursor-pointer active:scale-95"
            title="Create New Task"
          >
            <Plus size={18} className="shrink-0 text-white stroke-[2.4]" />
            <span className="hidden md:inline">Create Task</span>
          </button>

          {/* 4. Notifications Bell with Badge */}
          <button
            type="button"
            onClick={() => setIsNotificationOpen(true)}
            className="relative h-11 w-11 md:w-auto md:px-4 md:gap-2 flex items-center justify-center bg-white border border-slate-200/90 ring-1 ring-blue-500/5 hover:border-blue-300 hover:ring-blue-500/20 hover:bg-blue-50/40 rounded-2xl text-slate-700 hover:text-blue-700 shadow-2xs transition-all duration-300 cursor-pointer active:scale-95"
            title="Notifications"
          >
            <Bell size={18} className="shrink-0 text-blue-600" />
            <span className="hidden md:inline text-xs font-semibold">Alerts</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white shadow-[0_2px_6px_rgba(37,99,235,0.45)] animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <NotificationDrawer
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        onRefreshCount={fetchUnreadCount}
      />
    </>
  );
}