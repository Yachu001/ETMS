import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckSquare, 
  Sliders, 
  MessageSquare, 
  AlertCircle, 
  ShieldCheck,
  Calendar,
  Clock
} from 'lucide-react';
import api from '../api/axios';

export default function TaskActionModal({ isOpen, onClose, task, onActionSuccess, currentUser }) {
  if (!isOpen || !task) return null;

  const isAuthority = [
    'SUPERVISOR', 
    'DEPT_HEAD', 
    'BUSINESS_ADMIN', 
    'ADMIN', 
    'SUPER_ADMIN'
  ].includes(currentUser?.role) || task.created_by === currentUser?.id;

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
      if (task.requires_verification) {
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-slate-100 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-start pb-3 border-b border-slate-100 mb-4">
          <div className="min-w-0 pr-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              Task #{task.id} Action Console
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-1 truncate">
              {task.title}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Assigned to: <strong className="text-slate-600">{task.assigned_to_name || 'Self'}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition shrink-0 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
            <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Progress Slider */}
          <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Sliders size={14} className="text-blue-600" />
                Work Progress Percentage
              </span>
              <span className="font-mono font-bold text-sm text-blue-600 bg-white border border-blue-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
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
              className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
            />

            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0% (Not Started)</span>
              <span>50% (Underway)</span>
              <span>100% (Completed)</span>
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Execution Lifecycle Status
            </label>
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-hidden font-medium bg-white"
            >
              <option value="ACCEPTED">ACCEPTED — Queued / Not Started</option>
              <option value="IN_PROGRESS">IN_PROGRESS — Actively Working</option>
              <option value="ON_HOLD">ON_HOLD — Blocked / Paused</option>
              <option value="AWAITING_VERIFICATION">AWAITING_VERIFICATION — Submitted for Review</option>

              {/* Statuses restricted to Authorities / Assigner */}
              {isAuthority && (
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
            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-purple-900 flex items-start gap-2">
              <ShieldCheck size={16} className="text-purple-600 shrink-0 mt-0.5" />
              <div className="text-[11px]">
                <strong>Verification Required:</strong> When set to 100%, this task transitions to <strong>AWAITING_VERIFICATION</strong> and will await final sign-off by supervisory management[cite: 4, 15].
              </div>
            </div>
          )}

          {/* Audit Remarks */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Audit Remarks & Progress Notes (Immutable Log)
            </label>
            <textarea
              rows="3"
              placeholder="e.g. Completed initial mockups, submitted draft for internal review..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-hidden bg-slate-50/40"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Updating...' : 'Save & Record Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}