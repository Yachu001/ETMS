// frontend/src/components/UserDetailView.jsx

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, CheckSquare, Clock, AlertTriangle, AlertCircle, 
  Calendar, CheckCircle2, User, Building, Briefcase, Shield, Edit3, X, XCircle, Tag, Layers
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
      <div className="bg-[#141518] rounded-2xl border border-amber-500/20 p-12 text-center text-xs text-amber-400/70 font-mono italic animate-pulse shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        Loading employee cockpit details...
      </div>
    );
  }

  if (!data || !data.user) {
    return (
      <div className="bg-[#141518] rounded-2xl border border-amber-500/25 p-8 text-center space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
        <AlertCircle size={28} className="mx-auto text-rose-400" />
        <h3 className="text-sm font-bold text-white tracking-wide">Employee Details Unavailable</h3>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-[#0b0c0e] hover:bg-neutral-800 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold cursor-pointer transition shadow-[0_0_10px_rgba(245,158,11,0.15)]"
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
        <span className="inline-flex items-center gap-1.5 bg-rose-950/60 text-rose-300 border border-rose-500/40 font-mono font-bold px-3 py-1 rounded-full text-xs shadow-[0_0_10px_rgba(244,63,94,0.15)]">
          <XCircle size={14} /> Disabled
        </span>
      );
    }

    if (!user.is_present) {
      return (
        <span className="inline-flex items-center gap-1.5 bg-neutral-800 text-neutral-300 border border-neutral-700 font-mono font-bold px-3 py-1 rounded-full text-xs">
          <Clock size={14} /> On Leave / Offline
        </span>
      );
    }

    if (user.today_committed_count === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 bg-amber-950/60 text-amber-300 border border-amber-500/40 font-mono font-bold px-3 py-1 rounded-full text-xs animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.2)]">
          <AlertTriangle size={14} /> No Commits Today
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 font-mono font-bold px-3 py-1 rounded-full text-xs shadow-[0_0_10px_rgba(16,185,129,0.2)]">
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
    <div className="space-y-5 font-sans text-neutral-200">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#141518] p-4 sm:p-5 rounded-2xl border border-amber-500/25 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_20px_rgba(245,158,11,0.06)]">
        <div className="flex items-start sm:items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-[#0b0c0e] hover:bg-neutral-800 border border-amber-500/25 hover:border-amber-400 rounded-xl text-amber-400 hover:text-amber-300 transition flex items-center justify-center shrink-0 cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.1)]"
            title="Return to Overview"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-white truncate">
                {user.full_name || user.username}
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold uppercase">
                {user.role}
              </span>
              <span className="text-[11px] text-amber-400/70 font-mono">
                {user.employee_code || `EID${user.id}`}
              </span>
            </div>

            {/* Entity, Matrix & Date of Joining Details */}
            <div className="flex items-center gap-2 flex-wrap text-xs text-neutral-400 mt-1.5 font-mono">
              <span className="text-amber-300/90 font-sans">{user.designation || 'Staff'}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Briefcase size={12} className="text-amber-400" />
                <strong className={isGlobalAdmin || isDeptHead ? "text-purple-300" : "text-neutral-200"}>
                  {bizDisplay}
                </strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Building size={12} className="text-amber-400" />
                <strong className={isGlobalAdmin || isBizAdmin ? "text-amber-300" : "text-neutral-200"}>
                  {deptDisplay}
                </strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Layers size={12} className="text-amber-400" />
                <strong className="text-neutral-200">{user.matrix || 'No Matrix'}</strong>
              </span>
              {user.date_of_joining && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-neutral-300">
                    <Calendar size={12} className="text-amber-400" />
                    <span>Joined: {user.date_of_joining}</span>
                  </span>
                </>
              )}
            </div>

            {/* Reporting Leads */}
            <div className="text-[11px] text-neutral-400 mt-1 font-mono">
              {user.role === 'SUPERVISOR' && user.dual_reporting_leads?.length > 0 ? (
                <span className="flex items-center gap-1.5 flex-wrap">
                  <strong className="text-amber-400/80">Leads:</strong>
                  {user.dual_reporting_leads.map((l, i) => (
                    <span key={i} className="text-neutral-200 font-medium bg-[#0b0c0e] border border-amber-500/20 px-2 py-0.5 rounded-md">
                      <span className="text-amber-400">{l.type}:</span> {l.name}
                    </span>
                  ))}
                </span>
              ) : (
                <span>
                  <strong className="text-amber-400/80">Reporting Lead:</strong>{' '}
                  <span className="text-neutral-200">{user.primary_manager || 'Global Operations'}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0">{renderBannerStatus()}</div>
      </div>

      {/* 3-Card Top Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <div className="bg-[#141518] p-4 sm:p-5 rounded-2xl border border-amber-500/20 shadow-[0_10px_25px_rgba(0,0,0,0.5)] flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold text-amber-400/80 uppercase font-mono tracking-wider">
              Total Assigned
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1 font-mono">
              {user.total_assigned_count || tasks.length}
            </div>
            <p className="text-[10px] sm:text-[11px] text-neutral-400 mt-0.5">Total assignments in queue</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center shrink-0">
            <CheckSquare size={18} />
          </div>
        </div>

        <div className="bg-[#141518] p-4 sm:p-5 rounded-2xl border border-amber-500/20 shadow-[0_10px_25px_rgba(0,0,0,0.5)] flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold text-amber-400/80 uppercase font-mono tracking-wider">
              Active Tasks
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 mt-1 font-mono">
              {user.active_tasks_count}
            </div>
            <p className="text-[10px] sm:text-[11px] text-neutral-400 mt-0.5">Accepted and in-progress work</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center shrink-0">
            <Clock size={18} />
          </div>
        </div>

        <div className="bg-[#141518] p-4 sm:p-5 rounded-2xl border border-amber-500/20 shadow-[0_10px_25px_rgba(0,0,0,0.5)] flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold text-amber-400/80 uppercase font-mono tracking-wider">
              Today Committed
            </span>
            <div className={`text-2xl sm:text-3xl font-extrabold mt-1 font-mono ${
              user.today_committed_count > 0 ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {user.today_committed_count}
            </div>
            <p className="text-[10px] sm:text-[11px] text-neutral-400 mt-0.5">Committed in today's plan</p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
            user.today_committed_count > 0 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}>
            <Calendar size={18} />
          </div>
        </div>
      </div>

      {/* Task Backlog Table */}
      <div className="bg-[#141518] rounded-2xl border border-amber-500/25 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_20px_rgba(245,158,11,0.06)] overflow-hidden">
        
        {/* Table Title Bar */}
        <div className="p-4 sm:p-5 bg-[#0b0c0e]/80 border-b border-amber-500/20 flex justify-between items-center">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white uppercase font-mono tracking-wider">
              Assigned Task Roster
            </h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Supervisory inspection and task update controls
            </p>
          </div>
          <span className="text-xs font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.15)]">
            {tasks.length} Total
          </span>
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#0b0c0e] text-amber-400 font-semibold uppercase tracking-wider text-[11px] border-b border-amber-500/20 font-mono">
              <tr>
                <th className="py-3.5 px-4">Task Title</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Due Date</th>
                <th className="py-3.5 px-4">Progress %</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-500/10">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-neutral-400 italic font-mono text-xs">
                    No tasks assigned to this employee.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => {
                  const overdue = isOverdue(task);

                  return (
                    <tr key={task.id} className="hover:bg-[#1a1c22]/80 transition">
                      <td className="py-3.5 px-4 font-semibold text-white">
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
                            <span className="text-[9px] font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 px-1.5 py-0.2 rounded font-mono shrink-0">
                              Today
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <div className="text-[11px] text-neutral-400 font-normal truncate max-w-xs mt-0.5">
                            {task.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase border ${
                          task.priority === 'Urgent'
                            ? 'bg-rose-950/60 text-rose-300 border-rose-500/40'
                            : task.priority === 'High'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-400/50'
                            : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                        }`}>
                          {task.priority || 'Medium'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-neutral-200">
                          <span>{task.due_date || 'No Deadline'}</span>
                          {overdue && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-950/60 text-rose-300 border border-rose-500/40 animate-pulse">
                              Overdue
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-400">
                        {task.progress_percentage}%
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase border ${
                          task.status === 'VERIFIED'
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                            : task.status === 'CANCELLED'
                            ? 'bg-rose-950/60 text-rose-300 border-rose-500/40'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        }`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setEditingTask(task)}
                          className="px-3 py-1.5 bg-[#0b0c0e] hover:bg-neutral-800 text-amber-300 hover:text-white rounded-xl text-xs font-semibold border border-amber-500/30 hover:border-amber-400 transition inline-flex items-center gap-1.5 ml-auto cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.1)]"
                        >
                          <Edit3 size={13} className="text-amber-400" /> Update
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
        <div className="block md:hidden divide-y divide-amber-500/10">
          {tasks.length === 0 ? (
            <div className="text-center py-10 text-neutral-400 italic font-mono text-xs">
              No tasks assigned to this employee.
            </div>
          ) : (
            tasks.map((task) => {
              const overdue = isOverdue(task);

              return (
                <div key={task.id} className="p-4 space-y-3 bg-[#0b0c0e]/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {task.is_committed_today && (
                          <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                        )}
                        <h4 className="font-semibold text-white text-sm break-words leading-snug">
                          {task.title}
                        </h4>
                      </div>
                      {task.description && (
                        <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                    </div>

                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase border shrink-0 ${
                      task.status === 'VERIFIED'
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                        : task.status === 'CANCELLED'
                        ? 'bg-rose-950/60 text-rose-300 border-rose-500/40'
                        : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    }`}>
                      {task.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
                    <span className={`px-2 py-0.5 rounded-md font-bold uppercase border ${
                      task.priority === 'Urgent'
                        ? 'bg-rose-950/60 text-rose-300 border-rose-500/40'
                        : task.priority === 'High'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-400/50'
                        : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                    }`}>
                      {task.priority || 'Medium'}
                    </span>
                    <span className="text-neutral-400">
                      Due: {task.due_date || 'No Date'}
                    </span>
                    {overdue && (
                      <span className="px-1.5 py-0.2 rounded font-bold bg-rose-950/60 text-rose-300 border border-rose-500/40">
                        Overdue
                      </span>
                    )}
                    <span className="ml-auto font-bold text-amber-400">
                      Progress: {task.progress_percentage}%
                    </span>
                  </div>

                  <button
                    onClick={() => setEditingTask(task)}
                    className="w-full py-2 bg-gradient-to-r from-amber-400 to-amber-500 text-black font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.25)] transition"
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 transition-all font-sans">
      <div className="bg-[#141518] rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_25px_rgba(245,158,11,0.12)] border border-amber-500/25 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden text-neutral-200">
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-amber-500/20">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
              Task Management & Rescheduling
            </h3>
            <p className="text-[10px] text-amber-400/70 font-mono">
              Edit parameters, priority, deadlines, and lifecycle state
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-amber-300 rounded-lg transition border border-transparent hover:border-amber-500/20 cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-mono font-medium text-amber-300 uppercase tracking-wider mb-1.5">
              Task Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs border border-amber-500/20 rounded-xl p-2.5 focus:border-amber-400 outline-none bg-[#0b0c0e] text-white transition"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono font-medium text-amber-300 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              rows="2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs border border-amber-500/20 rounded-xl p-2.5 focus:border-amber-400 outline-none bg-[#0b0c0e] text-white transition leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-mono font-medium text-amber-300 uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full text-xs border border-amber-500/20 rounded-xl p-2.5 focus:border-amber-400 outline-none bg-[#0b0c0e] text-white font-medium cursor-pointer"
              >
                <option value="Low" className="bg-[#141518] text-neutral-300">Low</option>
                <option value="Medium" className="bg-[#141518] text-amber-300">Medium</option>
                <option value="High" className="bg-[#141518] text-amber-400 font-semibold">High</option>
                <option value="Urgent" className="bg-[#141518] text-rose-400 font-bold">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-mono font-medium text-amber-300 uppercase tracking-wider mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs border border-amber-500/20 rounded-xl p-2.5 focus:border-amber-400 outline-none bg-[#0b0c0e] text-white font-mono cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono font-medium text-amber-300 uppercase tracking-wider mb-1.5">
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
              className="w-full text-xs border border-amber-500/20 rounded-xl p-2.5 focus:border-amber-400 outline-none bg-[#0b0c0e] text-white font-medium cursor-pointer"
            >
              <option value="ACCEPTED" className="bg-[#141518] text-neutral-300">ACCEPTED (Not Started)</option>
              <option value="IN_PROGRESS" className="bg-[#141518] text-amber-300">IN_PROGRESS (Underway)</option>
              <option value="ON_HOLD" className="bg-[#141518] text-neutral-400">ON_HOLD (Paused)</option>
              <option value="AWAITING_VERIFICATION" className="bg-[#141518] text-purple-300">AWAITING_VERIFICATION (Needs Sign-Off)</option>
              <option value="VERIFIED" className="bg-[#141518] text-emerald-400 font-semibold">VERIFIED (Approved & Closed)</option>
              <option value="CANCELLED" className="bg-[#141518] text-neutral-500">CANCELLED (Terminated)</option>
              <option value="REJECTED" className="bg-[#141518] text-rose-400">REJECTED (Declined)</option>
            </select>
          </div>

          <div className="p-3 bg-[#0b0c0e] rounded-xl border border-amber-500/20 space-y-2">
            <div className="flex justify-between items-center text-xs font-mono font-medium text-amber-300">
              <span className="uppercase tracking-wider">Progress Percentage</span>
              <span className="font-bold text-sm text-black bg-gradient-to-r from-amber-400 to-amber-500 px-2.5 py-0.5 rounded-lg shadow-[0_0_10px_rgba(245,158,11,0.25)]">
                {progress}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer h-2 bg-neutral-800 rounded-lg outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono font-medium text-amber-300 uppercase tracking-wider mb-1.5">
              Remarks
            </label>
            <input
              type="text"
              placeholder="e.g., Extended deadline; rescheduled per morning briefing"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full text-xs border border-amber-500/20 rounded-xl p-2.5 focus:border-amber-400 outline-none bg-[#0b0c0e] text-white placeholder-neutral-500 transition"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-amber-500/15">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 border border-amber-500/20 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-bold text-xs rounded-xl transition shadow-[0_0_15px_rgba(245,158,11,0.25)] disabled:opacity-50 cursor-pointer text-center"
            >
              {submitting ? 'Saving...' : 'Save & Apply'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}