import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import TaskTable from './TaskTable';
import { User, ArrowLeft, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

export default function UserDetailView({ userId, onBack, currentUser, onOpenTaskAction }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/auth/user-detail/${userId}/`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load user detail cockpit:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) fetchUserData();
  }, [userId]);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-xs text-slate-500 shadow-xs">
        <div className="flex items-center justify-center gap-2">
          <RefreshCw size={14} className="animate-spin text-blue-600" />
          Loading user cockpit workspace...
        </div>
      </div>
    );
  }

  // If user data fails to load, display fallback with a back button
  if (!data) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs space-y-3 shadow-xs">
        <p className="text-rose-600 font-medium">
          Unable to load cockpit details for User ID #{userId}.
        </p>
        <button
          onClick={onBack}
          className="border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-xs hover:bg-slate-50 font-medium"
        >
          &larr; Back to Employee Roster
        </button>
      </div>
    );
  }

  const { user, tasks } = data;

  return (
    <div className="space-y-5">
      {/* Back button */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition font-medium"
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </button>
      </div>

      {/* User Header Profile Card */}
      <div
        className={`p-6 rounded-2xl border transition shadow-xs ${
          user.is_idle
            ? 'bg-amber-50/70 border-amber-300'
            : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl border ${
                user.is_idle
                  ? 'bg-amber-100 text-amber-700 border-amber-300'
                  : 'bg-blue-50 text-blue-600 border-blue-100'
              }`}
            >
              {user.username.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">{user.username}</h2>
                {user.is_idle ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-full shadow-xs">
                    <AlertTriangle size={12} /> IDLE — 0 Active Tasks
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    <CheckCircle2 size={12} /> Working ({user.active_tasks_count} in-flight)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {user.designation || 'Staff'} &bull; {user.department} &bull;{' '}
                <span className="font-semibold text-slate-700">{user.role}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs">
            <div className="text-right">
              <span className="text-slate-400 uppercase text-[10px] font-semibold">Total Assigned</span>
              <div className="text-base font-bold text-slate-800">{user.total_tasks_count} Tasks</div>
            </div>
            <div className="text-right">
              <span className="text-slate-400 uppercase text-[10px] font-semibold">Today Active</span>
              <div className={`text-base font-bold ${user.is_idle ? 'text-amber-600' : 'text-blue-600'}`}>
                {user.active_tasks_count} Active
              </div>
            </div>
          </div>
        </div>

        {/* Warning notification banner if user is idle */}
        {user.is_idle && (
          <div className="mt-4 p-3 bg-amber-100/80 border border-amber-300 rounded-xl text-xs text-amber-950 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <strong>Employee Capacity Alert:</strong> This staff member has{' '}
              <strong>0 active tasks in progress</strong>.
              {user.pending_requests_count > 0 && (
                <span className="ml-1 text-amber-800">
                  (They have {user.pending_requests_count} pending request(s) not yet accepted).
                </span>
              )}
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider bg-amber-200 px-2.5 py-1 rounded text-amber-900 shrink-0">
              Available for Assignment
            </span>
          </div>
        )}
      </div>

      {/* Task List under this user */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-900">Task Backlog & Assignment History</h3>
          <button
            onClick={fetchUserData}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-50 transition"
          >
            <RefreshCw size={12} /> Refresh Tasks
          </button>
        </div>
        <TaskTable
          tasks={tasks}
          currentUser={currentUser}
          onOpenActionModal={onOpenTaskAction}
        />
      </div>
    </div>
  );
}