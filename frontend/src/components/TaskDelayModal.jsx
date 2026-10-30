import React, { useState } from 'react';
import api from '../api/axios';
import { AlertTriangle, X } from 'lucide-react';

export default function TaskDelayModal({ isOpen, onClose, task, onSuccess }) {
  if (!isOpen || !task) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const [reasonCategory, setReasonCategory] = useState('TECHNICAL_BLOCKER');
  const [expectedDueDate, setExpectedDueDate] = useState('');
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!expectedDueDate || expectedDueDate < todayStr) {
      setError('Please select a valid future expected completion date.');
      return;
    }
    if (!explanation.trim()) {
      setError('Please provide an explanation of the delay.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.post(`/tasks/${task.id}/delay-report/`, {
        reason_category: reasonCategory,
        expected_due_date: expectedDueDate,
        explanation: explanation.trim()
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit overdue delay form.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
            <AlertTriangle size={18} /> Task Overdue Delay Form
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-[11px] text-rose-800">
          This task is overdue. Standard progress updates are locked until you submit an explanation and your reporting authority reviews and reschedules the due date.
        </div>

        {error && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Task Title</label>
            <input
              type="text"
              readOnly
              value={task.title}
              className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 text-slate-600 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Delay Reason Category *</label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800"
            >
              <option value="TECHNICAL_BLOCKER">Technical Blocker / Infrastructure Issue</option>
              <option value="CLIENT_DEPENDENCY">Pending Client / External Dependency</option>
              <option value="WORKLOAD_CAPACITY">Capacity Overload / Higher Priority Work</option>
              <option value="SCOPE_CREEP">Scope Creep / Requirement Changes</option>
              <option value="OTHER">Other Operational Delay</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Expected Completion Date *</label>
            <input
              type="date"
              min={todayStr}
              required
              value={expectedDueDate}
              onChange={(e) => setExpectedDueDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Explanation & Blockers *</label>
            <textarea
              required
              rows="3"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Explain the reasons for the deadline breach..."
              className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-rose-600 hover:bg-rose-700 text-white font-medium px-4 py-1.5 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Overdue Reason'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}