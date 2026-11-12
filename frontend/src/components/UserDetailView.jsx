// frontend/src/components/UserDetailView.jsx

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, CheckSquare, Clock, AlertTriangle, AlertCircle, 
  Calendar, CheckCircle2, Building, Briefcase, Edit3, X, XCircle, Layers
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
      <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center text-xs text-blue-600 font-mono font-semibold animate-pulse shadow-[0_8px_25px_rgba(15,23,42,0.05)]">
        Loading employee cockpit details...
      </div>
    );
  }

  if (!data || !data.user) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/90 p-8 text-center space-y-4 shadow-[0_8px_25px_rgba(15,23,42,0.05)]">
        <AlertCircle size={28} className="mx-auto text-rose-500" />
        <h3 className="text-sm font-bold text-slate-900 tracking-wide">Employee Details Unavailable</h3>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold cursor-pointer transition"
        >
          &larr; Back to Overview
        </button>
      </div>
    );
  }

  const { user, tasks } = data;

  // Cross-entity scope display
  const isDeptHead = user.role === 'DEPT_HEAD';
  const isBizAdmin = user.role === 'BUSINESS_ADMIN';
  const isGlobalAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role);

  const bizDisplay = isGlobalAdmin || isDeptHead ? 'All Businesses' : (user.business || 'No Business');
  const deptDisplay = isGlobalAdmin || isBizAdmin ? 'All Departments' : (user.department || 'No Department');

  const renderBannerStatus = () => {
    if (!user.is_active) {
      return (
        <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 font-mono font-bold px-3.5 py-1.5 rounded-full text-xs">
          <XCircle size={14} className="text-rose-600" /> Disabled
        </span>
      );
    }

    if (!user.is_present) {
      return (
        <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 border border-slate-200 font-mono font-bold px-3.5 py-1.5 rounded-full text-xs">
          <Clock size={14} className="text-slate-500" /> On Leave / Offline
        </span>
      );
    }

    if (user.today_committed_count === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 font-mono font-bold px-3.5 py-1.5 rounded-full text-xs animate-pulse">
          <AlertTriangle size={14} className="text-amber-600" /> No Commits Today
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold px-3.5 py-1.5 rounded-full text-xs">
        <CheckCircle2 size={14} className="text-emerald-600" /> {user.today_committed_count} Commits Today
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
    <div className="space-y-5 font-sans text-slate-800">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/95 backdrop-blur-md p-4 sm:p-6 rounded-3xl border border-slate-200/90 shadow-[0_8px_30px_rgba(15,23,42,0.06)] relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-start sm:items-center gap-3.5 relative z-10">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-2xl text-slate-600 hover:text-blue-700 transition flex items-center justify-center shrink-0 cursor-pointer shadow-2xs"
            title="Return to Overview"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                {user.full_name || user.username}
              </h1>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold uppercase">
                {user.role}
              </span>
              <span className="text-[11px] text-blue-600 font-mono font-semibold">
                {user.employee_code || `EID${user.id}`}
              </span>
            </div>

            {/* Entity, Matrix & Date of Joining Details */}
            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 mt-1.5 font-mono">
              <span className="text-slate-700 font-sans font-semibold">{user.designation || 'Staff'}</span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <Briefcase size={12} className="text-blue-600" />
                <strong className={isGlobalAdmin || isDeptHead ? "text-indigo-700" : "text-slate-800"}>
                  {bizDisplay}
                </strong>
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <Building size={12} className="text-blue-600" />
                <strong className={isGlobalAdmin || isBizAdmin ? "text-blue-700" : "text-slate-800"}>
                  {deptDisplay}
                </strong>
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <Layers size={12} className="text-blue-600" />
                <strong className="text-slate-800">{user.matrix || 'No Matrix'}</strong>
              </span>
              {user.date_of_joining && (
                <>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1 text-slate-600">
                    <Calendar size={12} className="text-blue-600" />
                    <span>Joined: {user.date_of_joining}</span>
                  </span>
                </>
              )}
            </div>

            {/* Reporting Leads */}
            <div className="text-[11px] text-slate-500 mt-1.5 font-mono">
              {user.role === 'SUPERVISOR' && user.dual_reporting_leads?.length > 0 ? (
                <span className="flex items-center gap-1.5 flex-wrap">
                  <strong className="text-slate-700">Leads:</strong>
                  {user.dual_reporting_leads.map((l, i) => (
                    <span key={i} className="text-slate-800 font-semibold bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg">
                      <span className="text-blue-700">{l.type}:</span> {l.name}
                    </span>
                  ))}
                </span>
              ) : (
                <span>
                  <strong className="text-slate-700">Reporting Lead:</strong>{' '}
                  <span className="text-slate-900 font-semibold">{user.primary_manager || 'Global Operations'}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 relative z-10">{renderBannerStatus()}</div>
      </div>

      {/* 3-Card Top Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold text-blue-600 uppercase tracking-wider">
              Total Assigned
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 font-mono">
              {user.total_assigned_count || tasks.length}
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">Total assignments in queue</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <CheckSquare size={19} />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold text-blue-600 uppercase tracking-wider">
              Active Tasks
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-blue-700 mt-1 font-mono">
              {user.active_tasks_count}
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">Accepted and in-progress work</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <Clock size={19} />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold text-blue-600 uppercase tracking-wider">
              Today Committed
            </span>
            <div className={`text-2xl sm:text-3xl font-extrabold mt-1 font-mono ${
              user.today_committed_count > 0 ? 'text-emerald-600' : 'text-amber-600'
            }`}>
              {user.today_committed_count}
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">Committed in today's plan</p>
          </div>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border shrink-0 ${
            user.today_committed_count > 0 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
              : 'bg-amber-50 border-amber-200 text-amber-600'
          }`}>
            <Calendar size={19} />
          </div>
        </div>
      </div>

      {/* Task Backlog Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] overflow-hidden">
        
        {/* Table Title Bar */}
        <div className="p-4 sm:p-5 bg-slate-50/90 border-b border-slate-200/80 flex justify-between items-center">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
              Assigned Task Roster
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Supervisory inspection and task update controls
            </p>
          </div>
          <span className="text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full">
            {tasks.length} Total
          </span>
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full text-left text-xs border-collapse text-slate-700">
            <thead className="bg-slate-50/60 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-4">Task Title</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Due Date</th>
                <th className="py-3.5 px-4">Progress %</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400 italic text-xs">
                    No tasks assigned to this employee.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => {
                  const overdue = isOverdue(task);

                  return (
                    <tr key={task.id} className="hover:bg-blue-50/40 transition duration-150">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
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
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.2 rounded-md font-mono shrink-0">
                              Today
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <div className="text-[11px] text-slate-500 font-normal truncate max-w-xs mt-0.5">
                            {task.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase border ${
                          task.priority === 'Urgent' || task.priority === 'URGENT'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : task.priority === 'High' || task.priority === 'HIGH'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {task.priority || 'Medium'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-slate-700 font-medium">
                          <span>{task.due_date || 'No Deadline'}</span>
                          {overdue && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                              Overdue
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                        {task.progress_percentage}%
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase border ${
                          task.status === 'VERIFIED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : task.status === 'CANCELLED' || task.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setEditingTask(task)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold border border-blue-200 transition inline-flex items-center gap-1.5 ml-auto cursor-pointer"
                        >
                          <Edit3 size={13} className="text-blue-600" /> Update
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="block md:hidden divide-y divide-slate-100">
          {tasks.length === 0 ? (
            <div className="text-center py-10 text-slate-400 italic text-xs">
              No tasks assigned to this employee.
            </div>
          ) : (
            tasks.map((task) => {
              const overdue = isOverdue(task);

              return (
                <div key={task.id} className="p-4 space-y-3 hover:bg-blue-50/30 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {task.is_committed_today && (
                          <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                        )}
                        <h4 className="font-bold text-slate-900 text-sm break-words leading-snug">
                          {task.title}
                        </h4>
                      </div>
                      {task.description && (
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                    </div>

                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase border shrink-0 ${
                      task.status === 'VERIFIED'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : task.status === 'CANCELLED' || task.status === 'REJECTED'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {task.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
                    <span className={`px-2 py-0.5 rounded-md font-bold uppercase border ${
                      task.priority === 'Urgent' || task.priority === 'URGENT'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : task.priority === 'High' || task.priority === 'HIGH'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {task.priority || 'Medium'}
                    </span>
                    <span className="text-slate-500">
                      Due: {task.due_date || 'No Date'}
                    </span>
                    {overdue && (
                      <span className="px-1.5 py-0.2 rounded font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        Overdue
                      </span>
                    )}
                    <span className="ml-auto font-bold text-blue-700">
                      Progress: {task.progress_percentage}%
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditingTask(task)}
                    className="w-full py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-[0_3px_10px_rgba(37,99,235,0.25)] transition cursor-pointer"
                  >
                    <Edit3 size={13} /> Update Task
                  </button>
                </div>
              );
            })
          )}
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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 transition-all font-sans">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-[0_24px_50px_rgba(15,23,42,0.16)] border border-slate-200/90 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden text-slate-800">
        <div className="flex justify-between items-center mb-4 pb-3.5 border-b border-slate-100">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-wide">
              Task Management & Rescheduling
            </h3>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Edit parameters, priority, deadlines, and lifecycle state
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Task Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none bg-slate-50/70 focus:bg-white text-slate-900 transition"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              rows="2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none bg-slate-50/70 focus:bg-white text-slate-900 transition leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none bg-slate-50/70 focus:bg-white text-slate-800 font-semibold cursor-pointer"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none bg-slate-50/70 focus:bg-white text-slate-800 font-mono cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Lifecycle Status
            </label>
            <select
              value={status}
              onChange={(e) => {
                const newSt = e.target.value;
                setStatus(newSt);
                if (newSt === 'VERIFIED') setProgress(100);
                if (newSt === 'ACCEPTED' && progress > 0) setProgress(0);
              }}
              className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none bg-slate-50/70 focus:bg-white text-slate-800 font-semibold cursor-pointer"
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

          <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/80 space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-slate-700">
              <span className="uppercase tracking-wider text-[11px]">Progress Percentage</span>
              <span className="font-mono font-bold text-sm text-white bg-gradient-to-r from-blue-600 to-blue-700 px-3 py-0.5 rounded-lg shadow-[0_2px_8px_rgba(37,99,235,0.28)]">
                {progress}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Remarks
            </label>
            <input
              type="text"
              placeholder="e.g., Extended deadline; rescheduled per morning briefing"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none bg-slate-50/70 focus:bg-white text-slate-900 placeholder-slate-400 transition"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold text-xs rounded-xl transition shadow-[0_4px_14px_rgba(37,99,235,0.28)] hover:shadow-[0_6px_18px_rgba(37,99,235,0.38)] disabled:opacity-50 cursor-pointer text-center"
            >
              {submitting ? 'Saving...' : 'Save & Apply'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}