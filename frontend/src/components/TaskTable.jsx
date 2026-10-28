import React, { useState } from 'react';
import api from '../api/axios';
import TaskDelayModal from './TaskDelayModal';
import { 
  Check, 
  X, 
  Clock, 
  AlertCircle, 
  Edit3, 
  Calendar,
  User,
  AlertTriangle
} from 'lucide-react';

export default function TaskTable({ tasks, onOpenActionModal, onRefresh, currentUser }) {
  const [rejectingTask, setRejectingTask] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('BANDWIDTH');
  const [rejectionRemarks, setRejectionRemarks] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);
  const [delayTask, setDelayTask] = useState(null);
  const todayStr = new Date().toISOString().split('T')[0];

  const isBaseEmployee = currentUser?.role === 'EMPLOYEE';

  const handleDirectAccept = async (task) => {
    try {
      await api.post(`/tasks/${task.id}/action/`, { action: 'ACCEPT' });
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.response?.data?.detail || err.response?.data?.error || 'Failed to accept task.');
    }
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectionRemarks.trim()) {
      alert('Detailed explanation is mandatory when rejecting.');
      return;
    }
    setSubmittingReject(true);
    try {
      await api.post(`/tasks/${rejectingTask.id}/action/`, {
        action: 'REJECT',
        rejection_reason: rejectionReason,
        rejection_remarks: rejectionRemarks.trim()
      });
      setRejectingTask(null);
      setRejectionRemarks('');
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.response?.data?.detail || err.response?.data?.error || 'Failed to reject task.');
    } finally {
      setSubmittingReject(false);
    }
  };

  const statusBadge = (task) => {
    switch (task.status) {
      case 'REQUEST_PENDING':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Pending Review</span>;
      case 'ACCEPTED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">Not Started</span>;
      case 'IN_PROGRESS':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">In Progress</span>;
      case 'ON_HOLD':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">On Hold</span>;
      case 'AWAITING_VERIFICATION':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">Waiting Sign-Off</span>;
      case 'VERIFIED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Verified & Done</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-600">{task.status}</span>;
    }
  };

  const formatAssignedDateTime = (timestamp) => {
    if (!timestamp) return 'Recent';
    const d = new Date(timestamp);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' • ' + 
           d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3 px-4">Task Details</th>
              {!isBaseEmployee && <th className="py-3 px-4">Assigned To</th>}
              <th className="py-3 px-4">Assigned By</th>
              <th className="py-3 px-4">Priority</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Progress (%)</th>
              <th className="py-3 px-4">Due Date</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={isBaseEmployee ? 7 : 8} className="text-center py-8 text-slate-400">
                  No active tasks found in this view.
                </td>
              </tr>
            ) : (
              tasks.map((task) => {
                const isPastDate = task.due_date && task.due_date < todayStr;
                const isOverdue = Boolean(task.is_overdue || (isPastDate && task.progress_percentage < 100 && !['VERIFIED', 'REJECTED', 'CANCELLED', 'AWAITING_VERIFICATION'].includes(task.status)));
                const isLocked = task.status === 'AWAITING_VERIFICATION' && isBaseEmployee;
                

                return (
                  <tr key={task.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        {/* Green Active Dot for Today's Committed Tasks */}
                        {task.is_committed_today && (
                          <span 
                            className="relative flex h-2.5 w-2.5 shrink-0" 
                            title="Active in Today's Commitments Plan"
                          >
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                          </span>
                        )}
                        
                        <span className="truncate max-w-sm">{task.title}</span>

                        {task.is_committed_today && (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-mono shrink-0">
                            Today
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <div className="text-[11px] text-slate-400 font-normal truncate max-w-xs mt-0.5">
                          {task.description}
                        </div>
                      )}
                    </td>

                    {!isBaseEmployee && (
                      <td className="py-3 px-4 text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <User size={13} className="text-slate-400" />
                          <span>{task.assigned_to_name || 'Unassigned'}</span>
                        </div>
                      </td>
                    )}

                    <td className="py-3 px-4 text-slate-600">
                      <div className="font-medium text-slate-800">{task.created_by_name || 'Self'}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {formatAssignedDateTime(task.created_at)}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        task.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                        task.priority === 'HIGH' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                        task.priority === 'MEDIUM' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                        'bg-slate-100 text-slate-700 border border-slate-300'
                      }`}>
                        {task.priority}
                      </span>
                    </td>

                    {/* Read-Only Status Column */}
                    <td className="py-3 px-4">
                      {statusBadge(task)}
                    </td>

                    {/* Read-Only Progress Column */}
                    <td className="py-3 px-4">
                      <div className="space-y-1 w-24">
                        <div className="font-mono font-bold text-blue-600 text-xs">
                          {task.progress_percentage}%
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-full ${task.progress_percentage === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                            style={{ width: `${task.progress_percentage}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px]">
                      {task.due_date ? (
                        <div className="space-y-0.5">
                          <span className="flex items-center gap-1 text-slate-700">
                            <Calendar size={12} className="text-slate-400" />
                            {task.due_date}
                          </span>
                          {isOverdue && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded">
                              <AlertTriangle size={10} /> Overdue
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {task.status === 'REQUEST_PENDING' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleDirectAccept(task)}
                            title="Accept Task"
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg transition"
                          >
                            <Check size={14} className="stroke-[2.5]" />
                          </button>
                          <button
                            onClick={() => setRejectingTask(task)}
                            title="Reject Task"
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg transition"
                          >
                            <X size={14} className="stroke-[2.5]" />
                          </button>
                        </div>
                      ) : isLocked ? (
                        <span className="text-[11px] font-medium text-purple-700 italic flex items-center justify-end gap-1">
                          <Clock size={12} /> Pending Review
                        </span>
                      ) : isOverdue ? (
                        <button
                          onClick={() => setDelayTask(task)}
                          className="inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-slate-950 px-2.5 py-1.5 rounded-lg text-xs font-bold transition shadow-xs animate-pulse"
                        >
                          <AlertTriangle size={12} /> Explain Delay
                        </button>
                      ) : (
                        <button
                          onClick={() => onOpenActionModal(task)}
                          className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium transition shadow-2xs"
                        >
                          <Edit3 size={12} /> Update
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <TaskDelayModal
        isOpen={Boolean(delayTask)}
        onClose={() => setDelayTask(null)}
        task={delayTask}
        onReportSubmitted={() => {
          setDelayTask(null);
          if (onRefresh) onRefresh();
        }}
      />

      {rejectingTask && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
                <AlertCircle size={17} /> Reject Task Assignment
              </div>
              <button onClick={() => setRejectingTask(null)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Rejecting <strong>"{rejectingTask.title}"</strong>. The reason will be documented in the activity history[cite: 1, 4].
            </p>

            <form onSubmit={handleConfirmReject} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Reason Category</label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="BANDWIDTH">Over Capacity / Insufficient Bandwidth</option>
                  <option value="TERRITORY">Not My Department / Territory</option>
                  <option value="SKILLSET">Skillset Mismatch</option>
                  <option value="CLARITY">Ambiguous / Incomplete Requirements</option>
                  <option value="OTHER">Other Reason</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Detailed Explanation</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Explain why you are declining this assignment..."
                  value={rejectionRemarks}
                  onChange={(e) => setRejectionRemarks(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectingTask(null)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReject}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                >
                  {submittingReject ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}