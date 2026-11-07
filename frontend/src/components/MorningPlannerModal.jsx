// frontend/src/components/MorningPlannerModal.jsx

import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  CheckSquare, 
  AlertTriangle, 
  AlertCircle, 
  X, 
  Layers,
  Sparkles
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
        return 'bg-rose-950/60 text-rose-300 border-rose-500/40 font-bold';
      case 'HIGH':
        return 'bg-amber-500/15 text-amber-300 border-amber-400/50 font-semibold';
      case 'MEDIUM':
        return 'bg-amber-950/40 text-amber-300/90 border-amber-500/30';
      default:
        return 'bg-neutral-800 text-neutral-300 border-neutral-700/60';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 transition-all font-sans">
      <div className="bg-[#141518] rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_25px_rgba(245,158,11,0.12)] border border-amber-500/25 max-h-[92vh] sm:max-h-[90vh] flex flex-col text-neutral-200">
        
        {/* Header */}
        <div className="flex justify-between items-start pb-3.5 border-b border-amber-500/20 mb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/25 flex items-center justify-center shrink-0">
              <Calendar size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                Morning Daily Planner
              </h3>
              <p className="text-[11px] text-amber-400/70 font-mono">
                Select the tasks you commit to work on during today's shift
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-amber-300 rounded-lg transition border border-transparent hover:border-amber-500/20 cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Duty Warning (If Off-Duty) */}
        {!isOnDuty && (
          <div className="mb-3 p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2 shrink-0 shadow-[0_0_10px_rgba(244,63,94,0.1)]">
            <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-rose-200">Currently On Leave:</strong> You must toggle your attendance to <strong className="text-amber-400">Present</strong> on the top navigation bar to activate and save today's work commitments.
            </span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-3 p-3 bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-start gap-2 shrink-0">
            <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Idle Warning if 0 tasks checked */}
        {isOnDuty && selectedIds.length === 0 && availableTasks.length > 0 && (
          <div className="mb-3 p-3 bg-amber-950/30 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center gap-2 shrink-0">
            <AlertTriangle size={16} className="text-amber-400 shrink-0" />
            <span>
              Selecting <strong className="text-amber-200 font-mono">0 tasks</strong> will mark you as <strong className="text-rose-400 font-bold">IDLE</strong> on supervisory team dashboards.
            </span>
          </div>
        )}

        {/* Action / Select-All Bar */}
        {availableTasks.length > 0 && (
          <div className="flex items-center justify-between pb-2 text-xs text-neutral-400 shrink-0 font-mono">
            <span>
              <strong className="text-amber-300">{selectedIds.length}</strong> of {availableTasks.length} tasks committed
            </span>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-amber-400 hover:text-amber-300 font-semibold text-[11px] transition cursor-pointer hover:underline"
            >
              {selectedIds.length === availableTasks.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        )}

        {/* Task Pool List with Hidden Scrollbars */}
        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden space-y-2 py-1 pr-0.5 min-h-[160px] max-h-72">
          {loading ? (
            <div className="text-xs text-amber-400/70 font-mono italic text-center py-10 animate-pulse">
              Loading active tasks from backlog...
            </div>
          ) : availableTasks.length === 0 ? (
            <div className="text-xs text-neutral-400 text-center py-10 border border-dashed border-amber-500/20 rounded-xl p-4 bg-[#0b0c0e]">
              <Layers size={24} className="mx-auto text-amber-400/40 mb-2" />
              <p className="font-semibold text-white">No Eligible Tasks Found</p>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Only non-overdue tasks in <strong className="text-neutral-400">ACCEPTED</strong>, <strong className="text-neutral-400">IN_PROGRESS</strong>, or <strong className="text-neutral-400">ON_HOLD</strong> state can be committed.
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
                      ? 'bg-amber-500/10 border-amber-400/60 shadow-[0_0_15px_rgba(245,158,11,0.12)]'
                      : 'bg-[#0b0c0e] border-amber-500/15 hover:bg-[#1a1c22]/70 hover:border-amber-500/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // Handled by container click
                      className="rounded accent-amber-500 h-4 w-4 shrink-0 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {t.title}
                      </div>
                      <div className="text-[10px] text-neutral-400 flex flex-wrap items-center gap-2 mt-0.5 font-mono">
                        <span className={`px-1.5 py-0.2 rounded border uppercase ${getPriorityStyle(t.priority)}`}>
                          {t.priority}
                        </span>
                        <span>Progress: <strong className="text-amber-300">{t.progress_percentage}%</strong></span>
                        {t.due_date && <span>Due: {t.due_date}</span>}
                      </div>
                    </div>
                  </div>

                  <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded border border-neutral-700 bg-neutral-900 text-neutral-400 shrink-0">
                    {t.status}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end pt-3 border-t border-amber-500/15 mt-3 shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isOnDuty}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-bold text-xs rounded-xl transition shadow-[0_0_15px_rgba(245,158,11,0.25)] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Sparkles size={14} />
            {saving ? 'Saving...' : `Save Commitments (${selectedIds.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}