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
        - Outer container remains static without any pulsing/animation.
        - Animated glowing effects are localized strictly to the inner pill elements.
      */}
      <header className="absolute top-0 inset-x-0 z-40 h-20 w-full flex items-center justify-between md:justify-center px-4 md:px-0 pointer-events-none transition-all duration-300 ease-in-out">
        {/* Left: Mobile Expand / Menu Trigger (Mobile only) */}
        <div className="flex items-center md:hidden pointer-events-auto">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="w-11 h-11 flex items-center justify-center bg-[#0b0c0e]/90 backdrop-blur-md border border-amber-500/30 ring-1 ring-amber-400/20 hover:ring-amber-400/50 rounded-2xl text-amber-200/80 hover:text-amber-300 hover:bg-[#141518] hover:border-amber-400/50 transition-all shadow-[0_0_15px_rgba(212,175,55,0.12)] cursor-pointer active:scale-95"
            title="Expand Navigation Menu"
            aria-label="Expand Navigation Menu"
          >
            <Menu size={20} className="shrink-0" />
          </button>
        </div>

        {/* 
          Floating Capsule Cluster:
          - Pure static, solid obsidian-glass base with delicate gold border (No outer animation)
        */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 bg-[#0b0c0e]/95 backdrop-blur-md border border-amber-500/25 rounded-3xl shadow-[0_15px_35px_rgba(0,0,0,0.85),0_0_20px_rgba(0,0,0,0.5)] pointer-events-auto">
          
          {/* 1. Present / Absent Attendance Toggle (Animated Gold Border Halo) */}
          {!isSuperAdminOrAdmin && (
            <button
              type="button"
              disabled={togglingDuty}
              onClick={handleToggleDuty}
              className={`h-11 flex items-center justify-center rounded-2xl text-xs font-bold transition-all duration-300 border cursor-pointer active:scale-95 tracking-wide ring-1 animate-[pulse_3s_ease-in-out_infinite] ${
                isOnDuty
                  ? 'bg-amber-500/15 text-amber-300 border-amber-400/60 ring-amber-400/40 hover:bg-amber-500/25 shadow-[0_0_14px_rgba(245,158,11,0.25)] hover:shadow-[0_0_20px_rgba(245,158,11,0.4)]'
                  : 'bg-[#141518] text-neutral-400 border-amber-500/25 ring-amber-500/15 hover:border-amber-400/50 hover:ring-amber-400/30 hover:text-neutral-200 shadow-[0_0_10px_rgba(212,175,55,0.1)]'
              } w-11 md:w-auto md:px-4 md:gap-2`}
              title={isOnDuty ? 'Status: Present (Click to set Absent)' : 'Status: Absent (Click to set Present)'}
            >
              {isOnDuty ? (
                <UserCheck size={18} className="text-amber-400 shrink-0 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
              ) : (
                <UserX size={18} className="text-neutral-500 shrink-0" />
              )}
              <span className="hidden md:inline">
                {isOnDuty ? 'Present' : 'Absent'}
              </span>
            </button>
          )}

          {/* 2. Daily Commits / Planner (Animated Gold Border Halo) */}
          {!isSuperAdminOrAdmin && (
            <button
              type="button"
              disabled={!isOnDuty}
              onClick={onOpenPlanner}
              className={`h-11 flex items-center justify-center rounded-2xl text-xs font-semibold border transition-all duration-300 tracking-wide ring-1 ${
                isOnDuty
                  ? 'bg-[#141518] border-amber-500/30 ring-amber-500/20 hover:border-amber-400/60 hover:ring-amber-400/40 text-neutral-200 hover:text-amber-200 shadow-[0_0_12px_rgba(212,175,55,0.15)] hover:shadow-[0_0_18px_rgba(212,175,55,0.3)] animate-[pulse_3s_ease-in-out_infinite] cursor-pointer active:scale-95'
                  : 'bg-neutral-900/40 border-white/5 ring-transparent text-neutral-600 cursor-not-allowed'
              } w-11 md:w-auto md:px-4 md:gap-2`}
              title={isOnDuty ? 'Daily Plan & Commits' : 'Must be present to view commits'}
            >
              <Calendar size={18} className={isOnDuty ? 'text-amber-400 shrink-0 drop-shadow-[0_0_5px_rgba(245,158,11,0.4)]' : 'text-neutral-600 shrink-0'} />
              <span className="hidden md:inline">Daily Plan</span>
            </button>
          )}

          {/* 3. Create Task (Uniform style, Animated Gold Border Halo) */}
          <button
            type="button"
            onClick={onOpenCreateTask}
            className="h-11 w-11 md:w-auto md:px-4 md:gap-2 flex items-center justify-center bg-[#141518] border border-amber-500/30 ring-1 ring-amber-500/20 hover:border-amber-400/60 hover:ring-amber-400/40 shadow-[0_0_12px_rgba(212,175,55,0.15)] hover:shadow-[0_0_18px_rgba(212,175,55,0.3)] text-neutral-200 hover:text-amber-200 rounded-2xl text-xs font-semibold tracking-wide transition-all duration-300 cursor-pointer active:scale-95 animate-[pulse_3s_ease-in-out_infinite]"
            title="Create New Task"
          >
            <Plus size={18} className="shrink-0 text-amber-400 drop-shadow-[0_0_5px_rgba(245,158,11,0.4)] stroke-[2.2]" />
            <span className="hidden md:inline">Create Task</span>
          </button>

          {/* 4. Notifications Bell with Badge (Animated Gold Border Halo) */}
          <button
            type="button"
            onClick={() => setIsNotificationOpen(true)}
            className="relative h-11 w-11 md:w-auto md:px-4 md:gap-2 flex items-center justify-center bg-[#141518] border border-amber-500/30 ring-1 ring-amber-500/20 hover:border-amber-400/60 hover:ring-amber-400/40 shadow-[0_0_12px_rgba(212,175,55,0.15)] hover:shadow-[0_0_18px_rgba(212,175,55,0.3)] rounded-2xl text-neutral-300 hover:text-amber-200 transition-all duration-300 cursor-pointer active:scale-95 animate-[pulse_3s_ease-in-out_infinite]"
            title="Notifications"
          >
            <Bell size={18} className="shrink-0 text-amber-400/90 drop-shadow-[0_0_5px_rgba(245,158,11,0.3)]" />
            <span className="hidden md:inline text-xs font-semibold">Alerts</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-black text-[10px] font-bold flex items-center justify-center ring-2 ring-[#0b0c0e] shadow-[0_0_8px_rgba(245,158,11,0.8)] animate-pulse">
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