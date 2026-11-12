// frontend/src/components/TaskActionModal.jsx

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sliders, 
  AlertCircle, 
  ShieldCheck
} from 'lucide-react';
import api from '../api/axios';

export default function TaskActionModal({ isOpen, onClose, task, onActionSuccess, currentUser }) {
  if (!isOpen || !task) return null;

  // Strict check: Is this task assigned to the current user?
  const isSelfTask = task?.assigned_to === currentUser?.id;

  // Authority privileges apply ONLY to tasks assigned to subordinates
  const isAuthorityOnSubordinate = !isSelfTask && (
    ['SUPERVISOR', 'DEPT_HEAD', 'BUSINESS_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(currentUser?.role) || 
    currentUser?.is_superuser ||
    task.created_by === currentUser?.id
  );

  const [progress, setProgress] = useState(task.progress_percentage || 0);
  const [status, setStatus] = useState(task.status || 'IN_PROGRESS');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setProgress(task.progress_percentage || 0);
    setStatus(task.status || 'IN_PROGRESS');
    setRemarks('');
    setError(null);
  }, [task]);

  const handleProgressChange = (newVal) => {
    const val = Number(newVal);
    setProgress(val);

    if (val === 100) {
      if (task.requires_verification || isSelfTask) {
        setStatus('AWAITING_VERIFICATION');
      } else {
        setStatus('VERIFIED');
      }
    } else if (val > 0 && ['REQUEST_PENDING', 'ACCEPTED'].includes(status)) {
      setStatus('IN_PROGRESS');
    }
  };

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    if (newStatus === 'VERIFIED') {
      setProgress(100);
    } else if (newStatus === 'ACCEPTED' && progress === 100) {
      setProgress(0);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      action: 'UPDATE_PROGRESS',
      progress_percentage: Number(progress),
      status: status,
      remarks: remarks.trim() || `Progress updated to ${progress}% (${status})`
    };

    try {
      await api.post(`/tasks/${task.id}/action/`, payload);
      if (onActionSuccess) onActionSuccess();
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail 
        || JSON.stringify(err.response?.data) 
        || 'Failed to update task state.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4 transition-all font-sans">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-[0_24px_50px_rgba(15,23,42,0.16)] border border-slate-200/90 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden text-slate-800">
        
        {/* Header */}
        <div className="flex justify-between items-start pb-3.5 border-b border-slate-100 mb-4">
          <div className="min-w-0 pr-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md font-mono inline-block">
              Task #{task.id} Action Console
            </span>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1.5 truncate">
              {task.title}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
              <span>Assigned to:</span>
              <strong className="text-slate-800 font-semibold">{task.assigned_to_name || 'Self'}</strong>
              {isSelfTask && (
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-mono font-bold">
                  Personal Task
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition shrink-0 cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2 font-medium">
            <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Progress Slider */}
          <div className="p-4 bg-slate-50/90 border border-slate-200/80 rounded-2xl space-y-3 shadow-2xs">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-700 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
                <Sliders size={14} className="text-blue-600" />
                Work Progress Percentage
              </span>
              <span className="font-mono font-bold text-sm text-white bg-gradient-to-r from-blue-600 to-blue-700 px-3 py-0.5 rounded-lg shadow-[0_2px_8px_rgba(37,99,235,0.28)]">
                {progress}%
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={progress}
              onChange={(e) => handleProgressChange(e.target.value)}
              className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg outline-none"
            />

            <div className="flex justify-between text-[10px] text-slate-500 font-mono font-medium">
              <span>0% (Not Started)</span>
              <span>50% (Underway)</span>
              <span>100% (Completed)</span>
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5 text-[11px] uppercase tracking-wider">
              Execution Lifecycle Status
            </label>
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none font-semibold bg-slate-50/70 focus:bg-white text-slate-800 cursor-pointer transition"
            >
              {/* Base User Options: Always Available */}
              <option value="ACCEPTED">ACCEPTED — Queued / Not Started</option>
              <option value="IN_PROGRESS">IN_PROGRESS — Actively Working</option>
              <option value="ON_HOLD">ON_HOLD — Blocked / Paused</option>
              <option value="AWAITING_VERIFICATION">AWAITING_VERIFICATION — Submitted for Review</option>

              {/* Management/Authority Options: Only on Subordinates' Tasks */}
              {isAuthorityOnSubordinate && (
                <>
                  <option value="VERIFIED">VERIFIED — Approved & Closed</option>
                  <option value="CANCELLED">CANCELLED — Void / Terminated</option>
                  <option value="REJECTED">REJECTED — Declined</option>
                </>
              )}
            </select>
          </div>

          {/* Verification Notice */}
          {task.requires_verification && (
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl text-indigo-900 flex items-start gap-2.5">
              <ShieldCheck size={16} className="text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <strong className="text-indigo-950">Verification Required:</strong> When set to 100%, this task transitions to <strong className="text-indigo-700 font-mono">AWAITING_VERIFICATION</strong> and will await final sign-off by supervisory management.
              </div>
            </div>
          )}

          {/* Audit Remarks */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5 text-[11px] uppercase tracking-wider">
              Audit Remarks & Progress Notes (Immutable Log)
            </label>
            <textarea
              rows="3"
              placeholder="e.g. Completed initial mockups, submitted draft for internal review..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none bg-slate-50/70 focus:bg-white text-slate-900 placeholder-slate-400 leading-relaxed transition"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-slate-100">
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
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold rounded-xl text-xs transition shadow-[0_4px_14px_rgba(37,99,235,0.28)] hover:shadow-[0_6px_18px_rgba(37,99,235,0.38)] disabled:opacity-50 cursor-pointer text-center"
            >
              {submitting ? 'Updating...' : 'Save & Record Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}