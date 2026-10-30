import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  User, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  FileText
} from 'lucide-react';
import api from '../api/axios';

export default function AuditLogViewer({ currentUser }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState('all'); // 'today' | 'last_7_days' | 'last_30_days' | 'all'

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange !== 'all') params.range = dateRange;
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const res = await api.get('/tasks/audit-logs/', { params });
      setLogs(res.data || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [dateRange, statusFilter]);

  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (log.task_title || '').toLowerCase().includes(q) ||
      (log.actor_username || '').toLowerCase().includes(q) ||
      (log.assigned_to_username || '').toLowerCase().includes(q) ||
      (log.remarks || '').toLowerCase().includes(q);

    return matchesSearch;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'VERIFIED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'AWAITING_VERIFICATION':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'IN_PROGRESS':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'ACCEPTED':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'ON_HOLD':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'CANCELLED':
      case 'REJECTED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <History className="text-blue-600" size={18} />
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Immutable Task Activity Audit Log
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete lifecycle history, status transitions, progress adjustments, and remarks
          </p>
        </div>

        <button
          onClick={fetchAuditLogs}
          className="self-start sm:self-auto px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
        >
          <RefreshCw size={13} /> Refresh Log
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80 self-start">
          <Search size={14} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search task title, actor, remarks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden bg-slate-50/40"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end self-end">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-hidden"
          >
            <option value="ALL">All Status Actions</option>
            <option value="REQUEST_PENDING">Request Pending</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="AWAITING_VERIFICATION">Awaiting Verification</option>
            <option value="VERIFIED">Verified / Done</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-hidden"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="last_7_days">Last 7 Days</option>
            <option value="last_30_days">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table / Card Stack */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Task</th>
                <th className="py-3 px-4">Action By</th>
                <th className="py-3 px-4">State Transition</th>
                <th className="py-3 px-4">Progress Delta</th>
                <th className="py-3 px-4">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-400">Loading activity trail...</td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-400">No log entries found matching criteria.</td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-mono text-slate-500 whitespace-nowrap text-[11px]">
                      {log.timestamp_formatted || new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-xs truncate">
                      {log.task_title || `Task #${log.task_id}`}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {log.actor_username || 'System'}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {log.old_status && (
                          <>
                            <span className={`px-2 py-0.5 rounded text-[10px] border ${getStatusBadge(log.old_status)}`}>
                              {log.old_status}
                            </span>
                            <ArrowRight size={11} className="text-slate-400" />
                          </>
                        )}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(log.new_status)}`}>
                          {log.new_status}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <span className="text-slate-400">{log.old_progress}%</span>
                      <span className="mx-1 text-slate-300">&rarr;</span>
                      <strong className="text-blue-600">{log.new_progress}%</strong>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-sm truncate" title={log.remarks}>
                      {log.remarks || <span className="text-slate-300 italic">No remarks recorded</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View Card Timeline */}
        <div className="grid grid-cols-1 divide-y divide-slate-100 md:hidden">
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-xs">Loading activity trail...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">No activity entries found.</div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="p-4 space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 truncate">
                      {log.task_title || `Task #${log.task_id}`}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      By: <strong className="text-slate-600">{log.actor_username || 'System'}</strong> &bull; {log.timestamp_formatted || new Date(log.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${getStatusBadge(log.new_status)}`}>
                    {log.new_status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                  <span>Progress Delta</span>
                  <span>{log.old_progress}% &rarr; <strong className="text-blue-600">{log.new_progress}%</strong></span>
                </div>

                {log.remarks && (
                  <p className="text-[11px] text-slate-600 bg-slate-50/50 p-2 rounded border border-slate-100">
                    "{log.remarks}"
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}