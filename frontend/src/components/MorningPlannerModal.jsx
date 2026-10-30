import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  CheckSquare, 
  AlertTriangle, 
  AlertCircle, 
  X, 
  Clock, 
  Layers 
} from 'lucide-react';
import api from '../api/axios';

export default function MorningPlannerModal({ isOpen, onClose, onCommitmentsUpdated }) {
  const [availableTasks, setAvailableTasks] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isOnDuty, setIsOnDuty] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(null);
      api.get('/tasks/daily-commitments/')
        .then((res) => {
          setAvailableTasks(res.data.available_tasks || []);
          setSelectedIds(res.data.selected_task_ids || []);
          setIsOnDuty(Boolean(res.data.is_on_duty));
        })
        .catch((err) => {
          console.error('Failed to load daily planner pool:', err);
          setError('Failed to fetch active tasks. Please check your network.');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === availableTasks.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(availableTasks.map((t) => t.id));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post('/tasks/daily-commitments/', { task_ids: selectedIds });
      if (onCommitmentsUpdated) onCommitmentsUpdated();
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail 
        || JSON.stringify(err.response?.data) 
        || 'Failed to commit daily tasks.';
      setError(detail);
    } finally {
      setSaving(false);
    }
  };

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
      case 'HIGH':
        return 'bg-amber-50 text-amber-800 border-amber-200 font-semibold';
      case 'MEDIUM':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-slate-100 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-start pb-3 border-b border-slate-100 mb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
              <Calendar size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Morning Daily Planner
              </h3>
              <p className="text-[11px] text-slate-400">
                Select the tasks you commit to work on during today's shift
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Duty Warning (If Off-Duty) */}
        {!isOnDuty && (
          <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2 shrink-0">
            <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
            <span>
              <strong>Currently On Leave:</strong> You must toggle your attendance to <strong>Present</strong> on the top navigation bar to activate and save today's work commitments[cite: 1, 6, 14].
            </span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2 shrink-0">
            <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Idle Warning if 0 tasks checked */}
        {isOnDuty && selectedIds.length === 0 && availableTasks.length > 0 && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2 shrink-0">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <span>
              Selecting <strong>0 tasks</strong> will mark you as <strong>IDLE</strong> on supervisory team dashboards[cite: 14, 15, 18].
            </span>
          </div>
        )}

        {/* Action / Select-All Bar */}
        {availableTasks.length > 0 && (
          <div className="flex items-center justify-between pb-2 text-xs text-slate-500 shrink-0">
            <span>
              <strong>{selectedIds.length}</strong> of {availableTasks.length} tasks committed
            </span>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-blue-600 hover:text-blue-800 font-semibold text-[11px] cursor-pointer"
            >
              {selectedIds.length === availableTasks.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        )}

        {/* Task Pool List */}
        <div className="flex-1 overflow-y-auto space-y-2 py-1 pr-0.5 min-h-[160px] max-h-72">
          {loading ? (
            <div className="text-xs text-slate-400 text-center py-10">
              Loading active tasks from backlog...
            </div>
          ) : availableTasks.length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-10 border border-dashed border-slate-200 rounded-xl p-4">
              <Layers size={24} className="mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600">No Eligible Tasks Found</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Only non-overdue tasks in <strong>ACCEPTED</strong>, <strong>IN_PROGRESS</strong>, or <strong>ON_HOLD</strong> state can be committed[cite: 1, 6].
              </p>
            </div>
          ) : (
            availableTasks.map((t) => {
              const isChecked = selectedIds.includes(t.id);
              return (
                <div
                  key={t.id}
                  onClick={() => toggleSelect(t.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                    isChecked
                      ? 'bg-blue-50/70 border-blue-300 shadow-2xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // Handled by container click
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 shrink-0 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">
                        {t.title}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className={`px-1.5 py-0.2 rounded border ${getPriorityStyle(t.priority)}`}>
                          {t.priority}
                        </span>
                        <span>Progress: <strong>{t.progress_percentage}%</strong></span>
                        {t.due_date && <span>Due: {t.due_date}</span>}
                      </div>
                    </div>
                  </div>

                  <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded border bg-slate-100 text-slate-600 shrink-0">
                    {t.status}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isOnDuty}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Saving...' : `Save Commitments (${selectedIds.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}