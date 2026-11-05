// frontend/src/components/SupervisorTeamView.jsx

import React, { useState, useEffect } from 'react';
import { 
  UserCheck, 
  AlertTriangle, 
  Clock, 
  PlusCircle, 
  FileText, 
  CalendarClock
} from 'lucide-react';
import api from '../api/axios';
import CreateTaskModal from './CreateTaskModal';
import TaskReasonReviewModal from './TaskReasonReviewModal';

export default function SupervisorTeamView({ currentUser, onSelectUser }) {
  // State for Overview Metrics & Tables
  const [teamMetrics, setTeamMetrics] = useState(null);
  const [idleUsers, setIdleUsers] = useState([]);
  const [overdueTasks, setOverdueTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal Triggers
  const [assignModalUserId, setAssignModalUserId] = useState(null);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [reviewingSubmission, setReviewingSubmission] = useState(null);

  // Fetch all Team Dashboard data in parallel
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [metricsRes, idleRes, overdueRes] = await Promise.all([
        api.get('/tasks/dashboard/team-overview/'),
        api.get('/tasks/dashboard/idle-roster/'),
        api.get('/tasks/dashboard/team-overdue-tasks/')
      ]);
      setTeamMetrics(metricsRes.data);
      setIdleUsers(idleRes.data || []);
      setOverdueTasks(overdueRes.data || []);
    } catch (err) {
      console.error('Failed to load supervisor team data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleOpenAssignTask = (userId) => {
    setAssignModalUserId(userId);
    setIsCreateTaskOpen(true);
  };

  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'SUPER_ADMIN':
      case 'ADMIN':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'BUSINESS_ADMIN':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'DEPT_HEAD':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'SUPERVISOR':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-400">
        Loading supervisor team dashboard & metrics...
      </div>
    );
  }

  // Derived metrics
  const totalTeam = teamMetrics?.total_team || 0;
  const presentCount = teamMetrics?.present_count || 0;
  const committedCount = teamMetrics?.total_daily_commits ?? teamMetrics?.committed_count ?? 0;
  const totalActiveTasksCount = teamMetrics?.total_active_tasks ?? (teamMetrics?.members || []).reduce(
    (acc, m) => acc + (m.active_tasks_count || m.active_daily_tasks || 0), 0
  );
  const overdueCount = overdueTasks.length;
  const idleCount = idleUsers.length;

  return (
    <div className="space-y-6">
      {/* ===================== 1. 4-CARD TEAM KPI BANNER ===================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Present / Active Team Members */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Present / Active</span>
            <UserCheck size={18} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            <span className="text-emerald-600">{presentCount}</span>
            <span className="text-slate-400 text-lg font-normal"> / {totalTeam}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">On-duty team members today</p>
        </div>

        {/* Card 2: Idle Staff Alert */}
        <div className={`p-4 sm:p-5 rounded-2xl border shadow-2xs transition ${
          idleCount > 0 ? 'bg-amber-50/70 border-amber-200' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${
              idleCount > 0 ? 'text-amber-800' : 'text-slate-500'
            }`}>
              Idle Members
            </span>
            <AlertTriangle size={18} className={idleCount > 0 ? 'text-amber-600' : 'text-slate-400'} />
          </div>
          <div className={`text-2xl font-bold ${
            idleCount > 0 ? 'text-amber-700 font-mono' : 'text-slate-900'
          }`}>
            {idleCount}
          </div>
          <p className={`text-[11px] mt-1 ${idleCount > 0 ? 'text-amber-700/80' : 'text-slate-400'}`}>
            Present with 0 active commits
          </p>
        </div>

        {/* Card 3: Daily Commits / All Active Tasks */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Daily Commits / Active Tasks</span>
            <CalendarClock size={18} className="text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            <span className="text-blue-600">{committedCount}</span>
            <span className="text-slate-400 text-lg font-normal"> / {totalActiveTasksCount}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Active daily commits vs total active tasks</p>
        </div>

        {/* Card 4: Overdue Tasks Count */}
        <div className={`p-4 sm:p-5 rounded-2xl border shadow-2xs transition ${
          overdueCount > 0 ? 'bg-rose-50/60 border-rose-200' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${
              overdueCount > 0 ? 'text-rose-700' : 'text-slate-500'
            }`}>
              Overdue Tasks
            </span>
            <Clock size={18} className={overdueCount > 0 ? 'text-rose-600' : 'text-slate-400'} />
          </div>
          <div className={`text-2xl font-bold ${
            overdueCount > 0 ? 'text-rose-700 font-mono' : 'text-slate-900'
          }`}>
            {overdueCount}
          </div>
          <p className={`text-[11px] mt-1 ${overdueCount > 0 ? 'text-rose-600/80' : 'text-slate-400'}`}>
            Deadline breached tasks
          </p>
        </div>
      </div>

      {/* ===================== 2. TABLE 1: IDLE USERS LIST ===================== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
              Idle Team Members (No Commits Today)
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Subordinates under your scope who are on-duty but have 0 active tasks committed today
            </p>
          </div>
          <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-300">
            {idleUsers.length} Idle
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Status & Indicators</th>
                <th className="py-3 px-4 text-center">Commits / Active Tasks</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {idleUsers.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-slate-500 font-medium text-xs">
                    All team users have daily active commits
                  </td>
                </tr>
              ) : (
                idleUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/70 transition bg-amber-50/20">
                    {/* User Name Left + Role Badge Right */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-bold text-slate-900">{user.name}</div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            @{user.username} {user.designation ? `• ${user.designation}` : ''}
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${getRoleBadgeStyle(user.role)}`}>
                          {user.role || 'EMPLOYEE'}
                        </span>
                      </div>
                    </td>

                    {/* 3-Color Dot Sequence with Captions */}
                    <td className="py-3 px-4">
                      <div className="flex items-start gap-4">
                        {/* Dot 1: Active */}
                        <div className="flex flex-col items-center">
                          <span className="relative flex h-2.5 w-2.5">
                            {user.is_active && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            )}
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${user.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          </span>
                          <span className="text-[9px] text-slate-500 font-medium mt-1">
                            {user.is_active ? 'active' : 'inactive'}
                          </span>
                        </div>

                        {/* Dot 2: Present */}
                        <div className="flex flex-col items-center">
                          <span className="relative flex h-2.5 w-2.5">
                            {user.is_present && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            )}
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${user.is_present ? 'bg-blue-500' : 'bg-slate-400'}`}></span>
                          </span>
                          <span className="text-[9px] text-slate-500 font-medium mt-1">
                            {user.is_present ? 'present' : 'off'}
                          </span>
                        </div>

                        {/* Dot 3: Commits (Red Pulsing Alert for 0 Commits) */}
                        <div className="flex flex-col items-center">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                          </span>
                          <span className="text-[9px] text-rose-600 font-bold mt-1">0 commits</span>
                        </div>
                      </div>
                    </td>

                    {/* Today Commits / Active Tasks Ratio */}
                    <td className="py-3 px-4 text-center font-mono">
                      <span className="text-blue-700 font-semibold">{user.daily_commits_count || 0}</span>
                      <span className="text-slate-400"> / {user.active_tasks_count || 0}</span>
                    </td>

                    {/* Actions: Assign Task & Inspect */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenAssignTask(user.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-lg transition shadow-2xs cursor-pointer"
                        >
                          <PlusCircle size={13} /> Assign Task
                        </button>
                        {onSelectUser && (
                          <button
                            type="button"
                            onClick={() => onSelectUser(user.id)}
                            className="text-[11px] text-slate-600 hover:text-slate-900 border border-slate-200 px-2.5 py-1 rounded-lg font-medium hover:bg-slate-50 transition cursor-pointer"
                          >
                            View
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================== 3. TABLE 2: TEAM OVERDUE TASKS ===================== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock size={16} className="text-rose-600" />
              Team Overdue Tasks
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Overdue tasks across all subordinates within your operational scope
            </p>
          </div>
          <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
            {overdueTasks.length} Overdue
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Task Name</th>
                <th className="py-3 px-4">Assignee</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {overdueTasks.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-slate-500 font-medium text-xs">
                    There are no overdue tasks
                  </td>
                </tr>
              ) : (
                overdueTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50/70 transition">
                    {/* Task Name */}
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div>{task.title}</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        Priority: <span className="font-semibold text-rose-700">{task.priority}</span> • {task.progress_percentage}% completed
                      </div>
                    </td>

                    {/* Assignee Left + Role Badge Right */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-semibold text-slate-800">{task.assigned_to_name}</div>
                          <div className="text-[10px] text-slate-400">{task.assigned_to_designation}</div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${getRoleBadgeStyle(task.assigned_to_role)}`}>
                          {task.assigned_to_role || 'EMPLOYEE'}
                        </span>
                      </div>
                    </td>

                    {/* Due Date */}
                    <td className="py-3 px-4 font-mono text-rose-700 font-semibold">
                      {task.due_date || '—'}
                    </td>

                    {/* Action Column */}
                    <td className="py-3 px-4 text-right">
                      {task.overdue_reason_submitted ? (
                        <button
                          type="button"
                          onClick={() => setReviewingSubmission({
                            id: task.submission_id,
                            task_id: task.id,
                            task_title: task.title,
                            submitted_by_name: task.assigned_to_name,
                            task_current_due_date: task.due_date,
                            reason_category: task.reason_category,
                            expected_due_date: task.expected_due_date,
                            explanation: task.explanation,
                          })}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold transition shadow-2xs cursor-pointer"
                        >
                          <FileText size={12} /> Review Reason
                        </button>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 px-2 py-1 rounded-md">
                          No Reason Submitted
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================== MODALS ===================== */}
      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        onClose={() => {
          setIsCreateTaskOpen(false);
          setAssignModalUserId(null);
        }}
        onTaskCreated={() => fetchDashboardData()}
        currentUser={currentUser}
        defaultAssignedToUserId={assignModalUserId}
      />

      <TaskReasonReviewModal
        isOpen={Boolean(reviewingSubmission)}
        submission={reviewingSubmission}
        onClose={() => setReviewingSubmission(null)}
        onSuccess={() => fetchDashboardData()}
      />
    </div>
  );
}