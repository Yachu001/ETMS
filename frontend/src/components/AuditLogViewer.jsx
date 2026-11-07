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
  Building2,
  ShieldCheck,
  CheckSquare,
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
  USER: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  MATRIX: 'bg-[#181510] text-amber-200 border-amber-500/25',
  ORGANIZATION: 'bg-neutral-900 text-amber-300/90 border-amber-500/20',
  AUTH: 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30',
  TASK: 'bg-gradient-to-r from-amber-500/20 to-amber-600/10 text-amber-300 border-amber-400/40',
  FORM: 'bg-rose-950/40 text-rose-400 border-rose-500/30',
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
        return 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30';
      case 'AWAITING_VERIFICATION':
        return 'bg-amber-500/15 text-amber-300 border-amber-400/40 shadow-[0_0_10px_rgba(245,158,11,0.15)]';
      case 'IN_PROGRESS':
        return 'bg-amber-500/10 text-amber-200 border-amber-400/30';
      case 'ACCEPTED':
        return 'bg-[#181510] text-amber-300 border-amber-500/25';
      case 'ON_HOLD':
        return 'bg-amber-950/40 text-amber-400 border-amber-600/30';
      case 'CANCELLED':
      case 'REJECTED':
        return 'bg-rose-950/40 text-rose-400 border-rose-500/30';
      default:
        return 'bg-neutral-900 text-neutral-300 border-neutral-800';
    }
  };

  return (
    <div className="space-y-4 text-neutral-200">
      {/* Header Bar */}
      <div className="bg-[#0b0c0e] p-4 sm:p-5 rounded-3xl border border-amber-500/25 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_35px_rgba(212,175,55,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1c1917] via-[#161412] to-[#0a0a0a] text-amber-300 border border-amber-400/30 flex items-center justify-center shadow-xs">
              <History size={16} />
            </div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
              Global System & Activity Audit Trail
            </h2>
          </div>
          <p className="text-xs text-amber-200/50 mt-1">
            Immutable log of user administration, matrix assignments, organization events, and task workflows
          </p>
        </div>

        <button
          onClick={() => fetchAuditLogs(currentPage)}
          disabled={loading}
          className="self-start sm:self-auto px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-[0_0_20px_rgba(212,175,55,0.25)] hover:shadow-[0_0_25px_rgba(212,175,55,0.4)] cursor-pointer disabled:opacity-50 relative z-10"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh Log
        </button>
      </div>

      {/* Module Selector & Filters Toolbar */}
      <div className="bg-[#0b0c0e] p-4 rounded-3xl border border-amber-500/20 shadow-2xl space-y-3">
        {/* Module Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {MODULE_TABS.map((tab) => {
            const isActive = selectedModule === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setSelectedModule(tab.key)}
                className={`px-3.5 py-1.5 rounded-xl border font-medium whitespace-nowrap transition cursor-pointer tracking-wide ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black border-amber-400 font-bold shadow-[0_0_15px_rgba(212,175,55,0.25)]'
                    : 'bg-[#141518] text-neutral-400 border-white/5 hover:border-amber-500/30 hover:text-amber-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pt-3 border-t border-amber-500/15">
          {/* Search Box */}
          <div className="relative w-full lg:w-80">
            <Search size={14} className="absolute left-3.5 top-3 text-amber-400/60" />
            <input
              type="text"
              placeholder="Search action, entity, actor, remarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs border border-amber-500/30 rounded-xl focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none bg-[#141518] text-neutral-100 placeholder:text-neutral-600 transition"
            />
          </div>

          {/* Right Toolbar Controls: Task Status + Custom Days Input + Page Size */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
            {selectedModule === 'TASK' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-amber-500/30 rounded-xl px-3 py-2 bg-[#141518] font-medium text-amber-200 focus:border-amber-400 outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-[#0b0c0e] text-neutral-200">All Task Actions</option>
                <option value="TASK_CREATED" className="bg-[#0b0c0e] text-neutral-200">Task Created</option>
                <option value="TASK_ACCEPTED" className="bg-[#0b0c0e] text-neutral-200">Task Accepted</option>
                <option value="TASK_PROGRESS_UPDATED" className="bg-[#0b0c0e] text-neutral-200">Progress Updated</option>
                <option value="TASK_SUBMITTED_FOR_VERIFICATION" className="bg-[#0b0c0e] text-neutral-200">Awaiting Verification</option>
                <option value="TASK_VERIFIED" className="bg-[#0b0c0e] text-neutral-200">Task Verified</option>
                <option value="TASK_CANCELLED" className="bg-[#0b0c0e] text-neutral-200">Task Cancelled</option>
                <option value="TASK_REJECTED" className="bg-[#0b0c0e] text-neutral-200">Task Rejected</option>
              </select>
            )}

            {/* Custom Manual Days Input with dynamic helper hint */}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 bg-[#141518] border border-amber-500/30 rounded-xl px-2.5 py-1.5 shadow-2xs">
                <span className="text-[11px] text-amber-400/80 font-medium">Last</span>
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
                  className="w-14 text-xs font-bold text-amber-300 outline-none text-center bg-[#0b0c0e] rounded border border-amber-500/40 py-0.5 focus:border-amber-400"
                />
                <span className="text-[11px] text-amber-400/80 font-medium">Days</span>
              </div>
              <span className="text-[9px] text-neutral-500 mt-0.5 pl-1">
                Max: <strong className="text-amber-300/80">{maxAvailableDays} days</strong> {earliestLogDate ? `(from ${earliestLogDate})` : ''}
              </span>
            </div>

            {/* Pagination Size Selector (25 | 50 | 100) */}
            <div className="flex items-center gap-1.5 bg-[#141518] border border-amber-500/30 rounded-xl px-2.5 py-2 shadow-2xs self-start">
              <span className="text-[11px] text-amber-400/80 font-medium">Show:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="text-xs font-bold text-amber-300 bg-transparent outline-none cursor-pointer"
              >
                <option value={25} className="bg-[#0b0c0e] text-neutral-200">25</option>
                <option value={50} className="bg-[#0b0c0e] text-neutral-200">50</option>
                <option value={100} className="bg-[#0b0c0e] text-neutral-200">100</option>
              </select>
              <span className="text-[11px] text-amber-400/80">entries</span>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log Table / Card Stack */}
      <div className="bg-[#0b0c0e] rounded-3xl border border-amber-500/20 shadow-2xl overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-[#141518] text-amber-400/80 font-semibold uppercase tracking-wider text-[11px] border-b border-amber-500/15">
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
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-amber-200/50">Loading audit history...</td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-neutral-500">No activity logs found matching the criteria.</td>
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
                    <tr key={log.id} className="hover:bg-amber-500/[0.03] transition duration-150">
                      {/* Date & Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px]">
                        <div className="font-semibold text-neutral-200">{date}</div>
                        <div className="text-[10px] text-amber-200/50 flex items-center gap-1 mt-0.5">
                          <Clock size={11} className="text-amber-400 shrink-0" />
                          <span>{time}</span>
                        </div>
                      </td>

                      {/* Module */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border tracking-wider uppercase ${MODULE_BADGE_STYLES[log.module] || 'bg-neutral-900 text-neutral-300 border-neutral-800'}`}>
                          {log.module}
                        </span>
                      </td>

                      {/* Action / Entity */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white truncate max-w-[180px]" title={log.action_type}>
                          {log.action_type}
                        </div>
                        <div className="text-[10px] text-neutral-400 truncate max-w-[180px]" title={log.entity_name || log.task_title || ''}>
                          {log.entity_name || log.task_title || '—'}
                        </div>
                      </td>

                      {/* Performed By */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-medium text-neutral-200">
                        <div className="flex items-center gap-1.5 truncate max-w-[130px]" title={log.actor_username || 'System'}>
                          <User size={13} className="text-amber-400/80 shrink-0" />
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
                                <ArrowRight size={11} className="text-amber-400/60" />
                              </>
                            )}
                            {log.new_status && (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(log.new_status)}`}>
                                {log.new_status}
                              </span>
                            )}
                            {log.new_progress !== undefined && (
                              <span className="font-mono text-[10px] text-amber-300 font-semibold ml-1">
                                {log.new_progress}%
                              </span>
                            )}
                          </div>
                        ) : targetDisplay ? (
                          <div className="text-neutral-300 truncate max-w-[160px]" title={targetDisplay}>
                            <span className="text-[10px] text-amber-200/50">Target: </span>
                            <span className="font-medium text-white">{targetDisplay}</span>
                          </div>
                        ) : (
                          <span className="text-neutral-500 italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* Remarks */}
                      <td className="py-3.5 px-4 text-neutral-400 max-w-sm truncate" title={log.remarks}>
                        {log.remarks || <span className="text-neutral-600 italic">No remarks recorded</span>}
                      </td>

                      {/* Delta Inspector */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        {hasDeltas ? (
                          <button
                            onClick={() => setSelectedLogForDetails(log)}
                            className="px-2.5 py-1 text-[10px] font-semibold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition cursor-pointer"
                          >
                            Delta
                          </button>
                        ) : (
                          <span className="text-neutral-700 text-[11px]">&bull;</span>
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
        <div className="grid grid-cols-1 divide-y divide-white/5 md:hidden">
          {loading ? (
            <div className="text-center py-8 text-amber-200/50 text-xs">Loading activity history...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-neutral-500 text-xs">No activity entries found.</div>
          ) : (
            filteredLogs.map((log) => {
              const { date, time } = formatDateTimeParts(log);
              const hasDeltas = (log.old_values && Object.keys(log.old_values).length > 0) ||
                                (log.new_values && Object.keys(log.new_values).length > 0);

              return (
                <div key={log.id} className="p-4 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border tracking-wider uppercase ${MODULE_BADGE_STYLES[log.module] || 'bg-neutral-900 text-neutral-300 border-neutral-800'}`}>
                          {log.module}
                        </span>
                        <span className="font-bold text-white truncate">
                          {log.action_type}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-200/50">
                        By: <strong className="text-neutral-200">{log.actor_name || log.actor_username || 'System'}</strong> &bull; {date} {time}
                      </p>
                    </div>

                    {hasDeltas && (
                      <button
                        onClick={() => setSelectedLogForDetails(log)}
                        className="px-2.5 py-1 text-[10px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg shrink-0 cursor-pointer"
                      >
                        Delta
                      </button>
                    )}
                  </div>

                  {(log.entity_name || log.task_title) && (
                    <div className="text-[11px] text-neutral-300 bg-[#141518] p-2.5 rounded-xl border border-amber-500/15">
                      Entity: <strong className="text-white">{log.entity_name || log.task_title}</strong>
                      {log.target_name && (
                        <span> &bull; Target: <strong className="text-amber-200">{log.target_name}</strong></span>
                      )}
                    </div>
                  )}

                  {log.remarks && (
                    <p className="text-[11px] text-neutral-400 bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
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
          <div className="p-4 bg-[#141518] border-t border-amber-500/15 flex items-center justify-between text-xs">
            <span className="text-amber-200/70 font-medium">
              Showing page <strong className="text-white">{currentPage}</strong> of <strong className="text-white">{totalPages}</strong> ({totalCount} total entries)
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1 || loading}
                onClick={() => fetchAuditLogs(currentPage - 1)}
                className="px-3 py-1.5 bg-[#0b0c0e] border border-amber-500/30 rounded-xl font-semibold text-amber-200 hover:border-amber-400 hover:text-white transition disabled:opacity-40 cursor-pointer inline-flex items-center gap-1"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages || loading}
                onClick={() => fetchAuditLogs(currentPage + 1)}
                className="px-3 py-1.5 bg-[#0b0c0e] border border-amber-500/30 rounded-xl font-semibold text-amber-200 hover:border-amber-400 hover:text-white transition disabled:opacity-40 cursor-pointer inline-flex items-center gap-1"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delta Inspector Modal */}
      {selectedLogForDetails && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0b0c0e] rounded-3xl max-w-lg w-full border border-amber-500/25 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_40px_rgba(212,175,55,0.08)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-amber-500/20 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Layers size={15} className="text-amber-400" />
                  Audit Record State Delta
                </h3>
                <p className="text-[11px] text-amber-200/50 font-mono mt-0.5">
                  Action: {selectedLogForDetails.action_type} &bull; ID #{selectedLogForDetails.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedLogForDetails(null)}
                className="text-neutral-400 hover:text-amber-300 text-lg font-bold p-1 cursor-pointer transition"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <div className="p-3.5 bg-gradient-to-b from-[#141518] to-[#101114] rounded-2xl border border-amber-500/15 space-y-1 text-neutral-300">
                <div><strong className="text-amber-400/80">Actor:</strong> {selectedLogForDetails.actor_name || selectedLogForDetails.actor_username || 'System'}</div>
                <div><strong className="text-amber-400/80">Timestamp:</strong> {selectedLogForDetails.timestamp}</div>
                {selectedLogForDetails.remarks && (
                  <div><strong className="text-amber-400/80">Remarks:</strong> {selectedLogForDetails.remarks}</div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-amber-300/90 text-[11px] uppercase tracking-wider">
                  State Changes (Old vs New)
                </h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 bg-rose-950/20 border border-rose-500/30 rounded-2xl space-y-1">
                    <span className="font-bold text-[10px] text-rose-400 uppercase tracking-wider block">Old State</span>
                    <pre className="font-mono text-[11px] text-neutral-300 whitespace-pre-wrap break-all">
                      {JSON.stringify(selectedLogForDetails.old_values || {}, null, 2)}
                    </pre>
                  </div>

                  <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-1">
                    <span className="font-bold text-[10px] text-emerald-400 uppercase tracking-wider block">New State</span>
                    <pre className="font-mono text-[11px] text-neutral-300 whitespace-pre-wrap break-all">
                      {JSON.stringify(selectedLogForDetails.new_values || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#141518] border-t border-amber-500/20 flex justify-end">
              <button
                onClick={() => setSelectedLogForDetails(null)}
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold rounded-xl text-xs tracking-wide shadow-[0_0_15px_rgba(212,175,55,0.25)] transition cursor-pointer"
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