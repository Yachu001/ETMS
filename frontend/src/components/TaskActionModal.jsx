// frontend/src/components/TaskActionModal.jsx

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sliders, 
  AlertCircle, 
  ShieldCheck,
  CheckCircle2,
  Lock
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 transition-all font-sans">
      <div className="bg-[#141518] rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_25px_rgba(245,158,11,0.12)] border border-amber-500/25 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden text-neutral-200">
        
        {/* Header */}
        <div className="flex justify-between items-start pb-3.5 border-b border-amber-500/20 mb-4">
          <div className="min-w-0 pr-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 rounded-md font-mono inline-block">
              Task #{task.id} Action Console
            </span>
            <h3 className="text-base sm:text-lg font-bold text-white mt-1.5 truncate">
              {task.title}
            </h3>
            <p className="text-[11px] text-neutral-400 mt-0.5 flex flex-wrap items-center gap-1.5">
              <span>Assigned to:</span>
              <strong className="text-neutral-200 font-medium">{task.assigned_to_name || 'Self'}</strong>
              {isSelfTask && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-semibold">
                  Personal Task
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-amber-300 rounded-lg transition border border-transparent hover:border-amber-500/20 shrink-0 cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-start gap-2 shadow-[0_0_10px_rgba(244,63,94,0.15)]">
            <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Progress Slider */}
          <div className="p-4 bg-[#0b0c0e] border border-amber-500/20 rounded-xl space-y-3 shadow-inner">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-amber-300 flex items-center gap-1.5 uppercase font-mono text-[11px] tracking-wider">
                <Sliders size={14} className="text-amber-400" />
                Work Progress Percentage
              </span>
              <span className="font-mono font-bold text-sm text-black bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-0.5 rounded-lg shadow-[0_0_10px_rgba(245,158,11,0.25)]">
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
              className="w-full accent-amber-400 cursor-pointer h-2 bg-neutral-800 rounded-lg outline-none"
            />

            <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
              <span>0% (Not Started)</span>
              <span>50% (Underway)</span>
              <span>100% (Completed)</span>
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block font-medium text-amber-300 mb-1.5 text-[11px] uppercase tracking-wider font-mono">
              Execution Lifecycle Status
            </label>
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full text-xs border border-amber-500/25 rounded-xl p-2.5 focus:border-amber-400 outline-none font-medium bg-[#0b0c0e] text-white cursor-pointer"
            >
              {/* Base User Options: Always Available */}
              <option value="ACCEPTED" className="bg-[#141518] text-neutral-300">ACCEPTED — Queued / Not Started</option>
              <option value="IN_PROGRESS" className="bg-[#141518] text-amber-300">IN_PROGRESS — Actively Working</option>
              <option value="ON_HOLD" className="bg-[#141518] text-neutral-400">ON_HOLD — Blocked / Paused</option>
              <option value="AWAITING_VERIFICATION" className="bg-[#141518] text-purple-300">AWAITING_VERIFICATION — Submitted for Review</option>

              {/* Management/Authority Options: Only on Subordinates' Tasks */}
              {isAuthorityOnSubordinate && (
                <>
                  <option value="VERIFIED" className="bg-[#141518] text-emerald-400 font-semibold">VERIFIED — Approved & Closed</option>
                  <option value="CANCELLED" className="bg-[#141518] text-neutral-500">CANCELLED — Void / Terminated</option>
                  <option value="REJECTED" className="bg-[#141518] text-rose-400">REJECTED — Declined</option>
                </>
              )}
            </select>
          </div>

          {/* Verification Notice */}
          {task.requires_verification && (
            <div className="p-3 bg-purple-950/20 border border-purple-500/30 rounded-xl text-purple-300 flex items-start gap-2 shadow-[0_0_12px_rgba(168,85,247,0.08)]">
              <ShieldCheck size={16} className="text-purple-400 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <strong className="text-purple-200">Verification Required:</strong> When set to 100%, this task transitions to <strong className="text-purple-200 font-mono">AWAITING_VERIFICATION</strong> and will await final sign-off by supervisory management.
              </div>
            </div>
          )}

          {/* Audit Remarks */}
          <div>
            <label className="block font-medium text-amber-300 mb-1.5 text-[11px] uppercase tracking-wider font-mono">
              Audit Remarks & Progress Notes (Immutable Log)
            </label>
            <textarea
              rows="3"
              placeholder="e.g. Completed initial mockups, submitted draft for internal review..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full text-xs border border-amber-500/20 rounded-xl p-2.5 focus:border-amber-400 outline-none bg-[#0b0c0e] text-white placeholder-neutral-500 leading-relaxed transition"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-amber-500/15">
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
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-bold rounded-xl text-xs transition shadow-[0_0_15px_rgba(245,158,11,0.25)] disabled:opacity-50 cursor-pointer text-center"
            >
              {submitting ? 'Updating...' : 'Save & Record Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}