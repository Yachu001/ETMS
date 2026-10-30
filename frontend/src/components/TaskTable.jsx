import React, { useState } from 'react';
import api from '../api/axios';
import TaskDelayModal from './TaskDelayModal';
import TaskRejectModal from './TaskRejectModal';
import {
  AlertTriangle,
  Filter,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function TaskTable({ tasks = [], onOpenActionModal, currentUser, onRefresh }) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [expandedTaskId, setExpandedTaskId] = useState(null);

  // Modal target states
  const [delayModalTask, setDelayModalTask] = useState(null);
  const [rejectModalTask, setRejectModalTask] = useState(null);

  const isBaseEmployee = currentUser?.role === 'EMPLOYEE';

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

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
    return true;
  });

  const priorityStyles = {
    LOW: 'bg-slate-100 text-slate-700 border-slate-200',
    MEDIUM: 'bg-blue-50 text-blue-700 border-blue-200',
    HIGH: 'bg-amber-50 text-amber-700 border-amber-200',
    URGENT: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  const statusStyles = {
    REQUEST_PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
    ACCEPTED: 'bg-sky-50 text-sky-800 border-sky-200',
    IN_PROGRESS: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    ON_HOLD: 'bg-orange-50 text-orange-800 border-orange-200',
    AWAITING_VERIFICATION: 'bg-purple-50 text-purple-800 border-purple-200',
    VERIFIED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    REJECTED: 'bg-rose-50 text-rose-800 border-rose-200',
    CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <div className="space-y-3">
      {/* Filters Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Filter size={14} className="text-slate-400" />
          <span>Filter Tasks:</span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="REQUEST_PENDING">Pending Acceptance</option>
            <option value="ACCEPTED">Accepted (Not Started)</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="AWAITING_VERIFICATION">Awaiting Verification</option>
            <option value="VERIFIED">Verified / Done</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700"
          >
            <option value="ALL">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Task Details</th>
                <th className="py-3 px-3">Priority</th>
                {isBaseEmployee ? (
                  <th className="py-3 px-3">Assigned By</th>
                ) : (
                  <>
                    <th className="py-3 px-3">Assignee</th>
                    <th className="py-3 px-3">Assigned By</th>
                  </>
                )}
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Progress</th>
                <th className="py-3 px-3">Due Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={isBaseEmployee ? 7 : 8} className="py-8 text-center text-slate-400">
                    No tasks match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => {
                  const isAssignee = currentUser?.id === task.assigned_to;
                  const isAuthority =
                    ['SUPERVISOR', 'DEPT_HEAD', 'BUSINESS_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(
                      currentUser?.role
                    ) ||
                    currentUser?.is_superuser ||
                    task.created_by === currentUser?.id;
                  const isOverdue = Boolean(task.is_overdue);
                  const isExpanded = expandedTaskId === task.id;
                  const createdDT = formatDateTime(task.created_at);

                  return (
                    <React.Fragment key={task.id}>
                      <tr className="hover:bg-slate-50/70 transition">
                        {/* Task Title & Expand Toggle */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                              className="text-slate-400 hover:text-slate-600 transition"
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            <div>
                              <div className="font-semibold text-slate-900">{task.title}</div>
                              {task.requires_verification && (
                                <span className="inline-block mt-0.5 text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                                  Verification Required
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Priority */}
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                              priorityStyles[task.priority] || 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {task.priority}
                          </span>
                        </td>

                        {/* Assignee / Assigned By Columns */}
                        {isBaseEmployee ? (
                          <td className="py-3 px-3">
                            <div className="font-medium text-slate-800">
                              {formatAssignedByName(task.created_by_name)}
                            </div>
                            <div className="text-[10px] text-slate-400 leading-tight">
                              <div>{createdDT.date}</div>
                              <div>{createdDT.time}</div>
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="py-3 px-3">
                              <span className="font-medium text-slate-800">
                                {task.assigned_to_name || `User #${task.assigned_to}`}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-medium text-slate-800">
                                {formatAssignedByName(task.created_by_name)}
                              </div>
                              <div className="text-[10px] text-slate-400 leading-tight">
                                <div>{createdDT.date}</div>
                                <div>{createdDT.time}</div>
                              </div>
                            </td>
                          </>
                        )}

                        {/* Status */}
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              statusStyles[task.status] || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {task.status?.replace('_', ' ')}
                          </span>
                        </td>

                        {/* Progress */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  task.progress_percentage === 100 ? 'bg-emerald-500' : 'bg-blue-600'
                                }`}
                                style={{ width: `${task.progress_percentage}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-semibold text-slate-700 min-w-[28px]">
                              {task.progress_percentage}%
                            </span>
                          </div>
                        </td>

                        {/* Due Date & Overdue Badge */}
                        <td className="py-3 px-3">
                          <div className="text-slate-700 text-xs">
                            {task.due_date ? task.due_date : 'No Deadline'}
                          </div>
                          {isOverdue && !['VERIFIED', 'CANCELLED'].includes(task.status) && (
                            <span className="inline-block mt-0.5 text-[9px] font-bold text-rose-700 bg-rose-50 px-1 py-0.2 rounded border border-rose-200">
                              OVERDUE
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          {/* Case 1: Task is Pending Acceptance */}
                          {task.status === 'REQUEST_PENDING' ? (
                            isAssignee ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleAcceptTask(task.id)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition shadow-2xs"
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRejectModalTask(task)}
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold transition shadow-2xs"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">Pending Acceptance</span>
                            )
                          ) : isOverdue && !['VERIFIED', 'AWAITING_VERIFICATION', 'CANCELLED'].includes(task.status) ? (
                            /* Case 2: Task is Overdue */
                            isAssignee ? (
                              task.overdue_reason_submitted ? (
                                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md">
                                  Reason Submitted — Awaiting Review
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDelayModalTask(task)}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded-lg transition shadow-2xs"
                                >
                                  <AlertTriangle size={12} /> Submit Overdue Reason
                                </button>
                              )
                            ) : isAuthority ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                                  OVERDUE
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onOpenActionModal(task)}
                                  className="text-xs text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded font-medium border border-blue-200"
                                >
                                  Update
                                </button>
                              </div>
                            ) : null
                          ) : (
                            /* Case 3: Normal In-Progress Task */
                            <button
                              type="button"
                              onClick={() => onOpenActionModal(task)}
                              className="text-xs text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded font-medium border border-transparent hover:border-blue-200 transition"
                            >
                              Update
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Task Description Drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={isBaseEmployee ? 7 : 8} className="px-6 py-3 text-xs text-slate-600 border-b border-slate-200">
                            <div className="space-y-1">
                              <span className="font-semibold text-slate-700">Description:</span>
                              <p className="whitespace-pre-wrap">{task.description || 'No description provided.'}</p>
                            </div>
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
      </div>

      {/* Overdue Delay Modal */}
      <TaskDelayModal
        isOpen={Boolean(delayModalTask)}
        task={delayModalTask}
        onClose={() => setDelayModalTask(null)}
        onSuccess={() => {
          setDelayModalTask(null);
          if (onRefresh) onRefresh();
        }}
      />

      {/* Task Rejection Modal */}
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