import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { X, Sliders, AlertCircle, Save } from 'lucide-react';

export default function TaskActionModal({ isOpen, onClose, task, onActionSuccess, currentUser }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('ACCEPTED');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Normalize taskId to ensure we never query with a selection_id
  const targetTaskId = task?.task_id || task?.id;

  useEffect(() => {
    if (task && isOpen) {
      setProgress(task.progress_percentage || 0);
      setStatus(task.status || 'ACCEPTED');
      setRemarks('');
      setError(null);
    }
  }, [task, isOpen]);

  if (!isOpen || !task) return null;

  const handleProgressSlider = (val) => {
    const num = parseInt(val, 10);
    setProgress(num);

    if (status !== 'ON_HOLD') {
      if (num === 0) {
        setStatus('ACCEPTED');
      } else if (num > 0 && num < 100) {
        setStatus('IN_PROGRESS');
      } else if (num === 100) {
        if (task.requires_verification) {
          setStatus('AWAITING_VERIFICATION');
        } else {
          setStatus('VERIFIED');
        }
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.post(`/tasks/${targetTaskId}/action/`, {
        action: 'UPDATE_PROGRESS',
        progress_percentage: progress,
        status: status,
        remarks: remarks.trim()
      });
      if (onActionSuccess) onActionSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to update task.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-5">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="text-blue-600" size={18} />
            <h3 className="font-bold text-slate-900 text-base">Update Task Progress & Status</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="font-bold text-slate-900 text-sm">{task.title}</div>
            <div className="text-slate-500 text-[11px] mt-0.5">
              Assigned by: <strong>{task.created_by_name || 'Self'}</strong> • Priority: <strong>{task.priority}</strong>
            </div>
          </div>

          {/* Progress Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="font-semibold text-slate-700">Completion Percentage</label>
              <span className="font-mono font-bold text-sm text-blue-600">{progress}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={progress}
              onChange={(e) => handleProgressSlider(e.target.value)}
              className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0% (Not Started)</span>
              <span>50%</span>
              <span>100% (Complete)</span>
            </div>
          </div>

          {/* Status Selection */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 font-medium outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ACCEPTED">Not Started</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="ON_HOLD">On Hold</option>
                {progress === 100 && (
                  <>
                    <option value="AWAITING_VERIFICATION">Awaiting Verification</option>
                    <option value="VERIFIED">Verified / Completed</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Hold Control</label>
              <button
                type="button"
                onClick={() => {
                  if (status === 'ON_HOLD') {
                    handleProgressSlider(progress);
                  } else {
                    setStatus('ON_HOLD');
                  }
                }}
                className={`w-full py-2 px-3 rounded-lg font-semibold transition border ${
                  status === 'ON_HOLD'
                    ? 'bg-rose-50 text-rose-700 border-rose-300'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {status === 'ON_HOLD' ? 'Resume In-Progress' : 'Set On Hold'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Remarks & Activity Notes</label>
            <textarea
              rows="3"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add details regarding this progress change..."
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition disabled:opacity-50 shadow-xs"
            >
              <Save size={14} />
              {loading ? 'Saving Changes...' : 'Save Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}