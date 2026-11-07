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
        - Uses 'absolute top-0 inset-x-0' to lock 1:1 to the main section's actual boundaries.
        - Perfect mathematical center across all screen widths and sidebar states.
        - 'pointer-events-none' allows underlying content to remain clickable, with 'pointer-events-auto' on buttons.
        - z-40 ensures it stays pinned above scrolling main content.
      */}
      <header className="absolute top-0 inset-x-0 z-40 h-20 w-full flex items-center justify-between md:justify-center px-4 md:px-0 pointer-events-none transition-all duration-300 ease-in-out">
        {/* Left: Mobile Expand / Menu Trigger (Mobile only) */}
        <div className="flex items-center md:hidden pointer-events-auto">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="w-11 h-11 flex items-center justify-center bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl text-slate-700 hover:text-slate-950 hover:bg-white transition-all shadow-xs cursor-pointer active:scale-95"
            title="Expand Navigation Menu"
            aria-label="Expand Navigation Menu"
          >
            <Menu size={20} className="shrink-0" />
          </button>
        </div>

        {/* 
          Floating Capsule Cluster:
          - Perfectly centered to the main section width on desktop
          - Equal left and right outer padding (px-2.5 py-1.5 with gap-2.5)
        */}
        <div className="flex items-center gap-2.5 px-2.5 py-1.5 bg-white/85 backdrop-blur-md border border-slate-200/80 rounded-3xl shadow-xs pointer-events-auto">
          {/* 1. Present / Absent Attendance Toggle */}
          {!isSuperAdminOrAdmin && (
            <button
              type="button"
              disabled={togglingDuty}
              onClick={handleToggleDuty}
              className={`h-11 flex items-center justify-center rounded-2xl text-xs font-bold transition-all border shadow-2xs cursor-pointer active:scale-95 ${
                isOnDuty
                  ? 'bg-emerald-50/90 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-white/85 text-slate-600 border-slate-200/80 hover:bg-white'
              } w-11 md:w-auto md:px-4 md:gap-2`}
              title={isOnDuty ? 'Status: Present (Click to set Absent)' : 'Status: Absent (Click to set Present)'}
            >
              {isOnDuty ? (
                <UserCheck size={18} className="text-emerald-600 shrink-0" />
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
              className={`h-11 flex items-center justify-center rounded-2xl text-xs font-semibold border shadow-2xs transition-all ${
                isOnDuty
                  ? 'bg-white/85 border-slate-200/80 hover:bg-white text-slate-700 cursor-pointer active:scale-95'
                  : 'bg-white/40 border-slate-200/40 text-slate-300 cursor-not-allowed'
              } w-11 md:w-auto md:px-4 md:gap-2`}
              title={isOnDuty ? 'Daily Plan & Commits' : 'Must be present to view commits'}
            >
              <Calendar size={18} className={isOnDuty ? 'text-blue-600 shrink-0' : 'text-slate-300 shrink-0'} />
              <span className="hidden md:inline">Daily Plan</span>
            </button>
          )}

          {/* 3. Create Task */}
          <button
            type="button"
            onClick={onOpenCreateTask}
            className="w-11 h-11 md:w-auto md:px-4 md:gap-2 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-semibold shadow-md transition-all cursor-pointer active:scale-95"
            title="Create New Task"
          >
            <Plus size={19} className="shrink-0" />
            <span className="hidden md:inline">Create Task</span>
          </button>

          {/* 4. Notifications Bell with Badge */}
          <button
            type="button"
            onClick={() => setIsNotificationOpen(true)}
            className="relative w-11 h-11 md:w-auto md:px-4 md:gap-2 flex items-center justify-center bg-white/85 border border-slate-200/80 rounded-2xl text-slate-700 hover:bg-white transition-all shadow-2xs cursor-pointer active:scale-95"
            title="Notifications"
          >
            <Bell size={18} className="shrink-0 text-slate-600" />
            <span className="hidden md:inline text-xs font-semibold text-slate-700">Alerts</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white animate-pulse">
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