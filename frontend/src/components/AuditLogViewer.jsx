import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Clock, 
  ArrowRight, 
  RefreshCw,
  User,
  Layers,
  Building2,
  ShieldCheck,
  CheckSquare
} from 'lucide-react';
import api from '../api/axios';

const MODULE_TABS = [
  { key: 'ALL', label: 'All Activity' },
  { key: 'USER', label: 'User Admin' },
  { key: 'MATRIX', label: 'Matrix & Teams' },
  { key: 'ORGANIZATION', label: 'Organization' },
  { key: 'AUTH', label: 'Security & Duty' },
  { key: 'TASK', label: 'Tasks' },
];

const MODULE_BADGE_STYLES = {
  USER: 'bg-blue-50 text-blue-700 border-blue-200',
  MATRIX: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  ORGANIZATION: 'bg-purple-50 text-purple-700 border-purple-200',
  AUTH: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  TASK: 'bg-amber-50 text-amber-700 border-amber-200',
  FORM: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function AuditLogViewer({ currentUser }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState('all');
  const [selectedLogForDetails, setSelectedLogForDetails] = useState(null);

  const isBaseEmployee = currentUser?.role === 'EMPLOYEE';

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange !== 'all') params.range = dateRange;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (selectedModule !== 'ALL') params.module = selectedModule;

      // Changed from /tasks/audit-logs/ to the unified global audit endpoint
      const res = await api.get('/auth/audit-logs/', { params });
      setLogs(res.data || []);
    } catch (err) {
      console.error('Failed to load global audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [dateRange, statusFilter, selectedModule]);

  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (log.entity_name || log.task_title || '').toLowerCase().includes(q) ||
      (log.action_type || '').toLowerCase().includes(q) ||
      (log.actor_name || log.actor_username || '').toLowerCase().includes(q) ||
      (log.target_name || log.target_username || '').toLowerCase().includes(q) ||
      (log.remarks || '').toLowerCase().includes(q);

    return matchesSearch;
  });

  const formatDateTimeParts = (log) => {
    if (log.timestamp_formatted && log.timestamp_formatted.includes(' -- ')) {
      const parts = log.timestamp_formatted.split(' -- ');
      return { date: parts[0], time: parts[1] };
    }
    if (!log.timestamp) return { date: '—', time: '—' };
    const d = new Date(log.timestamp);
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
    const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    return { date: dateStr, time: timeStr };
  };

  const formatShortDisplayName = (fullName, username) => {
    if (fullName && fullName.trim().length > 0) {
      const words = fullName.trim().split(/\s+/);
      return words.slice(0, 2).join(' ');
    }
    return username || 'System';
  };

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
              Global System & Activity Audit Trail
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable log of user administration, matrix assignments, organization events, and task workflows
          </p>
        </div>

        <button
          onClick={fetchAuditLogs}
          disabled={loading}
          className="self-start sm:self-auto px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh Log
        </button>
      </div>

      {/* Module Selector & Filters Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        {/* Module Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {MODULE_TABS.map((tab) => {
            const isActive = selectedModule === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setSelectedModule(tab.key)}
                className={`px-3 py-1.5 rounded-xl border font-medium whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-1 border-t border-slate-100">
          <div className="relative w-full md:w-80 self-start">
            <Search size={14} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search action, entity, actor, remarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden bg-slate-50/40"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end self-end">
            {selectedModule === 'TASK' && (
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
            )}

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
      </div>

      {/* Audit Log Table / Card Stack */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 w-36">Date & Time</th>
                <th className="py-3 px-3 w-28">Module</th>
                <th className="py-3 px-4 w-48">Action / Entity</th>
                <th className="py-3 px-4 w-36">Performed By</th>
                <th className="py-3 px-4 w-44">State / Target</th>
                <th className="py-3 px-4 min-w-[200px]">Remarks</th>
                <th className="py-3 px-3 text-right w-20">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-400">Loading audit history...</td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-400">No activity logs found matching the criteria.</td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const { date, time } = formatDateTimeParts(log);
                  const actorDisplay = formatShortDisplayName(log.actor_name, log.actor_username || 'System');
                  const hasDeltas = (log.old_values && Object.keys(log.old_values).length > 0) ||
                                    (log.new_values && Object.keys(log.new_values).length > 0);

                  const targetDisplay = log.target_name || log.target_username;
                  const isTaskModule = log.module === 'TASK';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition">
                      {/* Date & Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                        <div className="font-semibold text-slate-800">{date}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock size={11} className="text-slate-400 shrink-0" />
                          <span>{time}</span>
                        </div>
                      </td>

                      {/* Module */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${MODULE_BADGE_STYLES[log.module] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                          {log.module}
                        </span>
                      </td>

                      {/* Action / Entity */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 truncate max-w-[180px]" title={log.action_type}>
                          {log.action_type}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[180px]" title={log.entity_name || log.task_title || ''}>
                          {log.entity_name || log.task_title || '—'}
                        </div>
                      </td>

                      {/* Performed By */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-800">
                        <div className="flex items-center gap-1.5 truncate max-w-[130px]" title={log.actor_username || 'System'}>
                          <User size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate">{actorDisplay}</span>
                        </div>
                      </td>

                      {/* State / Target */}
                      <td className="py-3.5 px-4">
                        {isTaskModule && (log.new_status || log.new_progress !== undefined) ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {log.old_status && (
                              <>
                                <span className={`px-2 py-0.5 rounded text-[10px] border ${getStatusBadge(log.old_status)}`}>
                                  {log.old_status}
                                </span>
                                <ArrowRight size={11} className="text-slate-400" />
                              </>
                            )}
                            {log.new_status && (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(log.new_status)}`}>
                                {log.new_status}
                              </span>
                            )}
                            {log.new_progress !== undefined && (
                              <span className="font-mono text-[10px] text-blue-600 font-semibold ml-1">
                                {log.new_progress}%
                              </span>
                            )}
                          </div>
                        ) : targetDisplay ? (
                          <div className="text-slate-700 truncate max-w-[160px]" title={targetDisplay}>
                            <span className="text-[10px] text-slate-400">Target: </span>
                            <span className="font-medium">{targetDisplay}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* Remarks */}
                      <td className="py-3.5 px-4 text-slate-500 max-w-sm truncate" title={log.remarks}>
                        {log.remarks || <span className="text-slate-300 italic">No remarks recorded</span>}
                      </td>

                      {/* Delta Inspector */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        {hasDeltas ? (
                          <button
                            onClick={() => setSelectedLogForDetails(log)}
                            className="px-2 py-1 text-[10px] font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition cursor-pointer"
                          >
                            Delta
                          </button>
                        ) : (
                          <span className="text-slate-300 text-[11px]">&bull;</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View Card Timeline */}
        <div className="grid grid-cols-1 divide-y divide-slate-100 md:hidden">
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-xs">Loading activity history...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">No activity entries found.</div>
          ) : (
            filteredLogs.map((log) => {
              const { date, time } = formatDateTimeParts(log);
              const hasDeltas = (log.old_values && Object.keys(log.old_values).length > 0) ||
                                (log.new_values && Object.keys(log.new_values).length > 0);

              return (
                <div key={log.id} className="p-4 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${MODULE_BADGE_STYLES[log.module] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                          {log.module}
                        </span>
                        <span className="font-bold text-slate-900 truncate">
                          {log.action_type}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        By: <strong className="text-slate-600">{log.actor_name || log.actor_username || 'System'}</strong> &bull; {date} {time}
                      </p>
                    </div>

                    {hasDeltas && (
                      <button
                        onClick={() => setSelectedLogForDetails(log)}
                        className="px-2 py-1 text-[10px] font-medium text-blue-600 bg-blue-50 rounded-lg shrink-0"
                      >
                        Delta
                      </button>
                    )}
                  </div>

                  {(log.entity_name || log.task_title) && (
                    <div className="text-[11px] text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      Entity: <strong className="text-slate-900">{log.entity_name || log.task_title}</strong>
                      {log.target_name && (
                        <span> &bull; Target: <strong>{log.target_name}</strong></span>
                      )}
                    </div>
                  )}

                  {log.remarks && (
                    <p className="text-[11px] text-slate-600 bg-slate-50/50 p-2 rounded border border-slate-100">
                      "{log.remarks}"
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Delta Inspector Modal */}
      {selectedLogForDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Layers size={15} className="text-blue-600" />
                  Audit Record State Delta
                </h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  Action: {selectedLogForDetails.action_type} &bull; ID #{selectedLogForDetails.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedLogForDetails(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div><strong>Actor:</strong> {selectedLogForDetails.actor_name || selectedLogForDetails.actor_username || 'System'}</div>
                <div><strong>Timestamp:</strong> {selectedLogForDetails.timestamp}</div>
                {selectedLogForDetails.remarks && (
                  <div><strong>Remarks:</strong> {selectedLogForDetails.remarks}</div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                  State Changes (Old vs New)
                </h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-xl space-y-1">
                    <span className="font-bold text-[10px] text-rose-700 uppercase">Old State</span>
                    <pre className="font-mono text-[11px] text-slate-700 whitespace-pre-wrap break-all">
                      {JSON.stringify(selectedLogForDetails.old_values || {}, null, 2)}
                    </pre>
                  </div>

                  <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1">
                    <span className="font-bold text-[10px] text-emerald-700 uppercase">New State</span>
                    <pre className="font-mono text-[11px] text-slate-700 whitespace-pre-wrap break-all">
                      {JSON.stringify(selectedLogForDetails.new_values || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedLogForDetails(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs rounded-xl font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}