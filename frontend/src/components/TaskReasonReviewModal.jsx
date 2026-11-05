// frontend/src/components/TaskReasonReviewModal.jsx

import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { 
  X, 
  CalendarClock, 
  AlertTriangle, 
  CheckCircle2, 
  Ban, 
  FileText, 
  User, 
  Clock 
} from 'lucide-react';

export default function TaskReasonReviewModal({
  isOpen,
  submission,
  onClose,
  onSuccess
}) {
  const [newDueDate, setNewDueDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && submission) {
      setError(null);
      setRemarks('');
      setNewDueDate(submission.expected_due_date || '');
    }
  }, [isOpen, submission]);

  if (!isOpen || !submission) return null;

  const handleAction = async (actionType) => {
    setError(null);

    if (actionType === 'RESCHEDULE' && !newDueDate) {
      setError('Please choose a valid new due date to reschedule.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/tasks/reason-reviews/${submission.id}/action/`, {
        action: actionType,
        new_due_date: actionType === 'RESCHEDULE' ? newDueDate : undefined,
        remarks: remarks.trim()
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail 
        || JSON.stringify(err.response?.data) 
        || `Failed to ${actionType.toLowerCase()} task.`;
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-bold">
              <CalendarClock size={16} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Review Overdue Delay Submission</h3>
              <p className="text-[11px] text-slate-400">
                Inspect employee justification and reschedule or cancel the task
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

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Task & Submitter Overview */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Task Details
              </span>
              <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
                Task #{submission.task_id || submission.task}
              </span>
            </div>
            <div className="font-bold text-slate-900 text-sm">
              {submission.task_title || submission.title}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">Submitted By</span>
                <span className="font-semibold text-slate-700 flex items-center gap-1 mt-0.5">
                  <User size={12} className="text-slate-400" />
                  {submission.submitted_by_name || 'Staff Member'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Current Due Date</span>
                <span className="font-mono text-slate-700 mt-0.5 block">
                  {submission.task_current_due_date || 'No Date Set'}
                </span>
              </div>
            </div>
          </div>

          {/* Submitted Reason Category & Explanation */}
          <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 text-[11px] uppercase tracking-wider">
              <FileText size={13} className="text-amber-700" />
              Employee Stated Delay Reason
            </div>
            
            <div>
              <span className="text-[10px] text-amber-800 font-semibold block">Category:</span>
              <span className="font-medium text-slate-800">
                {submission.reason_category?.replace('_', ' ') || 'General Delay'}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-amber-800 font-semibold block">Detailed Explanation:</span>
              <p className="whitespace-pre-wrap leading-relaxed text-slate-700 bg-white/80 p-2.5 rounded-lg border border-amber-100 mt-1">
                {submission.explanation || 'No detailed remarks provided.'}
              </p>
            </div>
          </div>

          {/* Action Formulation: Reschedule New Due Date */}
          <div className="space-y-3 pt-1">
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Reschedule Target Date (New Due Date)</span>
                {submission.expected_due_date && (
                  <span className="text-[10px] text-blue-600 font-normal">
                    Proposed: {submission.expected_due_date}
                  </span>
                )}
              </label>
              <input
                type="date"
                min={todayStr}
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Manager Review Remarks (Optional)
              </label>
              <textarea
                rows="2"
                placeholder="Add review notes, instructions, or resolution remarks..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleAction('CANCEL')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-semibold transition cursor-pointer disabled:opacity-50"
          >
            <Ban size={14} /> Cancel Task
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-3.5 py-2 border border-slate-300 rounded-xl text-slate-600 hover:bg-white transition cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleAction('RESCHEDULE')}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 size={14} /> Reschedule Task
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}