import React, { useState } from 'react';
import api from '../api/axios';
import { AlertTriangle, X, Send, Calendar, Clock } from 'lucide-react';

export default function TaskDelayModal({ isOpen, onClose, task, onReportSubmitted }) {
  const [reasonCategory, setReasonCategory] = useState('BLOCKER');
  const [explanation, setExplanation] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!expectedDate) {
      setError('Please select an expected completion date.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      await api.post(`/tasks/${task.id}/delay-report/`, {
        reason_category: reasonCategory,
        explanation: explanation.trim(),
        expected_completion_date: expectedDate,
      });
      if (onReportSubmitted) onReportSubmitted();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit delay report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-amber-600 font-bold text-base">
            <AlertTriangle size={18} />
            <span>Overdue Task Explanation</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={18} />
          </button>
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
          <div>
            The due date (<strong>{task.due_date}</strong>) for <strong>"{task.title}"</strong> has arrived or passed while still in progress ({task.progress_percentage}% complete).
          </div>
          <div className="text-[11px] text-amber-700">
            This explanation will be logged to the activity history and forwarded to your reporting authority[cite: 2, 7].
          </div>
        </div>

        {error && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Reason for Incomplete Status</label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="BLOCKER">External Dependency / Blocker</option>
              <option value="BANDWIDTH">Capacity Crunch / Urgent Task Interruption</option>
              <option value="SCOPE">Scope Expansion / Requirement Changes</option>
              <option value="TECHNICAL">Technical Roadblock / Bug</option>
              <option value="OTHER">Other Reason</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Expected Completion Date</label>
            <input
              type="date"
              required
              min={new Date().toISOString().split('T')[0]}
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Detailed Explanation & Blockers</label>
            <textarea
              rows="3"
              required
              placeholder="Detail the root cause of delay and the current steps being taken to resolve it..."
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-2 rounded-lg transition disabled:opacity-50 shadow-xs"
            >
              <Send size={14} />
              {loading ? 'Filing Report...' : 'Submit to Authority'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}