import React, { useState } from 'react';
import api from '../api/axios';
import { X, AlertCircle } from 'lucide-react';

export default function TaskRejectModal({ isOpen, onClose, task, onRejectSuccess }) {
  if (!isOpen || !task) return null;

  const [reason, setReason] = useState('BANDWIDTH');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!remarks.trim()) {
      setError('Remarks are mandatory when declining a task assignment.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.post(`/tasks/${task.id}/action/`, {
        action: 'REJECT',
        rejection_reason: reason,
        rejection_remarks: remarks.trim()
      });
      if (onRejectSuccess) onRejectSuccess(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject task assignment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
            <AlertCircle size={16} /> Decline Task Assignment
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reason Category *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800"
            >
              <option value="BANDWIDTH">Workload overload / Capacity full</option>
              <option value="TERRITORY">Not in my territory / Wrong department</option>
              <option value="UNCLEAR">Lacks required specs / Unclear resources</option>
              <option value="OTHER">Other (See remarks)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Justification Remarks *</label>
            <textarea
              required
              rows="3"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="State why this assignment is declined (audited & sent to assigner)..."
              className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-rose-600 hover:bg-rose-700 text-white font-medium px-4 py-1.5 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Declining...' : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}