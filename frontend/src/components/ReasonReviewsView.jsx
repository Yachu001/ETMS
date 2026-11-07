// frontend/src/components/ReasonReviewsView.jsx

import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
  Calendar,
  MessageSquare,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';

export default function ReasonReviewsView({ currentUser }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING_REVIEW');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Action modal state
  const [activeItem, setActiveItem] = useState(null);
  const [actionType, setActionType] = useState('RESCHEDULE'); // 'RESCHEDULE' | 'CANCEL' | 'VERIFY'
  const [newDueDate, setNewDueDate] = useState('');
  const [reviewerRemarks, setReviewerRemarks] = useState('');
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (typeFilter !== 'ALL') params.form_type = typeFilter;

      const res = await api.get('/tasks/reason-reviews/', { params });
      setSubmissions(res.data);
    } catch (err) {
      console.error('Failed to load reason reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [statusFilter, typeFilter]);

  const handleOpenActionModal = (item, type) => {
    setActiveItem(item);
    setActionType(type);
    setNewDueDate(item.expected_due_date || todayStr);
    setReviewerRemarks('');
    setErrorMsg(null);
  };

  const handleExecuteAction = async (e) => {
    e.preventDefault();
    if (actionType === 'RESCHEDULE' && (!newDueDate || newDueDate < todayStr)) {
      setErrorMsg('Please select a valid future due date.');
      return;
    }

    setProcessing(true);
    setErrorMsg(null);

    try {
      await api.post(`/tasks/reason-reviews/${activeItem.id}/action/`, {
        action: actionType,
        new_due_date: actionType === 'RESCHEDULE' ? newDueDate : undefined,
        remarks: reviewerRemarks.trim(),
      });
      setActiveItem(null);
      fetchSubmissions();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to submit review action.');
    } finally {
      setProcessing(false);
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return { date: '—', time: '' };
    const d = new Date(dateStr);
    return {
      date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const formTypeBadges = {
    OVERDUE_DELAY: { label: 'Overdue Delay', style: 'bg-rose-950/40 text-rose-400 border-rose-500/30' },
    REJECTION: { label: 'Assignment Rejected', style: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
    NO_ACTION_TODAY: { label: 'Daily No-Action', style: 'bg-[#181510] text-amber-200 border-amber-500/30' },
    AUTO_UNSUBMITTED: { label: 'Auto Trigger: Inaction', style: 'bg-red-950/50 text-red-400 border-red-500/40' },
  };

  const statusBadges = {
    PENDING_REVIEW: 'bg-amber-500/15 text-amber-300 border-amber-400/50 shadow-[0_0_10px_rgba(245,158,11,0.15)]',
    RESCHEDULED: 'bg-[#181510] text-amber-200 border-amber-500/30',
    CANCELLED: 'bg-neutral-900 text-neutral-400 border-neutral-800',
    VERIFIED: 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30',
  };

  return (
    <div className="space-y-4 text-neutral-200">
      {/* Top Filter and Header Bar */}
      <div className="bg-[#0b0c0e] p-5 rounded-3xl border border-amber-400/50 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_20px_rgba(245,158,11,0.12)] flex flex-wrap justify-between items-center gap-4 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <h2 className="text-base font-bold text-white flex items-center gap-2.5 tracking-wide">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1c1917] via-[#161412] to-[#0a0a0a] text-amber-300 border border-amber-400/40 flex items-center justify-center shadow-xs">
              <MessageSquare size={16} className="text-amber-400" />
            </div>
            Reason Submissions & Authority Review Hub
          </h2>
          <p className="text-xs text-amber-200/50 mt-1">
            Review overdue task delay reports, assignment rejections, and daily commitment inaction logs.
          </p>
        </div>

        <div className="flex items-center gap-2.5 text-xs relative z-10">
          <div className="flex items-center gap-1.5 bg-[#141518] border border-amber-500/30 px-3 py-1.5 rounded-xl shadow-xs">
            <Filter size={13} className="text-amber-400/80" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent font-medium text-amber-200 focus:outline-none cursor-pointer"
            >
              <option value="PENDING_REVIEW" className="bg-[#0b0c0e] text-neutral-200">Pending Review</option>
              <option value="RESCHEDULED" className="bg-[#0b0c0e] text-neutral-200">Rescheduled</option>
              <option value="CANCELLED" className="bg-[#0b0c0e] text-neutral-200">Cancelled</option>
              <option value="VERIFIED" className="bg-[#0b0c0e] text-neutral-200">Verified / Acknowledged</option>
              <option value="ALL" className="bg-[#0b0c0e] text-neutral-200">All Statuses</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-[#141518] border border-amber-500/30 px-3 py-1.5 rounded-xl shadow-xs">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent font-medium text-amber-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-[#0b0c0e] text-neutral-200">All Form Types</option>
              <option value="OVERDUE_DELAY" className="bg-[#0b0c0e] text-neutral-200">Overdue Delay Reports</option>
              <option value="REJECTION" className="bg-[#0b0c0e] text-neutral-200">Task Assignment Rejections</option>
              <option value="NO_ACTION_TODAY" className="bg-[#0b0c0e] text-neutral-200">Daily Commit Inaction</option>
              <option value="AUTO_UNSUBMITTED" className="bg-[#0b0c0e] text-neutral-200">Auto Incident Flags</option>
            </select>
          </div>

          <button
            type="button"
            onClick={fetchSubmissions}
            className="p-2 text-amber-300 hover:text-white bg-[#141518] hover:bg-amber-500/15 border border-amber-500/30 rounded-xl transition cursor-pointer shadow-xs"
            title="Refresh submissions"
          >
            <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Submissions Roster */}
      <div className="bg-[#0b0c0e] rounded-3xl border border-amber-400/40 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_20px_rgba(245,158,11,0.1)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#141518] border-b border-amber-500/20 text-amber-400/80 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3.5 px-4">Task & Form Type</th>
                <th className="py-3.5 px-3">Submitted By</th>
                <th className="py-3.5 px-3">Reason Category</th>
                <th className="py-3.5 px-4">Explanation & Notes</th>
                <th className="py-3.5 px-3">Proposed Date</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-4 text-right">Authority Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-amber-200/50">
                    Loading submissions queue...
                  </td>
                </tr>
              ) : submissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    No submissions found for the selected filters.
                  </td>
                </tr>
              ) : (
                submissions.map((item) => {
                  const typeBadge = formTypeBadges[item.form_type] || {
                    label: item.form_type,
                    style: 'bg-neutral-900 text-neutral-400 border-neutral-800',
                  };
                  const createdDT = formatDateTime(item.created_at);
                  const isPending = item.status === 'PENDING_REVIEW';

                  return (
                    <tr key={item.id} className="hover:bg-amber-500/[0.03] transition duration-150">
                      {/* Task Title & Form Type */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white tracking-wide">{item.task_title}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border tracking-wider uppercase ${typeBadge.style}`}
                          >
                            {typeBadge.label}
                          </span>
                          <span className="text-[10px] text-amber-200/50 font-mono">
                            Task #{item.task_id} ({item.task_current_progress}%)
                          </span>
                        </div>
                      </td>

                      {/* Submitted By */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="font-medium text-neutral-100">{item.submitted_by_name}</div>
                        <div className="text-[10px] text-neutral-400 font-mono leading-tight mt-0.5">
                          <div>{createdDT.date}</div>
                          <div className="text-amber-200/50">{createdDT.time}</div>
                        </div>
                      </td>

                      {/* Reason Category */}
                      <td className="py-3.5 px-3">
                        <span className="font-semibold text-neutral-200 bg-[#141518] px-2.5 py-1 rounded-xl text-[11px] border border-amber-500/25">
                          {item.reason_category}
                        </span>
                      </td>

                      {/* Explanation */}
                      <td className="py-3.5 px-4 max-w-[260px]">
                        <p className="text-neutral-300 whitespace-pre-wrap line-clamp-2" title={item.explanation}>
                          {item.explanation || '—'}
                        </p>
                        {item.reviewer_remarks && (
                          <div className="text-[10px] text-amber-200/60 mt-1 italic">
                            Reviewed by {item.reviewed_by_name}: "{item.reviewer_remarks}"
                          </div>
                        )}
                      </td>

                      {/* Expected / Proposed Date */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {item.expected_due_date ? (
                          <div className="font-medium text-neutral-200 flex items-center gap-1.5 font-mono">
                            <Calendar size={12} className="text-amber-400" />
                            {item.expected_due_date}
                          </div>
                        ) : (
                          <span className="text-neutral-500">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                            statusBadges[item.status] || 'bg-neutral-900 text-neutral-400 border-neutral-800'
                          }`}
                        >
                          {item.status?.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-2">
                            {item.form_type === 'OVERDUE_DELAY' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenActionModal(item, 'RESCHEDULE')}
                                  className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-xl text-[11px] font-semibold transition cursor-pointer shadow-[0_0_12px_rgba(212,175,55,0.25)]"
                                >
                                  Reschedule
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenActionModal(item, 'CANCEL')}
                                  className="px-3 py-1.5 bg-rose-950/40 text-rose-400 hover:bg-rose-900/60 border border-rose-500/40 rounded-xl text-[11px] font-semibold transition cursor-pointer"
                                >
                                  Cancel Task
                                </button>
                              </>
                            ) : item.form_type === 'REJECTION' ? (
                              <button
                                type="button"
                                onClick={() => handleOpenActionModal(item, 'VERIFY')}
                                className="px-3.5 py-1.5 bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-500/40 rounded-xl text-[11px] font-semibold transition cursor-pointer"
                              >
                                Acknowledge
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenActionModal(item, 'VERIFY')}
                                className="px-3.5 py-1.5 bg-[#141518] hover:bg-[#1a1c22] text-amber-300 border border-amber-500/30 rounded-xl text-[11px] font-semibold transition cursor-pointer"
                              >
                                Sign Off
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-neutral-500 font-medium">Completed</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reviewer Action Modal */}
      {activeItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[#0b0c0e] rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_35px_rgba(212,175,55,0.12)] max-w-md w-full p-6 border border-amber-400/50 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-amber-500/20 pb-3.5">
              <div className="flex items-center gap-2 font-bold text-sm text-white tracking-wide">
                {actionType === 'RESCHEDULE' ? (
                  <>
                    <Calendar size={18} className="text-amber-400" /> Reschedule Task Due Date
                  </>
                ) : actionType === 'CANCEL' ? (
                  <>
                    <XCircle size={18} className="text-rose-400" /> Cancel Task Confirmation
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} className="text-emerald-400" /> Acknowledge Submission
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveItem(null)}
                className="text-neutral-400 hover:text-amber-300 transition text-base font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleExecuteAction} className="space-y-4">
              <div>
                <label className="block font-semibold text-amber-300/90 mb-1.5 tracking-wide">Target Task</label>
                <input
                  type="text"
                  readOnly
                  value={activeItem.task_title}
                  className="w-full bg-[#141518] border border-amber-500/20 rounded-xl p-2.5 text-neutral-300 cursor-not-allowed font-medium"
                />
              </div>

              {actionType === 'RESCHEDULE' && (
                <div>
                  <label className="block font-semibold text-amber-300/90 mb-1.5 tracking-wide">
                    New Due Date (Rescheduled) *
                  </label>
                  <input
                    type="date"
                    min={todayStr}
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full bg-[#0b0c0e] border border-amber-500/30 rounded-xl p-2.5 text-white font-mono focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none transition"
                  />
                  <p className="text-[10px] text-neutral-400 mt-1">
                    Employee proposed date: <span className="text-amber-300">{activeItem.expected_due_date || 'None'}</span>
                  </p>
                </div>
              )}

              <div>
                <label className="block font-semibold text-amber-300/90 mb-1.5 tracking-wide">Authority Remarks / Instructions</label>
                <textarea
                  rows="3"
                  value={reviewerRemarks}
                  onChange={(e) => setReviewerRemarks(e.target.value)}
                  placeholder="Provide instructions or justification for the employee..."
                  className="w-full bg-[#0b0c0e] border border-amber-500/30 rounded-xl p-2.5 text-white placeholder:text-neutral-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none transition"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3.5 border-t border-amber-500/20">
                <button
                  type="button"
                  onClick={() => setActiveItem(null)}
                  className="px-4 py-2 border border-amber-500/30 rounded-xl text-neutral-300 hover:text-white hover:bg-[#141518] font-medium transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className={`font-semibold px-5 py-2 rounded-xl transition duration-150 cursor-pointer disabled:opacity-50 ${
                    actionType === 'CANCEL'
                      ? 'bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
                      : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-[0_0_15px_rgba(212,175,55,0.25)]'
                  }`}
                >
                  {processing ? 'Processing...' : `Confirm ${actionType}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}