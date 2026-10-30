import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, CheckSquare, Clock, AlertTriangle, AlertCircle, 
  Calendar, CheckCircle2, User, Building, Shield, Edit3, X, XCircle, Tag, Layers
} from 'lucide-react';
import api from '../api/axios';

export default function UserDetailView({ userId, onBack, currentUser }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState(null);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/auth/user-detail/${userId}/`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load employee cockpit:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchUserData();
    }
  }, [userId]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-400">
        Loading employee cockpit details...
      </div>
    );
  }

  if (!data || !data.user) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
        <AlertCircle size={24} className="mx-auto text-rose-500" />
        <h3 className="text-sm font-bold text-slate-800">Employee Details Unavailable</h3>
        <button
          onClick={onBack}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
        >
          &larr; Back to Overview
        </button>
      </div>
    );
  }

  const { user, tasks } = data;

  const renderBannerStatus = () => {
    if (!user.is_active) {
      return (
        <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-800 border border-red-300 font-bold px-3 py-1 rounded-full text-xs">
          <XCircle size={14} /> Disabled
        </span>
      );
    }

    if (!user.is_present) {
      return (
        <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 border border-slate-300 font-bold px-3 py-1 rounded-full text-xs">
          <Clock size={14} /> On Leave / Offline
        </span>
      );
    }

    if (user.today_committed_count === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 border border-amber-300 font-bold px-3 py-1 rounded-full text-xs animate-pulse">
          <AlertTriangle size={14} /> No Commits Today
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-3 py-1 rounded-full text-xs">
        <CheckCircle2 size={14} /> {user.today_committed_count} Commits Today
      </span>
    );
  };

  const isOverdue = (task) => {
    if (!task.due_date) return false;
    if (['VERIFIED', 'CANCELLED', 'REJECTED'].includes(task.status) || task.progress_percentage === 100) return false;
    const todayStr = new Date().toISOString().split('T')[0];
    return todayStr > task.due_date;
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition flex items-center gap-1 text-xs font-semibold cursor-pointer"
            title="Return to Overview"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">{user.full_name || user.username}</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border font-bold">
                {user.role}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {user.designation || 'Staff'} • <strong>Matrix:</strong> {user.matrix || 'No Matrix'} • <strong>Lead:</strong> {user.primary_manager || 'None'}
            </p>
          </div>
        </div>

        <div>{renderBannerStatus()}</div>
      </div>

      {/* 3-Card Top Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Assigned
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {user.total_assigned_count || tasks.length}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Total assignments in queue</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
            <CheckSquare size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Active Tasks
            </span>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {user.active_tasks_count}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Accepted and in-progress work</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Today Committed
            </span>
            <div className={`text-2xl font-bold mt-1 ${user.today_committed_count > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {user.today_committed_count}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Committed in today's morning plan</p>
          </div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user.today_committed_count > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
            <Calendar size={20} />
          </div>
        </div>
      </div>

      {/* Task Backlog Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/60 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Assigned Task Roster</h3>
            <p className="text-[11px] text-slate-500">Supervisory inspection and task update controls</p>
          </div>
          <span className="text-xs font-mono font-bold bg-slate-200/70 text-slate-800 px-2 py-0.5 rounded">
            {tasks.length} Total
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Task Title</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Progress %</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400">
                    No tasks assigned to this employee.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => {
                  const overdue = isOverdue(task);

                  return (
                    <tr key={task.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          {task.is_committed_today && (
                            <span 
                              className="relative flex h-2.5 w-2.5 shrink-0" 
                              title="Active in Today's Commitments Plan"
                            >
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                          )}
                          <span className="truncate max-w-xs">{task.title}</span>
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
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          task.priority === 'Urgent'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200 font-bold'
                            : task.priority === 'High'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-700 border'
                        }`}>
                          {task.priority || 'Medium'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span>{task.due_date || 'No Deadline'}</span>
                          {overdue && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                              Overdue
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">
                        {task.progress_percentage}%
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          task.status === 'VERIFIED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : task.status === 'CANCELLED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setEditingTask(task)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium border border-blue-200 transition flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <Edit3 size={13} /> Update
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingTask && (
        <ManagerTaskEditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSuccess={() => {
            setEditingTask(null);
            fetchUserData();
          }}
        />
      )}
    </div>
  );
}

function ManagerTaskEditModal({ task, onClose, onSuccess }) {
  const [title, setTitle] = useState(task.title || '');
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState(task.priority || 'Medium');
  const [dueDate, setDueDate] = useState(task.due_date || '');
  const [status, setStatus] = useState(task.status || 'IN_PROGRESS');
  const [progress, setProgress] = useState(task.progress_percentage || 0);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      title,
      description,
      priority,
      due_date: dueDate || null,
      status,
      progress_percentage: Number(progress)
    };

    try {
      await api.patch(`/tasks/${task.id}/`, payload);

      if (remarks.trim()) {
        await api.post(`/tasks/${task.id}/action/`, {
          action: 'UPDATE_PROGRESS',
          progress_percentage: Number(progress),
          status: status,
          remarks: remarks.trim()
        }).catch(() => {});
      }

      onSuccess();
    } catch (err) {
      console.error('Task update failed:', err);
      alert('Failed to update task.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Task Management & Rescheduling</h3>
            <p className="text-xs text-slate-500">Edit parameters, priority, deadlines, and status</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Task Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
            <textarea
              rows="2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-hidden"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Lifecycle Status</label>
            <select
              value={status}
              onChange={(e) => {
                const newSt = e.target.value;
                setStatus(newSt);
                if (newSt === 'VERIFIED') setProgress(100);
                if (newSt === 'ACCEPTED' && progress > 0) setProgress(0);
              }}
              className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-hidden font-medium"
            >
              <option value="ACCEPTED">ACCEPTED (Not Started)</option>
              <option value="IN_PROGRESS">IN_PROGRESS (Underway)</option>
              <option value="ON_HOLD">ON_HOLD (Paused)</option>
              <option value="AWAITING_VERIFICATION">AWAITING_VERIFICATION (Needs Sign-Off)</option>
              <option value="VERIFIED">VERIFIED (Approved & Closed)</option>
              <option value="CANCELLED">CANCELLED (Terminated)</option>
              <option value="REJECTED">REJECTED (Declined)</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center text-xs font-medium text-slate-700 mb-1">
              <span>Progress Percentage</span>
              <span className="font-bold text-blue-600 font-mono">{progress}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Remarks</label>
            <input
              type="text"
              placeholder="e.g., Extended deadline; rescheduled per morning briefing"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-medium transition shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save & Apply'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}