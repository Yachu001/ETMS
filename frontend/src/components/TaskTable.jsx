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
  CheckCircle2,
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

  // White & Royal Blue Theme Priority Tokens
  const priorityStyles = {
    LOW: 'bg-slate-100 text-slate-600 border-slate-200',
    MEDIUM: 'bg-sky-50 text-sky-700 border-sky-200',
    HIGH: 'bg-amber-50 text-amber-700 border-amber-200',
    URGENT: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  // White & Royal Blue Theme Status Tokens
  const statusStyles = {
    REQUEST_PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
    ACCEPTED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
    ON_HOLD: 'bg-slate-100 text-slate-600 border-slate-200',
    AWAITING_VERIFICATION: 'bg-purple-50 text-purple-700 border-purple-200',
    VERIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
    CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
  };

  return (
    <div className="space-y-4 font-sans text-slate-800">
      {/* Filters Bar */}
      <div className="bg-white/95 backdrop-blur-md p-3.5 sm:p-4 rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
            <Filter size={14} />
          </div>
          <span className="tracking-wide uppercase text-[11px]">Filter Tasks</span>
          <span className="text-slate-400 font-mono text-[10px] font-semibold">({filteredTasks.length} loaded)</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-none bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition cursor-pointer text-xs"
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
            className="flex-1 sm:flex-none bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition cursor-pointer text-xs"
          >
            <option value="ALL">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>

          {(statusFilter !== 'ALL' || priorityFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setPriorityFilter('ALL');
              }}
              className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 font-semibold transition cursor-pointer"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] overflow-hidden">
        
        {/* DESKTOP TABLE VIEW (md and up) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs text-slate-700">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200/80 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
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
            <tbody className="divide-y divide-slate-100">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={isSelfView ? 7 : 8} className="py-12 text-center text-slate-400 italic">
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
                      <tr className="hover:bg-blue-50/40 transition duration-150">
                        {/* Task Name & Commitment Pulse */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                              className="text-slate-400 hover:text-blue-600 transition cursor-pointer p-1 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200"
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
                              <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                                {task.title}
                              </div>
                              {task.requires_verification && (
                                <span className="inline-block mt-0.5 text-[9px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                                  Verification Required
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Assignee / Assigned By */}
                        {isSelfView ? (
                          <td className="py-3.5 px-3">
                            <div className="font-semibold text-slate-800">
                              {formatAssignedByName(task.created_by_name)}
                            </div>
                            <div className="text-[10px] text-slate-400 leading-tight mt-0.5 font-mono">
                              <div>{createdDT.date}</div>
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="py-3.5 px-3">
                              <div className="font-bold text-slate-900">
                                {task.assigned_to_name || `User #${task.assigned_to}`}
                              </div>
                              {assigneeMatrix && (
                                <div className="text-[10px] text-blue-600 font-semibold flex items-center gap-1 mt-0.5">
                                  <Layers size={10} className="shrink-0 text-blue-600" />
                                  <span className="truncate max-w-[140px]">{assigneeMatrix}</span>
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-3">
                              <div className="font-semibold text-slate-800">
                                {formatAssignedByName(task.created_by_name)}
                              </div>
                              <div className="text-[10px] text-slate-400 leading-tight mt-0.5 font-mono">
                                <div>{createdDT.date}</div>
                              </div>
                            </td>
                          </>
                        )}

                        {/* Status */}
                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border font-mono uppercase ${
                              statusStyles[task.status] || 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {task.status?.replace('_', ' ')}
                          </span>
                        </td>

                        {/* Priority */}
                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border font-mono uppercase ${
                              priorityStyles[task.priority] || 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {task.priority}
                          </span>
                        </td>

                        {/* Progress */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200/80">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  task.progress_percentage === 100 
                                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' 
                                    : 'bg-gradient-to-r from-blue-600 to-blue-500'
                                }`}
                                style={{ width: `${task.progress_percentage}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-mono font-bold text-slate-700 min-w-[30px]">
                              {task.progress_percentage}%
                            </span>
                          </div>
                        </td>

                        {/* Due Date & Overdue Badge */}
                        <td className="py-3.5 px-3">
                          <div className="text-slate-700 text-xs font-mono font-medium">
                            {task.due_date ? task.due_date : 'No Deadline'}
                          </div>
                          {isOverdue && (
                            <span className="inline-block mt-0.5 text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 animate-pulse font-mono">
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
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-semibold transition shadow-[0_3px_10px_rgba(5,150,105,0.25)] cursor-pointer"
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRejectModalTask(task)}
                                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[11px] font-semibold transition cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium italic">Pending Acceptance</span>
                            )
                          ) : isAssignee ? (
                            isAwaitingVerification ? (
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg inline-block">
                                Awaiting Verification
                              </span>
                            ) : isOverdue ? (
                              task.overdue_reason_submitted ? (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg inline-block">
                                  Reason Submitted
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDelayModalTask(task)}
                                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl transition shadow-[0_3px_10px_rgba(225,29,72,0.25)] cursor-pointer"
                                >
                                  <AlertTriangle size={12} /> Submit Reason
                                </button>
                              )
                            ) : (
                              <button
                                type="button"
                                onClick={() => onOpenActionModal(task)}
                                className="text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 px-3.5 py-1.5 rounded-xl shadow-[0_3px_10px_rgba(37,99,235,0.25)] transition cursor-pointer"
                              >
                                Update
                              </button>
                            )
                          ) : isAuthorityOnSubordinate ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => onOpenActionModal(task)}
                                className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-xl transition cursor-pointer"
                              >
                                Update
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>

                      {/* Expanded Drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={isSelfView ? 7 : 8} className="px-6 py-4 text-xs text-slate-700 border-b border-slate-200/80 space-y-2">
                            <div>
                              <span className="font-bold text-slate-500 block mb-1 uppercase tracking-wider text-[10px]">
                                Task Description:
                              </span>
                              <p className="whitespace-pre-wrap leading-relaxed text-slate-700 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                                {task.description || 'No description provided.'}
                              </p>
                            </div>

                            {task.status === 'VERIFIED' && task.verified_by && (
                              <div className="text-[10px] text-emerald-700 font-semibold font-mono flex items-center gap-1.5 pt-1">
                                <CheckCircle2 size={12} className="text-emerald-600" />
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
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredTasks.length === 0 ? (
            <div className="py-12 text-center text-slate-400 italic text-xs">
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

              return (
                <div key={task.id} className="p-4 space-y-3 hover:bg-blue-50/30 transition">
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
                        <h4 className="font-bold text-slate-900 text-sm leading-snug">
                          {task.title}
                        </h4>
                        {task.requires_verification && (
                          <span className="inline-block mt-1 text-[9px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                            Verification Required
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                      className="p-1.5 rounded-xl text-slate-500 hover:text-blue-600 bg-slate-50 border border-slate-200"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>

                  {/* Status & Priority Chips */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border font-mono uppercase ${
                        statusStyles[task.status] || 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {task.status?.replace('_', ' ')}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border font-mono uppercase ${
                        priorityStyles[task.priority] || 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {task.priority}
                    </span>
                    {isOverdue && (
                      <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 animate-pulse font-mono">
                        OVERDUE
                      </span>
                    )}
                  </div>

                  {/* Progress Meter */}
                  <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                      <span>Completion</span>
                      <span className="text-blue-700 font-bold">{task.progress_percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          task.progress_percentage === 100 
                            ? 'bg-emerald-500' 
                            : 'bg-blue-600'
                        }`}
                        style={{ width: `${task.progress_percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Metadata: Dates & Assignee */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <Calendar size={12} className="text-blue-600 shrink-0" />
                      <span className="font-mono text-slate-700 font-medium">
                        {task.due_date ? task.due_date : 'No deadline'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-end truncate">
                      <User size={12} className="text-blue-600 shrink-0" />
                      <span className="truncate text-slate-700 font-medium">
                        {isSelfView ? formatAssignedByName(task.created_by_name) : (task.assigned_to_name || 'Unassigned')}
                      </span>
                    </div>
                  </div>

                  {/* Actions Drawer */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                    {task.status === 'REQUEST_PENDING' ? (
                      isAssignee ? (
                        <div className="flex items-center w-full gap-2">
                          <button
                            type="button"
                            onClick={() => handleAcceptTask(task.id)}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition text-center shadow-[0_3px_10px_rgba(5,150,105,0.25)]"
                          >
                            Accept Task
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectModalTask(task)}
                            className="flex-1 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition text-center"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Pending Acceptance</span>
                      )
                    ) : isAssignee ? (
                      isAwaitingVerification ? (
                        <span className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-xl w-full text-center">
                          Awaiting Verification
                        </span>
                      ) : isOverdue ? (
                        task.overdue_reason_submitted ? (
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl w-full text-center">
                            Reason Submitted — Review Pending
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDelayModalTask(task)}
                            className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white py-2 rounded-xl transition shadow-[0_3px_10px_rgba(225,29,72,0.25)]"
                          >
                            <AlertTriangle size={14} /> Submit Delay Reason
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenActionModal(task)}
                          className="w-full text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 py-2 rounded-xl shadow-[0_3px_10px_rgba(37,99,235,0.25)] transition text-center"
                        >
                          Update Progress
                        </button>
                      )
                    ) : isAuthorityOnSubordinate ? (
                      <button
                        type="button"
                        onClick={() => onOpenActionModal(task)}
                        className="w-full text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 py-2 rounded-xl text-center"
                      >
                        Update Task
                      </button>
                    ) : null}
                  </div>

                  {/* Expanded Task Description Drawer (Mobile) */}
                  {isExpanded && (
                    <div className="pt-2 text-xs space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                      <span className="font-bold text-slate-500 block text-[10px] uppercase">
                        Task Description:
                      </span>
                      <p className="whitespace-pre-wrap leading-relaxed text-slate-700">
                        {task.description || 'No description provided.'}
                      </p>
                      {task.status === 'VERIFIED' && task.verified_by && (
                        <div className="text-[10px] text-emerald-700 font-semibold font-mono flex items-center gap-1 pt-1">
                          <CheckCircle2 size={12} className="text-emerald-600" />
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