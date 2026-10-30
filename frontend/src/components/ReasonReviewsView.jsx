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
    OVERDUE_DELAY: { label: 'Overdue Delay', style: 'bg-rose-50 text-rose-700 border-rose-200' },
    REJECTION: { label: 'Assignment Rejected', style: 'bg-orange-50 text-orange-700 border-orange-200' },
    NO_ACTION_TODAY: { label: 'Daily No-Action', style: 'bg-amber-50 text-amber-700 border-amber-200' },
    AUTO_UNSUBMITTED: { label: 'Auto Trigger: Inaction', style: 'bg-red-100 text-red-800 border-red-300' },
  };

  const statusBadges = {
    PENDING_REVIEW: 'bg-amber-50 text-amber-800 border-amber-200',
    RESCHEDULED: 'bg-blue-50 text-blue-800 border-blue-200',
    CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
    VERIFIED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Header Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare size={18} className="text-blue-600" />
            Reason Submissions & Authority Review Hub
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Review overdue task delay reports, assignment rejections, and daily commitment inaction logs.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
            <Filter size={13} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent font-medium text-slate-700 focus:outline-none"
            >
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="RESCHEDULED">Rescheduled</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="VERIFIED">Verified / Acknowledged</option>
              <option value="ALL">All Statuses</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent font-medium text-slate-700 focus:outline-none"
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
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            title="Refresh submissions"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Submissions Roster */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Task & Form Type</th>
                <th className="py-3 px-3">Submitted By</th>
                <th className="py-3 px-3">Reason Category</th>
                <th className="py-3 px-4">Explanation & Notes</th>
                <th className="py-3 px-3">Proposed Date</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Authority Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading submissions queue...
                  </td>
                </tr>
              ) : submissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No submissions found for the selected filters.
                  </td>
                </tr>
              ) : (
                submissions.map((item) => {
                  const typeBadge = formTypeBadges[item.form_type] || {
                    label: item.form_type,
                    style: 'bg-slate-100 text-slate-600',
                  };
                  const createdDT = formatDateTime(item.created_at);
                  const isPending = item.status === 'PENDING_REVIEW';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      {/* Task Title & Form Type */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{item.task_title}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${typeBadge.style}`}
                          >
                            {typeBadge.label}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Task #{item.task_id} ({item.task_current_progress}%)
                          </span>
                        </div>
                      </td>

                      {/* Submitted By */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-800">{item.submitted_by_name}</div>
                        <div className="text-[10px] text-slate-400 leading-tight">
                          <div>{createdDT.date}</div>
                          <div>{createdDT.time}</div>
                        </div>
                      </td>

                      {/* Reason Category */}
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                          {item.reason_category}
                        </span>
                      </td>

                      {/* Explanation */}
                      <td className="py-3 px-4 max-w-[260px]">
                        <p className="text-slate-700 whitespace-pre-wrap line-clamp-2" title={item.explanation}>
                          {item.explanation || '—'}
                        </p>
                        {item.reviewer_remarks && (
                          <div className="text-[10px] text-slate-500 mt-1 italic">
                            Reviewed by {item.reviewed_by_name}: "{item.reviewer_remarks}"
                          </div>
                        )}
                      </td>

                      {/* Expected / Proposed Date */}
                      <td className="py-3 px-3">
                        {item.expected_due_date ? (
                          <div className="font-medium text-slate-800 flex items-center gap-1">
                            <Calendar size={12} className="text-slate-400" />
                            {item.expected_due_date}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            statusBadges[item.status] || 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.status?.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {item.form_type === 'OVERDUE_DELAY' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenActionModal(item, 'RESCHEDULE')}
                                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold transition shadow-2xs"
                                >
                                  Reschedule
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenActionModal(item, 'CANCEL')}
                                  className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded text-[11px] font-bold transition"
                                >
                                  Cancel Task
                                </button>
                              </>
                            ) : item.form_type === 'REJECTION' ? (
                              <button
                                type="button"
                                onClick={() => handleOpenActionModal(item, 'VERIFY')}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition shadow-2xs"
                              >
                                Acknowledge
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenActionModal(item, 'VERIFY')}
                                className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded text-[11px] font-bold transition shadow-2xs"
                              >
                                Sign Off
                              </button>
                            )}
                          </div>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                {actionType === 'RESCHEDULE' ? (
                  <>
                    <Calendar size={18} className="text-blue-600" /> Reschedule Task Due Date
                  </>
                ) : actionType === 'CANCEL' ? (
                  <>
                    <XCircle size={18} className="text-rose-600" /> Cancel Task Confirmation
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} className="text-emerald-600" /> Acknowledge Submission
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveItem(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleExecuteAction} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Task</label>
                <input
                  type="text"
                  readOnly
                  value={activeItem.task_title}
                  className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 text-slate-600 cursor-not-allowed"
                />
              </div>

              {actionType === 'RESCHEDULE' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    New Due Date (Rescheduled) *
                  </label>
                  <input
                    type="date"
                    min={todayStr}
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Employee proposed date: {activeItem.expected_due_date || 'None'}
                  </p>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Authority Remarks / Instructions</label>
                <textarea
                  rows="3"
                  value={reviewerRemarks}
                  onChange={(e) => setReviewerRemarks(e.target.value)}
                  placeholder="Provide instructions or justification for the employee..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveItem(null)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className={`font-medium px-4 py-1.5 rounded-lg text-white transition disabled:opacity-50 ${
                    actionType === 'CANCEL'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-blue-600 hover:bg-blue-700'
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