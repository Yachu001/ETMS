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
  User,
  Layers
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
        return 'bg-purple-950/60 text-purple-300 border-purple-500/40 shadow-[0_0_8px_rgba(168,85,247,0.15)]';
      case 'BUSINESS_ADMIN':
        return 'bg-blue-950/60 text-blue-300 border-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.15)]';
      case 'DEPT_HEAD':
        return 'bg-teal-950/60 text-teal-300 border-teal-500/40 shadow-[0_0_8px_rgba(20,184,166,0.15)]';
      case 'SUPERVISOR':
        return 'bg-amber-950/60 text-amber-300 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]';
      default:
        return 'bg-neutral-800/80 text-neutral-300 border-neutral-700/60';
    }
  };

  if (loading) {
    return (
      <div className="bg-[#141518] rounded-2xl border border-amber-500/20 p-12 text-center text-xs text-amber-400/70 font-mono italic animate-pulse shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
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
    <div className="space-y-6 font-sans text-neutral-200">
      
      {/* ===================== 1. 4-CARD TEAM KPI BANNER ===================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        
        {/* Card 1: Present / Active Team Members */}
        <div className="bg-[#141518] p-4 sm:p-5 rounded-2xl border border-amber-500/20 shadow-[0_10px_25px_rgba(0,0,0,0.5)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider font-mono text-neutral-400">
              Present / Active
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
              <UserCheck size={16} className="text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
              <span className="text-emerald-400">{presentCount}</span>
              <span className="text-neutral-500 text-lg font-normal"> / {totalTeam}</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-neutral-400 mt-1">On-duty team members today</p>
          </div>
        </div>

        {/* Card 2: Idle Staff Alert */}
        <div className={`p-4 sm:p-5 rounded-2xl border shadow-[0_10px_25px_rgba(0,0,0,0.5)] transition flex flex-col justify-between ${
          idleCount > 0 
            ? 'bg-amber-950/25 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.12)]' 
            : 'bg-[#141518] border-amber-500/20'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider font-mono ${
              idleCount > 0 ? 'text-amber-300' : 'text-neutral-400'
            }`}>
              Idle Members
            </span>
            <div className={`p-1.5 rounded-lg border ${
              idleCount > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-neutral-800 border-neutral-700'
            }`}>
              <AlertTriangle size={16} className={idleCount > 0 ? 'text-amber-400 animate-pulse' : 'text-neutral-500'} />
            </div>
          </div>
          <div>
            <div className={`text-2xl sm:text-3xl font-extrabold font-mono ${
              idleCount > 0 ? 'text-amber-400' : 'text-white'
            }`}>
              {idleCount}
            </div>
            <p className={`text-[10px] sm:text-[11px] mt-1 ${idleCount > 0 ? 'text-amber-300/80' : 'text-neutral-400'}`}>
              Present with 0 active commits
            </p>
          </div>
        </div>

        {/* Card 3: Daily Commits / All Active Tasks */}
        <div className="bg-[#141518] p-4 sm:p-5 rounded-2xl border border-amber-500/20 shadow-[0_10px_25px_rgba(0,0,0,0.5)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider font-mono text-neutral-400">
              Daily Commits / Tasks
            </span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
              <CalendarClock size={16} className="text-amber-400" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
              <span className="text-amber-400">{committedCount}</span>
              <span className="text-neutral-500 text-lg font-normal"> / {totalActiveTasksCount}</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-neutral-400 mt-1">Active daily commits vs total backlog</p>
          </div>
        </div>

        {/* Card 4: Overdue Tasks Count */}
        <div className={`p-4 sm:p-5 rounded-2xl border shadow-[0_10px_25px_rgba(0,0,0,0.5)] transition flex flex-col justify-between ${
          overdueCount > 0 
            ? 'bg-rose-950/25 border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.12)]' 
            : 'bg-[#141518] border-amber-500/20'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider font-mono ${
              overdueCount > 0 ? 'text-rose-300' : 'text-neutral-400'
            }`}>
              Overdue Tasks
            </span>
            <div className={`p-1.5 rounded-lg border ${
              overdueCount > 0 ? 'bg-rose-500/10 border-rose-500/30' : 'bg-neutral-800 border-neutral-700'
            }`}>
              <Clock size={16} className={overdueCount > 0 ? 'text-rose-400 animate-pulse' : 'text-neutral-500'} />
            </div>
          </div>
          <div>
            <div className={`text-2xl sm:text-3xl font-extrabold font-mono ${
              overdueCount > 0 ? 'text-rose-400' : 'text-white'
            }`}>
              {overdueCount}
            </div>
            <p className={`text-[10px] sm:text-[11px] mt-1 ${overdueCount > 0 ? 'text-rose-300/80' : 'text-neutral-400'}`}>
              Deadline breached tasks
            </p>
          </div>
        </div>

      </div>

      {/* ===================== 2. TABLE 1: IDLE USERS LIST ===================== */}
      <div className="bg-[#141518] rounded-2xl border border-amber-500/25 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_20px_rgba(245,158,11,0.06)] overflow-hidden">
        
        {/* Table Title Bar */}
        <div className="p-4 sm:p-5 border-b border-amber-500/15 flex flex-wrap items-center justify-between gap-3 bg-[#0b0c0e]/80">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              Idle Team Members (No Commits Today)
            </h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Subordinates in your scope who are on-duty but have 0 active tasks committed today
            </p>
          </div>
          <span className="text-[10px] font-bold font-mono uppercase text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]">
            {idleUsers.length} Members Idle
          </span>
        </div>

        {/* Desktop Table View (hidden on mobile) */}
        <div className="hidden md:block overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#0b0c0e] border-b border-amber-500/20 text-amber-400 font-semibold text-[11px] uppercase tracking-wider font-mono">
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Status & Indicators</th>
                <th className="py-3.5 px-4 text-center">Commits / Active Tasks</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-500/10">
              {idleUsers.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-10 text-center text-neutral-400 italic text-xs font-mono">
                    All team users have daily active commits.
                  </td>
                </tr>
              ) : (
                idleUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-[#1a1c22]/80 transition bg-amber-950/5">
                    {/* User Name Left + Role Badge Right */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-bold text-white text-xs">{user.name}</div>
                          <div className="text-[10px] text-amber-400/70 font-mono mt-0.5">
                            @{user.username} {user.designation ? `• ${user.designation}` : ''}
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border font-mono uppercase shrink-0 ${getRoleBadgeStyle(user.role)}`}>
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
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${user.is_active ? 'bg-emerald-500' : 'bg-neutral-600'}`}></span>
                          </span>
                          <span className="text-[9px] text-neutral-400 font-mono mt-1">
                            {user.is_active ? 'active' : 'inactive'}
                          </span>
                        </div>

                        {/* Dot 2: Present */}
                        <div className="flex flex-col items-center">
                          <span className="relative flex h-2.5 w-2.5">
                            {user.is_present && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            )}
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${user.is_present ? 'bg-emerald-500' : 'bg-neutral-600'}`}></span>
                          </span>
                          <span className="text-[9px] text-neutral-400 font-mono mt-1">
                            {user.is_present ? 'present' : 'off'}
                          </span>
                        </div>

                        {/* Dot 3: Commits (Red Pulsing Alert for 0 Commits) */}
                        <div className="flex flex-col items-center">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                          </span>
                          <span className="text-[9px] text-rose-400 font-bold font-mono mt-1">0 commits</span>
                        </div>
                      </div>
                    </td>

                    {/* Today Commits / Active Tasks Ratio */}
                    <td className="py-3.5 px-4 text-center font-mono">
                      <span className="text-amber-400 font-bold text-xs">{user.daily_commits_count || 0}</span>
                      <span className="text-neutral-500"> / {user.active_tasks_count || 0}</span>
                    </td>

                    {/* Actions: Assign Task & View */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenAssignTask(user.id)}
                          className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black px-3 py-1.5 rounded-xl transition shadow-[0_0_12px_rgba(245,158,11,0.25)] cursor-pointer"
                        >
                          <PlusCircle size={13} /> Assign Task
                        </button>
                        {onSelectUser && (
                          <button
                            type="button"
                            onClick={() => onSelectUser(user.id)}
                            className="inline-flex items-center gap-1 text-[11px] text-neutral-300 hover:text-white bg-[#0b0c0e] hover:bg-neutral-800 border border-amber-500/20 hover:border-amber-500/40 px-2.5 py-1.5 rounded-xl font-medium transition cursor-pointer"
                          >
                            <Eye size={12} className="text-amber-400" /> View
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
        <div className="block md:hidden divide-y divide-amber-500/10">
          {idleUsers.length === 0 ? (
            <div className="py-10 text-center text-neutral-400 italic text-xs font-mono">
              All team users have daily active commits.
            </div>
          ) : (
            idleUsers.map((user) => (
              <div key={user.id} className="p-4 space-y-3 bg-[#0b0c0e]/40">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-white text-sm">{user.name}</h4>
                    <div className="text-[10px] text-amber-400/70 font-mono mt-0.5">
                      @{user.username} {user.designation ? `• ${user.designation}` : ''}
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border font-mono uppercase shrink-0 ${getRoleBadgeStyle(user.role)}`}>
                    {user.role || 'EMPLOYEE'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-[10px] text-neutral-400 font-mono">
                      <span className={`inline-block h-2 w-2 rounded-full ${user.is_active ? 'bg-emerald-400' : 'bg-neutral-600'}`}></span>
                      Active
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-neutral-400 font-mono">
                      <span className={`inline-block h-2 w-2 rounded-full ${user.is_present ? 'bg-emerald-400' : 'bg-neutral-600'}`}></span>
                      Present
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-rose-400 font-mono font-bold">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                      0 Commits
                    </div>
                  </div>
                  <div className="text-right font-mono text-[11px]">
                    <span className="text-amber-400 font-bold">{user.daily_commits_count || 0}</span>
                    <span className="text-neutral-500"> / {user.active_tasks_count || 0} active</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenAssignTask(user.id)}
                    className="flex-1 py-2 bg-gradient-to-r from-amber-400 to-amber-500 text-black font-bold text-xs rounded-xl text-center shadow-[0_0_12px_rgba(245,158,11,0.25)] flex items-center justify-center gap-1.5"
                  >
                    <PlusCircle size={14} /> Assign Task
                  </button>
                  {onSelectUser && (
                    <button
                      type="button"
                      onClick={() => onSelectUser(user.id)}
                      className="px-4 py-2 bg-[#0b0c0e] border border-amber-500/25 text-neutral-200 hover:text-white rounded-xl text-xs font-semibold"
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
      <div className="bg-[#141518] rounded-2xl border border-amber-500/25 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_20px_rgba(245,158,11,0.06)] overflow-hidden">
        
        {/* Table Title Bar */}
        <div className="p-4 sm:p-5 border-b border-amber-500/15 flex flex-wrap items-center justify-between gap-3 bg-[#0b0c0e]/80">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Clock size={16} className="text-rose-400" />
              Team Overdue Tasks
            </h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Overdue tasks across all subordinates within your operational scope
            </p>
          </div>
          <span className="text-[10px] font-bold font-mono uppercase text-rose-300 bg-rose-950/60 px-2.5 py-1 rounded-full border border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.15)] animate-pulse">
            {overdueTasks.length} Overdue
          </span>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#0b0c0e] border-b border-amber-500/20 text-amber-400 font-semibold text-[11px] uppercase tracking-wider font-mono">
                <th className="py-3.5 px-4">Task Name</th>
                <th className="py-3.5 px-4">Assignee</th>
                <th className="py-3.5 px-4">Due Date</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-500/10">
              {overdueTasks.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-10 text-center text-neutral-400 italic text-xs font-mono">
                    There are no overdue tasks in your team.
                  </td>
                </tr>
              ) : (
                overdueTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-[#1a1c22]/80 transition">
                    {/* Task Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white text-xs">{task.title}</div>
                      <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                        Priority: <span className="font-bold text-rose-400 uppercase">{task.priority}</span> • {task.progress_percentage}% completed
                      </div>
                    </td>

                    {/* Assignee Left + Role Badge Right */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-semibold text-neutral-200">{task.assigned_to_name}</div>
                          <div className="text-[10px] text-amber-400/70 font-mono">{task.assigned_to_designation || 'Staff'}</div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border font-mono uppercase shrink-0 ${getRoleBadgeStyle(task.assigned_to_role)}`}>
                          {task.assigned_to_role || 'EMPLOYEE'}
                        </span>
                      </div>
                    </td>

                    {/* Due Date */}
                    <td className="py-3.5 px-4 font-mono text-rose-400 font-bold">
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
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-xl text-[11px] font-bold transition shadow-[0_0_12px_rgba(245,158,11,0.25)] cursor-pointer"
                        >
                          <FileText size={13} /> Review Reason
                        </button>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-bold font-mono uppercase bg-neutral-900 text-neutral-500 border border-neutral-800 px-2.5 py-1 rounded-lg">
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
        <div className="block md:hidden divide-y divide-amber-500/10">
          {overdueTasks.length === 0 ? (
            <div className="py-10 text-center text-neutral-400 italic text-xs font-mono">
              There are no overdue tasks in your team.
            </div>
          ) : (
            overdueTasks.map((task) => (
              <div key={task.id} className="p-4 space-y-3 bg-[#0b0c0e]/30">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-white text-sm">{task.title}</h4>
                    <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                      Priority: <span className="font-bold text-rose-400 uppercase">{task.priority}</span> • {task.progress_percentage}% completed
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-950/50 border border-rose-500/30 px-2 py-0.5 rounded shrink-0">
                    {task.due_date || 'No Date'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="flex items-center gap-1.5">
                    <User size={13} className="text-amber-400" />
                    <span className="text-neutral-200 font-medium">{task.assigned_to_name}</span>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border font-mono uppercase ${getRoleBadgeStyle(task.assigned_to_role)}`}>
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
                      className="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                    >
                      <FileText size={14} /> Review Delay Reason
                    </button>
                  ) : (
                    <div className="w-full py-1.5 bg-neutral-900 border border-neutral-800 text-neutral-500 text-[11px] font-mono font-semibold text-center rounded-xl">
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