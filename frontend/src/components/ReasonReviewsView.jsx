// frontend/src/components/ReasonReviewsView.jsx

import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import {
  CheckCircle2,
  XCircle,
  Filter,
  Calendar,
  MessageSquare,
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
    if (item.submitted_by_id === currentUser?.id) return;
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
    OVERDUE_DELAY: { label: 'Overdue Delay', style: 'bg-rose-50 text-rose-700 border-rose-200' },
    REJECTION: { label: 'Assignment Rejected', style: 'bg-amber-50 text-amber-700 border-amber-200' },
    NO_ACTION_TODAY: { label: 'Daily No-Action', style: 'bg-sky-50 text-sky-700 border-sky-200' },
    AUTO_UNSUBMITTED: { label: 'Auto Trigger: Inaction', style: 'bg-red-50 text-red-700 border-red-200' },
  };

  const statusBadges = {
    PENDING_REVIEW: 'bg-blue-50 text-blue-700 border-blue-200',
    RESCHEDULED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
    VERIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  return (
    <div className="space-y-4 text-slate-800">
      {/* Top Filter and Header Bar */}
      <div className="bg-white/95 backdrop-blur-md p-5 rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] flex flex-wrap justify-between items-center gap-4 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2.5 tracking-wide">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center shadow-2xs">
              <MessageSquare size={16} />
            </div>
            Reason Submissions & Authority Review Hub
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Review overdue task delay reports, assignment rejections, and daily commitment inaction logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs relative z-10">
          <div className="flex items-center gap-1.5 bg-slate-50/90 border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
            <Filter size={13} className="text-blue-600" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="RESCHEDULED">Rescheduled</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="VERIFIED">Verified / Acknowledged</option>
              <option value="ALL">All Statuses</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50/90 border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Form Types</option>
              <option value="OVERDUE_DELAY">Overdue Delay Reports</option>
              <option value="REJECTION">Task Assignment Rejections</option>
              <option value="NO_ACTION_TODAY">Daily Commit Inaction</option>
              <option value="AUTO_UNSUBMITTED">Auto Incident Flags</option>
            </select>
          </div>

          <button
            type="button"
            onClick={fetchSubmissions}
            className="p-2 text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl transition cursor-pointer shadow-2xs"
            title="Refresh submissions"
          >
            <RotateCcw size={14} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      {/* Submissions Roster */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs text-slate-700">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200/80 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                <th className="py-3.5 px-4">Task & Form Type</th>
                <th className="py-3.5 px-3">Submitted By</th>
                <th className="py-3.5 px-3">Reason Category</th>
                <th className="py-3.5 px-4">Explanation & Notes</th>
                <th className="py-3.5 px-3">Proposed Date</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-4 text-right">Authority Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-medium">
                    Loading submissions queue...
                  </td>
                </tr>
              ) : submissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No submissions found for the selected filters.
                  </td>
                </tr>
              ) : (
                submissions.map((item) => {
                  const typeBadge = formTypeBadges[item.form_type] || {
                    label: item.form_type,
                    style: 'bg-slate-100 text-slate-600 border-slate-200',
                  };
                  const createdDT = formatDateTime(item.created_at);
                  const isPending = item.status === 'PENDING_REVIEW';
                  const isOwnSubmission = item.submitted_by_id === currentUser?.id;

                  return (
                    <tr key={item.id} className="hover:bg-blue-50/40 transition duration-150">
                      {/* Task Title & Form Type */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 tracking-wide">{item.task_title}</div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border tracking-wider uppercase ${typeBadge.style}`}
                          >
                            {typeBadge.label}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Task #{item.task_id} ({item.task_current_progress}%)
                          </span>
                        </div>
                      </td>

                      {/* Submitted By */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{item.submitted_by_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono leading-tight mt-0.5">
                          <div>{createdDT.date}</div>
                          <div className="text-blue-600/80">{createdDT.time}</div>
                        </div>
                      </td>

                      {/* Reason Category */}
                      <td className="py-3.5 px-3">
                        <span className="font-semibold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-xl text-[11px] border border-slate-200/80">
                          {item.reason_category}
                        </span>
                      </td>

                      {/* Explanation */}
                      <td className="py-3.5 px-4 max-w-[260px]">
                        <p className="text-slate-600 whitespace-pre-wrap line-clamp-2" title={item.explanation}>
                          {item.explanation || '—'}
                        </p>
                        {item.reviewer_remarks && (
                          <div className="text-[10px] text-blue-600 mt-1 italic font-medium">
                            Reviewed by {item.reviewed_by_name}: "{item.reviewer_remarks}"
                          </div>
                        )}
                      </td>

                      {/* Expected / Proposed Date */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {item.expected_due_date ? (
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5 font-mono">
                            <Calendar size={12} className="text-blue-600" />
                            {item.expected_due_date}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                            statusBadges[item.status] || 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {item.status?.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {isPending && !isOwnSubmission ? (
                          <div className="flex items-center justify-end gap-2">
                            {item.form_type === 'OVERDUE_DELAY' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenActionModal(item, 'RESCHEDULE')}
                                  className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-xl text-[11px] font-semibold transition cursor-pointer shadow-[0_3px_10px_rgba(37,99,235,0.25)]"
                                >
                                  Reschedule
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenActionModal(item, 'CANCEL')}
                                  className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-xl text-[11px] font-semibold transition cursor-pointer"
                                >
                                  Cancel Task
                                </button>
                              </>
                            ) : item.form_type === 'REJECTION' ? (
                              <button
                                type="button"
                                onClick={() => handleOpenActionModal(item, 'VERIFY')}
                                className="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-[11px] font-semibold transition cursor-pointer"
                              >
                                Acknowledge
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenActionModal(item, 'VERIFY')}
                                className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-[11px] font-semibold transition cursor-pointer"
                              >
                                Sign Off
                              </button>
                            )}
                          </div>
                        ) : isPending ? (
                          <span className="text-[11px] text-amber-600 italic font-medium">Awaiting Review</span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">Completed</span>
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-[0_24px_50px_rgba(15,23,42,0.16)] max-w-md w-full p-6 border border-slate-200/90 space-y-4 text-xs text-slate-800">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5 font-bold text-sm text-slate-900 tracking-wide">
                {actionType === 'RESCHEDULE' ? (
                  <>
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                      <Calendar size={15} />
                    </div>
                    Reschedule Task Due Date
                  </>
                ) : actionType === 'CANCEL' ? (
                  <>
                    <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center">
                      <XCircle size={15} />
                    </div>
                    Cancel Task Confirmation
                  </>
                ) : (
                  <>
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
                      <CheckCircle2 size={15} />
                    </div>
                    Acknowledge Submission
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveItem(null)}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition text-base font-bold p-1.5 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleExecuteAction} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 uppercase tracking-wider text-[11px]">
                  Target Task
                </label>
                <input
                  type="text"
                  readOnly
                  value={activeItem.task_title}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-700 cursor-not-allowed font-semibold"
                />
              </div>

              {actionType === 'RESCHEDULE' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5 uppercase tracking-wider text-[11px]">
                    New Due Date (Rescheduled) *
                  </label>
                  <input
                    type="date"
                    min={todayStr}
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none transition"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Employee proposed date: <span className="text-blue-700 font-semibold">{activeItem.expected_due_date || 'None'}</span>
                  </p>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1.5 uppercase tracking-wider text-[11px]">
                  Authority Remarks / Instructions
                </label>
                <textarea
                  rows="3"
                  value={reviewerRemarks}
                  onChange={(e) => setReviewerRemarks(e.target.value)}
                  placeholder="Provide instructions or justification for the employee..."
                  className="w-full bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none transition"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveItem(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className={`font-semibold px-5 py-2 rounded-xl transition duration-150 cursor-pointer disabled:opacity-50 ${
                    actionType === 'CANCEL'
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-[0_4px_12px_rgba(225,29,72,0.25)]'
                      : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white shadow-[0_4px_14px_rgba(37,99,235,0.28)]'
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