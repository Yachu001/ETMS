// frontend/src/components/TaskTable.jsx

import React, { useState } from 'react';
import api from '../api/axios';
import TaskDelayModal from './TaskDelayModal';
import TaskRejectModal from './TaskRejectModal';
import {
  AlertTriangle,
  Filter,
  ChevronDown,
  ChevronUp,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  User,
  RotateCcw
} from 'lucide-react';

export default function TaskTable({ 
  tasks = [], 
  onOpenActionModal, 
  currentUser, 
  onRefresh,
  viewMode = 'self' 
}) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [expandedTaskId, setExpandedTaskId] = useState(null);

  // Modal target states
  const [delayModalTask, setDelayModalTask] = useState(null);
  const [rejectModalTask, setRejectModalTask] = useState(null);

  // Base Employee is always locked to self-perspective; other roles obey viewMode
  const isSelfView = currentUser?.role === 'EMPLOYEE' || viewMode === 'self';

  const formatAssignedByName = (name) => {
    if (!name) return 'Self';
    const parts = name.trim().split(/\s+/);
    return parts.slice(0, 2).join(' ');
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return { date: '—', time: '' };
    const d = new Date(dateStr);
    return {
      date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const handleAcceptTask = async (taskId) => {
    try {
      await api.post(`/tasks/${taskId}/action/`, { action: 'ACCEPT' });
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to accept task.');
    }
  };

  // In self-view: strictly personal active tasks; terminal states (VERIFIED, REJECTED, CANCELLED) disappear
  const baseTasks = isSelfView 
    ? tasks.filter(t => 
        (t.assigned_to === currentUser?.id || !t.assigned_to) &&
        !['VERIFIED', 'REJECTED', 'CANCELLED'].includes(t.status)
      )
    : tasks;

  const filteredTasks = baseTasks.filter((t) => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
    return true;
  });

  // Black & Gold Theme Priority Tokens
  const priorityStyles = {
    LOW: 'bg-neutral-800/80 text-neutral-300 border-neutral-700/60',
    MEDIUM: 'bg-amber-950/40 text-amber-300 border-amber-500/30',
    HIGH: 'bg-amber-500/15 text-amber-400 border-amber-400/50 shadow-[0_0_10px_rgba(245,158,11,0.15)]',
    URGENT: 'bg-rose-950/50 text-rose-300 border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.2)]',
  };

  // Black & Gold Theme Status Tokens
  const statusStyles = {
    REQUEST_PENDING: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    ACCEPTED: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
    IN_PROGRESS: 'bg-amber-400/10 text-amber-200 border-amber-400/30',
    ON_HOLD: 'bg-neutral-800/80 text-neutral-400 border-neutral-700',
    AWAITING_VERIFICATION: 'bg-purple-900/30 text-purple-300 border-purple-500/30',
    VERIFIED: 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30',
    REJECTED: 'bg-rose-950/40 text-rose-400 border-rose-500/30',
    CANCELLED: 'bg-neutral-900 text-neutral-500 border-neutral-800',
  };

  return (
    <div className="space-y-4 font-sans text-neutral-200">
      {/* Filters Bar */}
      <div className="bg-[#141518] p-3 sm:p-4 rounded-2xl border border-amber-500/20 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
          <Filter size={15} className="text-amber-400" />
          <span className="tracking-wide uppercase text-[11px] font-mono">Filter Tasks</span>
          <span className="text-neutral-500 text-[10px]">({filteredTasks.length} loaded)</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-none bg-[#0b0c0e] border border-amber-500/25 rounded-xl px-3 py-2 text-neutral-200 font-medium outline-none focus:border-amber-400 transition cursor-pointer text-xs"
          >
            <option value="ALL">All Statuses</option>
            <option value="REQUEST_PENDING">Pending Acceptance</option>
            <option value="ACCEPTED">Accepted (Not Started)</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="AWAITING_VERIFICATION">Awaiting Verification</option>
            {!isSelfView && (
              <>
                <option value="VERIFIED">Verified / Done</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </>
            )}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="flex-1 sm:flex-none bg-[#0b0c0e] border border-amber-500/25 rounded-xl px-3 py-2 text-neutral-200 font-medium outline-none focus:border-amber-400 transition cursor-pointer text-xs"
          >
            <option value="ALL">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>

          {(statusFilter !== 'ALL' || priorityFilter !== 'ALL') && (
            <button
              onClick={() => {
                setStatusFilter('ALL');
                setPriorityFilter('ALL');
              }}
              className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 px-2.5 py-1.5 rounded-lg border border-amber-500/20 hover:border-amber-500/40 bg-amber-500/10 font-semibold transition cursor-pointer"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-[#141518] rounded-2xl border border-amber-500/25 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_20px_rgba(245,158,11,0.06)] overflow-hidden">
        
        {/* DESKTOP TABLE VIEW (md and up) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0b0c0e]/90 border-b border-amber-500/20 text-amber-400 font-semibold text-[11px] uppercase tracking-wider font-mono">
                <th className="py-3.5 px-4">Task Name</th>
                {isSelfView ? (
                  <th className="py-3.5 px-3">Assigned By</th>
                ) : (
                  <>
                    <th className="py-3.5 px-3">Assignee & Branch</th>
                    <th className="py-3.5 px-3">Assigned By</th>
                  </>
                )}
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3">Priority</th>
                <th className="py-3.5 px-3">Progress</th>
                <th className="py-3.5 px-3">Due Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-500/10">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={isSelfView ? 7 : 8} className="py-12 text-center text-neutral-400 italic">
                    No active tasks match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => {
                  const isAssignee = currentUser?.id === task.assigned_to;
                  const isAuthorityOnSubordinate =
                    !isAssignee &&
                    (['SUPERVISOR', 'DEPT_HEAD', 'BUSINESS_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(
                      currentUser?.role
                    ) ||
                      currentUser?.is_superuser ||
                      task.created_by === currentUser?.id);
                  
                  const isOverdue = Boolean(task.is_overdue) && !['VERIFIED', 'REJECTED', 'CANCELLED'].includes(task.status);
                  const isAwaitingVerification = task.status === 'AWAITING_VERIFICATION';
                  const isExpanded = expandedTaskId === task.id;
                  const createdDT = formatDateTime(task.created_at);

                  const assigneeMatrix = task.assigned_to_matrix_title || 
                    (task.assigned_to_business_code && task.assigned_to_department_name
                      ? `${task.assigned_to_business_code} - ${task.assigned_to_department_name}`
                      : null);

                  return (
                    <React.Fragment key={task.id}>
                      <tr className="hover:bg-[#1a1c22]/80 transition">
                        {/* Task Name & Commitment Pulse */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                              className="text-amber-400/80 hover:text-amber-300 transition cursor-pointer p-1 rounded-lg hover:bg-white/5 border border-transparent hover:border-amber-500/20"
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>

                            {/* Green Pulse Indicator if committed today */}
                            {task.is_committed_today && (
                              <span 
                                title="Active in Today's Commitment Plan" 
                                className="relative flex h-2.5 w-2.5 shrink-0"
                              >
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                              </span>
                            )}

                            <div>
                              <div className="font-semibold text-white flex items-center gap-1.5 text-xs">
                                {task.title}
                              </div>
                              {task.requires_verification && (
                                <span className="inline-block mt-0.5 text-[9px] font-bold text-purple-300 bg-purple-950/50 px-1.5 py-0.5 rounded border border-purple-500/30">
                                  Verification Required
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Assignee / Assigned By */}
                        {isSelfView ? (
                          <td className="py-3.5 px-3">
                            <div className="font-medium text-neutral-200">
                              {formatAssignedByName(task.created_by_name)}
                            </div>
                            <div className="text-[10px] text-amber-300/60 leading-tight mt-0.5 font-mono">
                              <div>{createdDT.date}</div>
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="py-3.5 px-3">
                              <div className="font-semibold text-white">
                                {task.assigned_to_name || `User #${task.assigned_to}`}
                              </div>
                              {assigneeMatrix && (
                                <div className="text-[10px] text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                                  <Layers size={10} className="shrink-0 text-amber-500" />
                                  <span className="truncate max-w-[140px]">{assigneeMatrix}</span>
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-3">
                              <div className="font-medium text-neutral-200">
                                {formatAssignedByName(task.created_by_name)}
                              </div>
                              <div className="text-[10px] text-amber-300/60 leading-tight mt-0.5 font-mono">
                                <div>{createdDT.date}</div>
                              </div>
                            </td>
                          </>
                        )}

                        {/* Status */}
                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border font-mono uppercase ${
                              statusStyles[task.status] || 'bg-neutral-800 text-neutral-300 border-neutral-700'
                            }`}
                          >
                            {task.status?.replace('_', ' ')}
                          </span>
                        </td>

                        {/* Priority */}
                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border font-mono uppercase ${
                              priorityStyles[task.priority] || 'bg-neutral-800 text-neutral-300 border-neutral-700'
                            }`}
                          >
                            {task.priority}
                          </span>
                        </td>

                        {/* Progress */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-[#0b0c0e] rounded-full h-1.5 overflow-hidden border border-amber-500/20">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  task.progress_percentage === 100 
                                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' 
                                    : 'bg-gradient-to-r from-amber-500 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                                }`}
                                style={{ width: `${task.progress_percentage}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-mono font-bold text-neutral-300 min-w-[30px]">
                              {task.progress_percentage}%
                            </span>
                          </div>
                        </td>

                        {/* Due Date & Overdue Badge */}
                        <td className="py-3.5 px-3">
                          <div className="text-neutral-200 text-xs font-mono">
                            {task.due_date ? task.due_date : 'No Deadline'}
                          </div>
                          {isOverdue && (
                            <span className="inline-block mt-0.5 text-[9px] font-bold text-rose-300 bg-rose-950/60 px-1.5 py-0.2 rounded border border-rose-500/40 animate-pulse font-mono">
                              OVERDUE
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          {task.status === 'REQUEST_PENDING' ? (
                            isAssignee ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleAcceptTask(task.id)}
                                  className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl text-[11px] font-bold transition shadow-[0_0_12px_rgba(16,185,129,0.3)] cursor-pointer"
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRejectModalTask(task)}
                                  className="px-3 py-1.5 bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white rounded-xl text-[11px] font-bold transition shadow-[0_0_12px_rgba(244,63,94,0.3)] cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-neutral-500 font-medium italic">Pending Acceptance</span>
                            )
                          ) : isAssignee ? (
                            isAwaitingVerification ? (
                              <span className="text-[10px] font-bold text-purple-300 bg-purple-950/50 border border-purple-500/30 px-2.5 py-1 rounded-lg inline-block">
                                Awaiting Verification
                              </span>
                            ) : isOverdue ? (
                              task.overdue_reason_submitted ? (
                                <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 border border-amber-500/30 px-2.5 py-1 rounded-lg inline-block">
                                  Reason Submitted
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDelayModalTask(task)}
                                  className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white px-3 py-1.5 rounded-xl transition shadow-[0_0_15px_rgba(244,63,94,0.3)] cursor-pointer"
                                >
                                  <AlertTriangle size={12} /> Submit Reason
                                </button>
                              )
                            ) : (
                              <button
                                type="button"
                                onClick={() => onOpenActionModal(task)}
                                className="text-xs font-semibold text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 px-3 py-1.5 rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.25)] transition cursor-pointer"
                              >
                                Update
                              </button>
                            )
                          ) : isAuthorityOnSubordinate ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => onOpenActionModal(task)}
                                className="text-xs font-semibold text-amber-300 bg-[#0b0c0e] hover:bg-amber-500/10 border border-amber-500/30 hover:border-amber-400 px-3 py-1.5 rounded-xl transition cursor-pointer"
                              >
                                Update
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>

                      {/* Expanded Drawer */}
                      {isExpanded && (
                        <tr className="bg-[#0b0c0e]/80">
                          <td colSpan={isSelfView ? 7 : 8} className="px-6 py-4 text-xs text-neutral-300 border-b border-amber-500/15 space-y-2">
                            <div>
                              <span className="font-semibold text-amber-300 block mb-1 uppercase tracking-wider text-[10px] font-mono">
                                Task Description:
                              </span>
                              <p className="whitespace-pre-wrap leading-relaxed text-neutral-300 bg-[#141518] p-3 rounded-xl border border-amber-500/15">
                                {task.description || 'No description provided.'}
                              </p>
                            </div>

                            {task.status === 'VERIFIED' && task.verified_by && (
                              <div className="text-[10px] text-emerald-400 font-medium font-mono flex items-center gap-1.5 pt-1">
                                <CheckCircle2 size={12} />
                                Verified and closed by manager ID #{task.verified_by}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARD-STACK VIEW (< md screens) */}
        <div className="block md:hidden divide-y divide-amber-500/10">
          {filteredTasks.length === 0 ? (
            <div className="py-12 text-center text-neutral-400 italic text-xs">
              No active tasks match the selected criteria.
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isAssignee = currentUser?.id === task.assigned_to;
              const isAuthorityOnSubordinate =
                !isAssignee &&
                (['SUPERVISOR', 'DEPT_HEAD', 'BUSINESS_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(
                  currentUser?.role
                ) ||
                  currentUser?.is_superuser ||
                  task.created_by === currentUser?.id);

              const isOverdue = Boolean(task.is_overdue) && !['VERIFIED', 'REJECTED', 'CANCELLED'].includes(task.status);
              const isAwaitingVerification = task.status === 'AWAITING_VERIFICATION';
              const isExpanded = expandedTaskId === task.id;
              const createdDT = formatDateTime(task.created_at);

              return (
                <div key={task.id} className="p-4 space-y-3 hover:bg-[#1a1c22]/50 transition">
                  {/* Top Bar: Title & Commit Pulse */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      {task.is_committed_today && (
                        <span 
                          title="Active in Today's Commitment Plan" 
                          className="relative flex h-2.5 w-2.5 shrink-0 mt-1"
                        >
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                      )}
                      <div>
                        <h4 className="font-semibold text-white text-sm leading-snug">
                          {task.title}
                        </h4>
                        {task.requires_verification && (
                          <span className="inline-block mt-1 text-[9px] font-bold text-purple-300 bg-purple-950/50 px-1.5 py-0.5 rounded border border-purple-500/30">
                            Verification Required
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                      className="p-1 rounded-lg text-amber-400/80 hover:text-amber-300 bg-[#0b0c0e] border border-amber-500/20"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>

                  {/* Status & Priority Chips */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border font-mono uppercase ${
                        statusStyles[task.status] || 'bg-neutral-800 text-neutral-300'
                      }`}
                    >
                      {task.status?.replace('_', ' ')}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border font-mono uppercase ${
                        priorityStyles[task.priority] || 'bg-neutral-800 text-neutral-300'
                      }`}
                    >
                      {task.priority}
                    </span>
                    {isOverdue && (
                      <span className="text-[9px] font-bold text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-500/40 animate-pulse font-mono">
                        OVERDUE
                      </span>
                    )}
                  </div>

                  {/* Progress Meter */}
                  <div className="space-y-1 bg-[#0b0c0e] p-2 rounded-xl border border-amber-500/15">
                    <div className="flex justify-between items-center text-[10px] text-neutral-400 font-mono">
                      <span>Completion</span>
                      <span className="text-amber-300 font-bold">{task.progress_percentage}%</span>
                    </div>
                    <div className="w-full bg-[#141518] rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          task.progress_percentage === 100 
                            ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' 
                            : 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                        }`}
                        style={{ width: `${task.progress_percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Metadata: Dates & Assignee */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-400 pt-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <Calendar size={12} className="text-amber-400 shrink-0" />
                      <span className="font-mono text-neutral-300">
                        {task.due_date ? task.due_date : 'No deadline'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-end truncate">
                      <User size={12} className="text-amber-400 shrink-0" />
                      <span className="truncate text-neutral-300">
                        {isSelfView ? formatAssignedByName(task.created_by_name) : (task.assigned_to_name || 'Unassigned')}
                      </span>
                    </div>
                  </div>

                  {/* Actions Drawer */}
                  <div className="pt-2 border-t border-amber-500/10 flex items-center justify-end gap-2">
                    {task.status === 'REQUEST_PENDING' ? (
                      isAssignee ? (
                        <div className="flex items-center w-full gap-2">
                          <button
                            type="button"
                            onClick={() => handleAcceptTask(task.id)}
                            className="flex-1 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-xl text-xs font-bold transition text-center shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                          >
                            Accept Task
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectModalTask(task)}
                            className="flex-1 py-2 bg-gradient-to-r from-rose-700 to-rose-600 text-white rounded-xl text-xs font-bold transition text-center shadow-[0_0_12px_rgba(244,63,94,0.3)]"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-500 italic">Pending Acceptance</span>
                      )
                    ) : isAssignee ? (
                      isAwaitingVerification ? (
                        <span className="text-[11px] font-bold text-purple-300 bg-purple-950/50 border border-purple-500/30 px-3 py-1.5 rounded-xl w-full text-center">
                          Awaiting Verification
                        </span>
                      ) : isOverdue ? (
                        task.overdue_reason_submitted ? (
                          <span className="text-[11px] font-bold text-amber-300 bg-amber-950/60 border border-amber-500/30 px-3 py-1.5 rounded-xl w-full text-center">
                            Reason Submitted — Review Pending
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDelayModalTask(task)}
                            className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold bg-gradient-to-r from-rose-700 to-rose-600 text-white py-2 rounded-xl transition shadow-[0_0_12px_rgba(244,63,94,0.3)]"
                          >
                            <AlertTriangle size={14} /> Submit Delay Reason
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenActionModal(task)}
                          className="w-full text-xs font-bold text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 py-2 rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.25)] transition text-center"
                        >
                          Update Progress
                        </button>
                      )
                    ) : isAuthorityOnSubordinate ? (
                      <button
                        type="button"
                        onClick={() => onOpenActionModal(task)}
                        className="w-full text-xs font-semibold text-amber-300 bg-[#0b0c0e] border border-amber-500/30 py-2 rounded-xl text-center"
                      >
                        Update Task
                      </button>
                    ) : null}
                  </div>

                  {/* Expanded Task Description Drawer (Mobile) */}
                  {isExpanded && (
                    <div className="pt-2 text-xs space-y-2 bg-[#0b0c0e] p-3 rounded-xl border border-amber-500/15">
                      <span className="font-semibold text-amber-300 block text-[10px] uppercase font-mono">
                        Task Description:
                      </span>
                      <p className="whitespace-pre-wrap leading-relaxed text-neutral-300">
                        {task.description || 'No description provided.'}
                      </p>
                      {task.status === 'VERIFIED' && task.verified_by && (
                        <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 pt-1">
                          <CheckCircle2 size={12} />
                          Verified by manager #{task.verified_by}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* Modals */}
      <TaskDelayModal
        isOpen={Boolean(delayModalTask)}
        task={delayModalTask}
        onClose={() => setDelayModalTask(null)}
        onSuccess={() => {
          setDelayModalTask(null);
          if (onRefresh) onRefresh();
        }}
      />

      <TaskRejectModal
        isOpen={Boolean(rejectModalTask)}
        task={rejectModalTask}
        onClose={() => setRejectModalTask(null)}
        onSuccess={() => {
          setRejectModalTask(null);
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
}