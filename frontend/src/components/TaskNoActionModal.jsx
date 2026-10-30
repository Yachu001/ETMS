import React, { useState } from 'react';
import api from '../api/axios';
import { Clock, AlertTriangle, X } from 'lucide-react';

export default function TaskNoActionModal({ isOpen, onClose, task, remainingCount = 0, onSuccess }) {
  if (!isOpen || !task) return null;

  const [reasonCategory, setReasonCategory] = useState('INTERRUPTIONS');
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!explanation.trim()) {
      setError('Please provide an explanation of why no activity occurred today.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.post(`/tasks/${task.id}/no-action-reason/`, {
        reason_category: reasonCategory,
        explanation: explanation.trim(),
      });
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit no-action explanation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
            <Clock size={18} /> Shift-End Task Inactivity Form
          </div>
          {remainingCount > 1 && (
            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
              {remainingCount} tasks pending review
            </span>
          )}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-900">
          Your shift ends in less than 10 minutes. This committed task has not had any progress or status updates logged today. Please provide an explanation before leaving.
        </div>

        {error && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Committed Task</label>
            <input
              type="text"
              readOnly
              value={task.title}
              className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 text-slate-600 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reason for Inaction Today *</label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800"
            >
              <option value="INTERRUPTIONS">Higher Priority Interruption / Urgent Work</option>
              <option value="DEPENDENCY_BLOCKED">Blocked by External Dependency / Colleague</option>
              <option value="TECHNICAL_ISSUE">Environment / Infrastructure Downtime</option>
              <option value="ESTIMATION_OVERRUN">Previous Task Took Entire Working Hours</option>
              <option value="OTHER">Other Operational Delay</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Explanation & Context *</label>
            <textarea
              required
              rows="3"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Explain why progress was not updated and current status..."
              className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
            >
              Dismiss for Now
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-1.5 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Reason'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}