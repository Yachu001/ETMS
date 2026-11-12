// frontend/src/components/SupervisorTeamView.jsx

import React, { useState, useEffect } from 'react';
import { 
  UserCheck, 
  AlertTriangle, 
  Clock, 
  PlusCircle, 
  FileText, 
  CalendarClock,
  Eye,
  User
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
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'ADMIN':
        return 'bg-blue-100/80 text-blue-800 border-blue-300';
      case 'BUSINESS_ADMIN':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'DEPT_HEAD':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'SUPERVISOR':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center text-xs text-blue-600 font-mono font-semibold animate-pulse shadow-[0_8px_25px_rgba(15,23,42,0.05)]">
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
    <div className="space-y-6 font-sans text-slate-800">
      
      {/* ===================== 1. 4-CARD TEAM KPI BANNER ===================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        
        {/* Card 1: Present / Active Team Members */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-blue-600">
              Present / Active
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-600 flex items-center justify-center">
              <UserCheck size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
              <span className="text-emerald-600">{presentCount}</span>
              <span className="text-slate-400 text-lg font-normal"> / {totalTeam}</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1">On-duty team members today</p>
          </div>
        </div>

        {/* Card 2: Idle Staff Alert */}
        <div className={`p-4 sm:p-5 rounded-3xl border shadow-[0_8px_25px_rgba(15,23,42,0.05)] transition flex flex-col justify-between ${
          idleCount > 0 
            ? 'bg-gradient-to-b from-amber-50/90 to-white border-amber-200 shadow-[0_10px_25px_rgba(245,158,11,0.08)]' 
            : 'bg-white border-slate-200/90'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${
              idleCount > 0 ? 'text-amber-700' : 'text-blue-600'
            }`}>
              Idle Members
            </span>
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
              idleCount > 0 ? 'bg-amber-100/80 border-amber-200 text-amber-600' : 'bg-blue-50 border-blue-100 text-blue-600'
            }`}>
              <AlertTriangle size={16} className={idleCount > 0 ? 'animate-pulse' : ''} />
            </div>
          </div>
          <div>
            <div className={`text-2xl sm:text-3xl font-extrabold font-mono ${
              idleCount > 0 ? 'text-amber-700' : 'text-slate-900'
            }`}>
              {idleCount}
            </div>
            <p className={`text-[10px] sm:text-[11px] mt-1 ${idleCount > 0 ? 'text-amber-700/80' : 'text-slate-500'}`}>
              Present with 0 active commits
            </p>
          </div>
        </div>

        {/* Card 3: Daily Commits / All Active Tasks */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-blue-600">
              Daily Commits / Tasks
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
              <CalendarClock size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
              <span className="text-blue-700">{committedCount}</span>
              <span className="text-slate-400 text-lg font-normal"> / {totalActiveTasksCount}</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1">Active daily commits vs total backlog</p>
          </div>
        </div>

        {/* Card 4: Overdue Tasks Count */}
        <div className={`p-4 sm:p-5 rounded-3xl border shadow-[0_8px_25px_rgba(15,23,42,0.05)] transition flex flex-col justify-between ${
          overdueCount > 0 
            ? 'bg-gradient-to-b from-rose-50/90 to-white border-rose-200 shadow-[0_10px_25px_rgba(244,63,94,0.08)]' 
            : 'bg-white border-slate-200/90'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${
              overdueCount > 0 ? 'text-rose-600' : 'text-blue-600'
            }`}>
              Overdue Tasks
            </span>
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
              overdueCount > 0 ? 'bg-rose-100/80 border-rose-200 text-rose-600' : 'bg-blue-50 border-blue-100 text-blue-600'
            }`}>
              <Clock size={16} className={overdueCount > 0 ? 'animate-pulse' : ''} />
            </div>
          </div>
          <div>
            <div className={`text-2xl sm:text-3xl font-extrabold font-mono ${
              overdueCount > 0 ? 'text-rose-600' : 'text-slate-900'
            }`}>
              {overdueCount}
            </div>
            <p className={`text-[10px] sm:text-[11px] mt-1 ${overdueCount > 0 ? 'text-rose-600/80' : 'text-slate-500'}`}>
              Deadline breached tasks
            </p>
          </div>
        </div>

      </div>

      {/* ===================== 2. TABLE 1: IDLE USERS LIST ===================== */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] overflow-hidden">
        
        {/* Table Title Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 bg-slate-50/90">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              Idle Team Members (No Commits Today)
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Subordinates in your scope who are on-duty but have 0 active tasks committed today
            </p>
          </div>
          <span className="text-[10px] font-bold font-mono uppercase text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
            {idleUsers.length} Members Idle
          </span>
        </div>

        {/* Desktop Table View (hidden on mobile) */}
        <div className="hidden md:block overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full text-left text-xs border-collapse text-slate-700">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-200/80 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Status & Indicators</th>
                <th className="py-3.5 px-4 text-center">Commits / Active Tasks</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {idleUsers.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-10 text-center text-slate-400 italic text-xs">
                    All team users have daily active commits.
                  </td>
                </tr>
              ) : (
                idleUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-blue-50/40 transition bg-amber-50/20">
                    {/* User Name Left + Role Badge Right */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{user.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            @{user.username} {user.designation ? `• ${user.designation}` : ''}
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border font-mono uppercase shrink-0 ${getRoleBadgeStyle(user.role)}`}>
                          {user.role || 'EMPLOYEE'}
                        </span>
                      </div>
                    </td>

                    {/* 3-Color Dot Sequence with Captions */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-start gap-4">
                        {/* Dot 1: Active */}
                        <div className="flex flex-col items-center">
                          <span className="relative flex h-2.5 w-2.5">
                            {user.is_active && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            )}
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${user.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
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
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${user.is_present ? 'bg-blue-600' : 'bg-slate-300'}`}></span>
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
                    <td className="py-3.5 px-4 text-center font-mono">
                      <span className="text-amber-700 font-bold text-xs">{user.daily_commits_count || 0}</span>
                      <span className="text-slate-400"> / {user.active_tasks_count || 0}</span>
                    </td>

                    {/* Actions: Assign Task & View */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenAssignTask(user.id)}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white px-3.5 py-1.5 rounded-xl transition shadow-[0_3px_10px_rgba(37,99,235,0.25)] cursor-pointer"
                        >
                          <PlusCircle size={13} /> Assign Task
                        </button>
                        {onSelectUser && (
                          <button
                            type="button"
                            onClick={() => onSelectUser(user.id)}
                            className="inline-flex items-center gap-1 text-[11px] text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer"
                          >
                            <Eye size={12} className="text-blue-600" /> View
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

        {/* Mobile Card Stack View (< md screens) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {idleUsers.length === 0 ? (
            <div className="py-10 text-center text-slate-400 italic text-xs">
              All team users have daily active commits.
            </div>
          ) : (
            idleUsers.map((user) => (
              <div key={user.id} className="p-4 space-y-3 bg-amber-50/15">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{user.name}</h4>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      @{user.username} {user.designation ? `• ${user.designation}` : ''}
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border font-mono uppercase shrink-0 ${getRoleBadgeStyle(user.role)}`}>
                    {user.role || 'EMPLOYEE'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                      <span className={`inline-block h-2 w-2 rounded-full ${user.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                      Active
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                      <span className={`inline-block h-2 w-2 rounded-full ${user.is_present ? 'bg-blue-600' : 'bg-slate-300'}`}></span>
                      Present
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-rose-600 font-bold">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                      0 Commits
                    </div>
                  </div>
                  <div className="text-right font-mono text-[11px]">
                    <span className="text-amber-700 font-bold">{user.daily_commits_count || 0}</span>
                    <span className="text-slate-400"> / {user.active_tasks_count || 0} active</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenAssignTask(user.id)}
                    className="flex-1 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-xs rounded-xl text-center shadow-[0_3px_10px_rgba(37,99,235,0.25)] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <PlusCircle size={14} /> Assign Task
                  </button>
                  {onSelectUser && (
                    <button
                      type="button"
                      onClick={() => onSelectUser(user.id)}
                      className="px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      View
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

      </div>

      {/* ===================== 3. TABLE 2: TEAM OVERDUE TASKS ===================== */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] overflow-hidden">
        
        {/* Table Title Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 bg-slate-50/90">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock size={16} className="text-rose-600" />
              Team Overdue Tasks
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Overdue tasks across all subordinates within your operational scope
            </p>
          </div>
          <span className="text-[10px] font-bold font-mono uppercase text-rose-700 bg-rose-50 px-3 py-1 rounded-full border border-rose-200 animate-pulse">
            {overdueTasks.length} Overdue
          </span>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full text-left text-xs border-collapse text-slate-700">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-200/80 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                <th className="py-3.5 px-4">Task Name</th>
                <th className="py-3.5 px-4">Assignee</th>
                <th className="py-3.5 px-4">Due Date</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {overdueTasks.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-10 text-center text-slate-400 italic text-xs">
                    There are no overdue tasks in your team.
                  </td>
                </tr>
              ) : (
                overdueTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-blue-50/40 transition">
                    {/* Task Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-xs">{task.title}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Priority: <span className="font-bold text-rose-600 uppercase">{task.priority}</span> &bull; {task.progress_percentage}% completed
                      </div>
                    </td>

                    {/* Assignee Left + Role Badge Right */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-semibold text-slate-900">{task.assigned_to_name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{task.assigned_to_designation || 'Staff'}</div>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border font-mono uppercase shrink-0 ${getRoleBadgeStyle(task.assigned_to_role)}`}>
                          {task.assigned_to_role || 'EMPLOYEE'}
                        </span>
                      </div>
                    </td>

                    {/* Due Date */}
                    <td className="py-3.5 px-4 font-mono text-rose-600 font-bold">
                      {task.due_date || '—'}
                    </td>

                    {/* Action Column */}
                    <td className="py-3.5 px-4 text-right">
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
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-xl text-[11px] font-semibold transition shadow-[0_3px_10px_rgba(37,99,235,0.25)] cursor-pointer"
                        >
                          <FileText size={13} /> Review Reason
                        </button>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-bold font-mono uppercase bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 rounded-lg">
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

        {/* Mobile Card Stack View (< md screens) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {overdueTasks.length === 0 ? (
            <div className="py-10 text-center text-slate-400 italic text-xs">
              There are no overdue tasks in your team.
            </div>
          ) : (
            overdueTasks.map((task) => (
              <div key={task.id} className="p-4 space-y-3 hover:bg-blue-50/30 transition">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{task.title}</h4>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Priority: <span className="font-bold text-rose-600 uppercase">{task.priority}</span> &bull; {task.progress_percentage}% completed
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md shrink-0">
                    {task.due_date || 'No Date'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="flex items-center gap-1.5">
                    <User size={13} className="text-blue-600" />
                    <span className="text-slate-800 font-semibold">{task.assigned_to_name}</span>
                  </div>
                  <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border font-mono uppercase ${getRoleBadgeStyle(task.assigned_to_role)}`}>
                    {task.assigned_to_role || 'EMPLOYEE'}
                  </span>
                </div>

                <div className="pt-2">
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
                      className="w-full py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-[0_3px_10px_rgba(37,99,235,0.25)] cursor-pointer"
                    >
                      <FileText size={14} /> Review Delay Reason
                    </button>
                  ) : (
                    <div className="w-full py-1.5 bg-slate-100 border border-slate-200 text-slate-500 text-[11px] font-mono font-semibold text-center rounded-xl">
                      No Reason Submitted Yet
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
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