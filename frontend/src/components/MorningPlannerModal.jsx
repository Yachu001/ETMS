import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { CheckSquare, Calendar, X, AlertTriangle } from 'lucide-react';

export default function MorningPlannerModal({ isOpen, onClose, onCommitmentsUpdated }) {
  const [availableTasks, setAvailableTasks] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.get('/tasks/daily-commitments/')
        .then((res) => {
          setAvailableTasks(res.data.available_tasks);
          setSelectedIds(res.data.selected_task_ids);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Inside MorningPlannerModal.jsx:
const fetchDailyPlan = async () => {
  setLoading(true);
  try {
    const res = await api.get('/tasks/daily-commitments/');
    setAvailableTasks(res.data.available_tasks || []);
    // Safe array fallback prevents the white screen
    setSelectedIds(res.data.selected_task_ids || []);
  } catch (err) {
    console.error('Failed to load daily commitments', err);
  } finally {
    setLoading(false);
  }
};

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/tasks/daily-commitments/', { task_ids: selectedIds });
      if (onCommitmentsUpdated) onCommitmentsUpdated();
      onClose();
    } catch (err) {
      alert('Failed to save daily commitments.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
              <Calendar size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Morning Daily Planner</h3>
              <p className="text-[11px] text-slate-400">Select the tasks you commit to work on today</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Warning if no tasks checked */}
        {selectedIds.length === 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-600 shrink-0" />
            <span>If you select 0 tasks, your status will show as <strong>IDLE</strong> on supervisor dashboards.</span>
          </div>
        )}

        {/* Tasks Checklist */}
        <div className="max-h-64 overflow-y-auto space-y-2 py-1">
          {loading ? (
            <div className="text-xs text-slate-400 text-center py-6">Loading active tasks...</div>
          ) : availableTasks.length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-6">
              No accepted or in-progress tasks available. Create or accept a task first!
            </div>
          ) : (
            availableTasks.map((t) => {
              const isChecked = selectedIds.includes(t.id);
              return (
                <div
                  key={t.id}
                  onClick={() => toggleSelect(t.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    isChecked
                      ? 'bg-blue-50/70 border-blue-300'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // Controlled by div click
                      className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">{t.title}</div>
                      <div className="text-[10px] text-slate-400">
                        Priority: {t.priority} &bull; Progress: {t.progress_percentage}%
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded border bg-slate-100 text-slate-600">
                    {t.status}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-600 text-xs font-medium hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition disabled:opacity-50 shadow-xs"
          >
            {saving ? 'Saving...' : `Save Commitments (${selectedIds.length} Selected)`}
          </button>
        </div>
      </div>
    </div>
  );
}