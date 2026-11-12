// frontend/src/components/AuditLogViewer.jsx

import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Clock, 
  ArrowRight, 
  RefreshCw,
  User,
  Layers,
  ChevronLeft,
  ChevronRight
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
  ORGANIZATION: 'bg-slate-100 text-slate-700 border-slate-200',
  AUTH: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  TASK: 'bg-sky-50 text-sky-700 border-sky-200',
  FORM: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function AuditLogViewer({ currentUser }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedLogForDetails, setSelectedLogForDetails] = useState(null);

  // Dynamic Days Range (Default 30 days, manual number input up to max available)
  const [daysRange, setDaysRange] = useState(30);
  const [maxAvailableDays, setMaxAvailableDays] = useState(365);
  const [earliestLogDate, setEarliestLogDate] = useState(null);

  // Pagination State (25 | 50 | 100 — Default: 100)
  const [pageSize, setPageSize] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // 1. Fetch dynamic boundary metadata on mount
  useEffect(() => {
    api.get('/auth/audit-logs/meta/')
      .then((res) => {
        if (res.data) {
          setMaxAvailableDays(res.data.max_available_days || 365);
          setEarliestLogDate(res.data.earliest_log_date || null);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch audit log metadata fallback to defaults:', err);
      });
  }, []);

  // 2. Fetch paginated and day-range filtered logs
  const fetchAuditLogs = async (targetPage = currentPage) => {
    setLoading(true);
    try {
      const params = {
        page: targetPage,
        page_size: pageSize,
        days: daysRange || 30
      };

      if (statusFilter !== 'ALL') params.action_type = statusFilter;
      if (selectedModule !== 'ALL') params.module = selectedModule;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.get('/auth/audit-logs/', { params });

      // Handle paginated responses or direct array fallback
      if (res.data && Array.isArray(res.data.results)) {
        setLogs(res.data.results);
        setTotalPages(res.data.num_pages || 1);
        setCurrentPage(res.data.current_page || 1);
        setTotalCount(res.data.count || res.data.results.length);
      } else if (Array.isArray(res.data)) {
        setLogs(res.data);
        setTotalPages(1);
        setCurrentPage(1);
        setTotalCount(res.data.length);
      } else {
        setLogs([]);
        setTotalPages(1);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('Failed to load global audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchAuditLogs(1);
  }, [daysRange, pageSize, statusFilter, selectedModule]);

  // Client-side quick filter for active search string if needed
  const filteredLogs = logs.filter((log) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (log.entity_name || log.task_title || '').toLowerCase().includes(q) ||
      (log.action_type || '').toLowerCase().includes(q) ||
      (log.actor_name || log.actor_username || '').toLowerCase().includes(q) ||
      (log.target_name || log.target_username || '').toLowerCase().includes(q) ||
      (log.remarks || '').toLowerCase().includes(q)
    );
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
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'IN_PROGRESS':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'ACCEPTED':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'ON_HOLD':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'CANCELLED':
      case 'REJECTED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-4 text-slate-800">
      {/* Header Bar */}
      <div className="bg-white/95 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center shadow-2xs">
              <History size={16} />
            </div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-wide">
              Global System & Activity Audit Trail
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Immutable log of user administration, matrix assignments, organization events, and task workflows
          </p>
        </div>

        <button
          onClick={() => fetchAuditLogs(currentPage)}
          disabled={loading}
          className="self-start sm:self-auto px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-[0_4px_14px_rgba(37,99,235,0.28)] hover:shadow-[0_6px_18px_rgba(37,99,235,0.38)] cursor-pointer disabled:opacity-50 relative z-10 active:scale-95"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh Log
        </button>
      </div>

      {/* Module Selector & Filters Toolbar */}
      <div className="bg-white/95 backdrop-blur-md p-4 rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] space-y-3">
        {/* Module Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {MODULE_TABS.map((tab) => {
            const isActive = selectedModule === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setSelectedModule(tab.key)}
                className={`px-3.5 py-1.5 rounded-xl border font-semibold whitespace-nowrap transition cursor-pointer tracking-wide ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-500 shadow-[0_4px_12px_rgba(37,99,235,0.25)]'
                    : 'bg-slate-50/90 text-slate-600 border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Search Box */}
          <div className="relative w-full lg:w-80">
            <Search size={14} className="absolute left-3.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search action, entity, actor, remarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none bg-slate-50/70 focus:bg-white text-slate-900 placeholder:text-slate-400 transition"
            />
          </div>

          {/* Right Toolbar Controls: Task Status + Custom Days Input + Page Size */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
            {selectedModule === 'TASK' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/70 font-semibold text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none cursor-pointer"
              >
                <option value="ALL">All Task Actions</option>
                <option value="TASK_CREATED">Task Created</option>
                <option value="TASK_ACCEPTED">Task Accepted</option>
                <option value="TASK_PROGRESS_UPDATED">Progress Updated</option>
                <option value="TASK_SUBMITTED_FOR_VERIFICATION">Awaiting Verification</option>
                <option value="TASK_VERIFIED">Task Verified</option>
                <option value="TASK_CANCELLED">Task Cancelled</option>
                <option value="TASK_REJECTED">Task Rejected</option>
              </select>
            )}

            {/* Custom Manual Days Input with dynamic helper hint */}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 bg-slate-50/80 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
                <span className="text-[11px] text-slate-500 font-semibold">Last</span>
                <input
                  type="number"
                  min="1"
                  max={maxAvailableDays}
                  value={daysRange}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (val > maxAvailableDays) setDaysRange(maxAvailableDays);
                    else setDaysRange(val);
                  }}
                  className="w-14 text-xs font-bold text-blue-700 outline-none text-center bg-white rounded-lg border border-blue-200 py-0.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                />
                <span className="text-[11px] text-slate-500 font-semibold">Days</span>
              </div>
              <span className="text-[9px] text-slate-400 mt-0.5 pl-1">
                Max: <strong className="text-slate-600">{maxAvailableDays} days</strong> {earliestLogDate ? `(from ${earliestLogDate})` : ''}
              </span>
            </div>

            {/* Pagination Size Selector (25 | 50 | 100) */}
            <div className="flex items-center gap-1.5 bg-slate-50/80 border border-slate-200 rounded-xl px-2.5 py-2 shadow-2xs self-start">
              <span className="text-[11px] text-slate-500 font-semibold">Show:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="text-xs font-bold text-blue-700 bg-transparent outline-none cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-[11px] text-slate-500 font-semibold">entries</span>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log Table / Card Stack */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/90 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-4 w-36">Date & Time</th>
                <th className="py-3.5 px-3 w-28">Module</th>
                <th className="py-3.5 px-4 w-48">Action / Entity</th>
                <th className="py-3.5 px-4 w-36">Performed By</th>
                <th className="py-3.5 px-4 w-44">State / Target</th>
                <th className="py-3.5 px-4 min-w-[200px]">Remarks</th>
                <th className="py-3.5 px-3 text-right w-20">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-500 font-medium">Loading audit history...</td>
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
                    <tr key={log.id} className="hover:bg-blue-50/40 transition duration-150">
                      {/* Date & Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px]">
                        <div className="font-semibold text-slate-800">{date}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock size={11} className="text-blue-500 shrink-0" />
                          <span>{time}</span>
                        </div>
                      </td>

                      {/* Module */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border tracking-wider uppercase ${MODULE_BADGE_STYLES[log.module] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                          {log.module}
                        </span>
                      </td>

                      {/* Action / Entity */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 truncate max-w-[180px]" title={log.action_type}>
                          {log.action_type}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[180px]" title={log.entity_name || log.task_title || ''}>
                          {log.entity_name || log.task_title || '—'}
                        </div>
                      </td>

                      {/* Performed By */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-800">
                        <div className="flex items-center gap-1.5 truncate max-w-[130px]" title={log.actor_username || 'System'}>
                          <User size={13} className="text-blue-600 shrink-0" />
                          <span className="truncate">{actorDisplay}</span>
                        </div>
                      </td>

                      {/* State / Target */}
                      <td className="py-3.5 px-4">
                        {isTaskModule && (log.new_status || log.new_progress !== undefined) ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {log.old_status && (
                              <>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusBadge(log.old_status)}`}>
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
                              <span className="font-mono text-[10px] text-blue-700 font-bold ml-1">
                                {log.new_progress}%
                              </span>
                            )}
                          </div>
                        ) : targetDisplay ? (
                          <div className="text-slate-600 truncate max-w-[160px]" title={targetDisplay}>
                            <span className="text-[10px] text-slate-400">Target: </span>
                            <span className="font-semibold text-slate-900">{targetDisplay}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* Remarks */}
                      <td className="py-3.5 px-4 text-slate-600 max-w-sm truncate" title={log.remarks}>
                        {log.remarks || <span className="text-slate-400 italic">No remarks recorded</span>}
                      </td>

                      {/* Delta Inspector */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        {hasDeltas ? (
                          <button
                            onClick={() => setSelectedLogForDetails(log)}
                            className="px-2.5 py-1 text-[10px] font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer"
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
            <div className="text-center py-8 text-slate-500 text-xs font-medium">Loading activity history...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">No activity entries found.</div>
          ) : (
            filteredLogs.map((log) => {
              const { date, time } = formatDateTimeParts(log);
              const hasDeltas = (log.old_values && Object.keys(log.old_values).length > 0) ||
                                (log.new_values && Object.keys(log.new_values).length > 0);

              return (
                <div key={log.id} className="p-4 space-y-2 text-xs hover:bg-blue-50/30 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border tracking-wider uppercase ${MODULE_BADGE_STYLES[log.module] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                          {log.module}
                        </span>
                        <span className="font-bold text-slate-900 truncate">
                          {log.action_type}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        By: <strong className="text-slate-800">{log.actor_name || log.actor_username || 'System'}</strong> &bull; {date} {time}
                      </p>
                    </div>

                    {hasDeltas && (
                      <button
                        onClick={() => setSelectedLogForDetails(log)}
                        className="px-2.5 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg shrink-0 cursor-pointer"
                      >
                        Delta
                      </button>
                    )}
                  </div>

                  {(log.entity_name || log.task_title) && (
                    <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                      Entity: <strong className="text-slate-900">{log.entity_name || log.task_title}</strong>
                      {log.target_name && (
                        <span> &bull; Target: <strong className="text-blue-700">{log.target_name}</strong></span>
                      )}
                    </div>
                  )}

                  {log.remarks && (
                    <p className="text-[11px] text-slate-600 bg-blue-50/40 p-2.5 rounded-xl border border-blue-100">
                      "{log.remarks}"
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Controls Footer */}
        {totalPages > 1 && (
          <div className="p-4 bg-slate-50/90 border-t border-slate-200/80 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">
              Showing page <strong className="text-slate-900">{currentPage}</strong> of <strong className="text-slate-900">{totalPages}</strong> ({totalCount} total entries)
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1 || loading}
                onClick={() => fetchAuditLogs(currentPage - 1)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50/50 transition disabled:opacity-40 cursor-pointer inline-flex items-center gap-1 shadow-2xs"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages || loading}
                onClick={() => fetchAuditLogs(currentPage + 1)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50/50 transition disabled:opacity-40 cursor-pointer inline-flex items-center gap-1 shadow-2xs"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delta Inspector Modal */}
      {selectedLogForDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200/90 shadow-[0_24px_50px_rgba(15,23,42,0.16)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                    <Layers size={14} />
                  </div>
                  Audit Record State Delta
                </h3>
                <p className="text-[11px] text-slate-500 font-mono mt-1">
                  Action: {selectedLogForDetails.action_type} &bull; ID #{selectedLogForDetails.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedLogForDetails(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer transition"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1 text-slate-700">
                <div><strong className="text-slate-900">Actor:</strong> {selectedLogForDetails.actor_name || selectedLogForDetails.actor_username || 'System'}</div>
                <div><strong className="text-slate-900">Timestamp:</strong> {selectedLogForDetails.timestamp}</div>
                {selectedLogForDetails.remarks && (
                  <div><strong className="text-slate-900">Remarks:</strong> {selectedLogForDetails.remarks}</div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                  State Changes (Old vs New)
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 bg-rose-50/60 border border-rose-200/80 rounded-2xl space-y-1">
                    <span className="font-bold text-[10px] text-rose-700 uppercase tracking-wider block">Old State</span>
                    <pre className="font-mono text-[11px] text-slate-700 whitespace-pre-wrap break-all">
                      {JSON.stringify(selectedLogForDetails.old_values || {}, null, 2)}
                    </pre>
                  </div>

                  <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl space-y-1">
                    <span className="font-bold text-[10px] text-emerald-700 uppercase tracking-wider block">New State</span>
                    <pre className="font-mono text-[11px] text-slate-700 whitespace-pre-wrap break-all">
                      {JSON.stringify(selectedLogForDetails.new_values || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedLogForDetails(null)}
                className="px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold rounded-xl text-xs tracking-wide shadow-[0_4px_12px_rgba(37,99,235,0.25)] transition cursor-pointer"
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