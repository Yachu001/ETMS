// frontend/src/components/MorningPlannerModal.jsx

import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  AlertTriangle, 
  AlertCircle, 
  X, 
  Layers,
  Sparkles
} from 'lucide-react';
import api from '../api/axios';

export default function MorningPlannerModal({ 
  isOpen, 
  onClose, 
  onCommitmentsUpdated, 
  onCommitmentSaved 
}) {
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
      if (onCommitmentSaved) onCommitmentSaved();
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
        return 'bg-amber-50 text-amber-700 border-amber-200 font-semibold';
      case 'MEDIUM':
        return 'bg-sky-50 text-sky-700 border-sky-200 font-medium';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4 transition-all font-sans">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-[0_24px_50px_rgba(15,23,42,0.16)] border border-slate-200/90 max-h-[92vh] sm:max-h-[90vh] flex flex-col text-slate-800">
        
        {/* Header */}
        <div className="flex justify-between items-start pb-3.5 border-b border-slate-100 mb-3.5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center shrink-0 shadow-2xs">
              <Calendar size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-wide">
                Morning Daily Planner
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Select the tasks you commit to work on during today's shift
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Duty Warning (If Off-Duty) */}
        {!isOnDuty && (
          <div className="mb-3 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-2 shrink-0">
            <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <span>
              <strong className="text-rose-800">Currently On Leave:</strong> You must toggle your attendance to <strong className="text-blue-700">Present</strong> on the top navigation bar to activate and save today's work commitments.
            </span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-3 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-start gap-2 shrink-0 font-medium">
            <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Idle Warning if 0 tasks checked */}
        {isOnDuty && selectedIds.length === 0 && availableTasks.length > 0 && (
          <div className="mb-3 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-center gap-2 shrink-0">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <span>
              Selecting <strong className="font-mono font-bold">0 tasks</strong> will mark you as <strong className="text-rose-600 font-bold">IDLE</strong> on supervisory team dashboards.
            </span>
          </div>
        )}

        {/* Action / Select-All Bar */}
        {availableTasks.length > 0 && (
          <div className="flex items-center justify-between pb-2.5 text-xs text-slate-500 shrink-0 font-mono">
            <span>
              <strong className="text-blue-700 font-bold">{selectedIds.length}</strong> of {availableTasks.length} tasks committed
            </span>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-blue-600 hover:text-blue-800 font-sans font-semibold text-[11px] transition cursor-pointer hover:underline"
            >
              {selectedIds.length === availableTasks.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        )}

        {/* Task Pool List with Hidden Scrollbars */}
        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden space-y-2 py-1 pr-0.5 min-h-[160px] max-h-72">
          {loading ? (
            <div className="text-xs text-blue-600 font-mono font-semibold text-center py-10 animate-pulse">
              Loading active tasks from backlog...
            </div>
          ) : availableTasks.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-10 border border-dashed border-slate-200 rounded-2xl p-4 bg-slate-50/70">
              <Layers size={24} className="mx-auto text-slate-400 mb-2" />
              <p className="font-bold text-slate-800">No Eligible Tasks Found</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Only non-overdue tasks in <strong className="text-slate-700">ACCEPTED</strong>, <strong className="text-slate-700">IN_PROGRESS</strong>, or <strong className="text-slate-700">ON_HOLD</strong> state can be committed.
              </p>
            </div>
          ) : (
            availableTasks.map((t) => {
              const isChecked = selectedIds.includes(t.id);
              return (
                <div
                  key={t.id}
                  onClick={() => toggleSelect(t.id)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                    isChecked
                      ? 'bg-blue-50/80 border-blue-300 shadow-[0_3px_12px_rgba(37,99,235,0.08)]'
                      : 'bg-slate-50/60 border-slate-200/80 hover:bg-white hover:border-blue-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // Handled by container click
                      className="rounded accent-blue-600 h-4 w-4 shrink-0 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {t.title}
                      </div>
                      <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-2 mt-1 font-mono">
                        <span className={`px-2 py-0.2 rounded-md border uppercase ${getPriorityStyle(t.priority)}`}>
                          {t.priority}
                        </span>
                        <span>Progress: <strong className="text-blue-700 font-bold">{t.progress_percentage}%</strong></span>
                        {t.due_date && <span>Due: {t.due_date}</span>}
                      </div>
                    </div>
                  </div>

                  <span className="text-[9px] uppercase font-mono font-semibold px-2.5 py-0.5 rounded-lg border border-slate-200 bg-white text-slate-600 shrink-0">
                    {t.status}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end pt-3.5 border-t border-slate-100 mt-3 shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isOnDuty}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold text-xs rounded-xl transition shadow-[0_4px_14px_rgba(37,99,235,0.28)] hover:shadow-[0_6px_18px_rgba(37,99,235,0.38)] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Sparkles size={14} />
            {saving ? 'Saving...' : `Save Commitments (${selectedIds.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}