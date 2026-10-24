import React, { useState } from 'react';
import api from '../api/axios';
import { 
  History, 
  Search, 
  Clock, 
  ArrowRight, 
  RefreshCw,
  User
} from 'lucide-react';

// Lightweight styled Tooltip helper component with elevated z-index & fixed positioning support
function CellTooltip({ text, children, maxWidth = 'max-w-xs', position = 'top' }) {
  const [show, setShow] = useState(false);
  if (!text) return <>{children}</>;

  const positionClasses = {
    top: 'bottom-full left-0 mb-2',
    bottom: 'top-full left-0 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-4 border-t-slate-900 border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-4 border-b-slate-900 border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-900 border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-900 border-y-transparent border-l-transparent',
  };

  return (
    <div 
      className="relative inline-block max-w-full"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className={`absolute z-[9999] pointer-events-none transition-all duration-150 drop-shadow-2xl ${positionClasses[position]}`}>
          <div className={`bg-slate-900 text-slate-100 text-[11px] font-medium leading-relaxed px-3 py-1.5 rounded-lg border border-slate-800 ${maxWidth} break-words whitespace-normal text-left`}>
            {text}
          </div>
          <div className={`w-0 h-0 border-4 absolute ${arrowClasses[position]}`} />
        </div>
      )}
    </div>
  );
}

export default function AuditLogViewer({ currentUser }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState('all');

  const isBaseEmployee = currentUser?.role === 'EMPLOYEE';

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (dateRange !== 'all') params.range = dateRange;
      
      const res = await api.get('/tasks/audit-logs/', { params });
      setLogs(res.data || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchAuditLogs();
  }, [statusFilter, dateRange]);

  // Client-side search filter
  const filteredLogs = logs.filter((log) => {
    const term = searchTerm.toLowerCase();
    const taskMatch = log.task_title?.toLowerCase().includes(term);
    const actorMatch = log.actor_username?.toLowerCase().includes(term);
    const creatorMatch = log.created_by_username?.toLowerCase().includes(term);
    return taskMatch || actorMatch || creatorMatch;
  });

  // Date and Time splitter: Date on top, Time below (no microseconds)
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
    const map = {
      REQUEST_PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
      ACCEPTED: 'bg-slate-100 text-slate-700 border-slate-300',
      IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
      ON_HOLD: 'bg-rose-50 text-rose-700 border-rose-200',
      AWAITING_VERIFICATION: 'bg-purple-50 text-purple-700 border-purple-200',
      VERIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      REJECTED: 'bg-rose-100 text-rose-800 border-rose-300',
      CANCELLED: 'bg-slate-200 text-slate-700 border-slate-300',
    };
    return map[status] || 'bg-slate-50 text-slate-600 border-slate-200';
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <History className="text-blue-600" size={18} />
            Task Audit Trail & System Activity
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isBaseEmployee 
              ? 'Showing up to the latest 100 historical lifecycle events for your tasks.' 
              : 'Showing chronological changes for subordinate and personal tasks.'}
          </p>
        </div>

        <button
          onClick={fetchAuditLogs}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-slate-600 border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition cursor-pointer"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by task title, actor..."
            className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="">All Status Transitions</option>
            <option value="REQUEST_PENDING">Request Pending</option>
            <option value="ACCEPTED">Not Started / Accepted</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="AWAITING_VERIFICATION">Awaiting Verification</option>
            <option value="VERIFIED">Verified / Completed</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="all">All Dates</option>
            <option value="today">Today Only</option>
            <option value="last_7_days">Last 7 Days</option>
            <option value="last_30_days">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table (overflow-x-auto without clipping children vertically) */}
      <div className="border border-slate-200 rounded-xl shadow-2xs">
        <div className="overflow-x-auto min-h-[300px] pb-6">
          <table className="w-full text-left text-xs table-fixed">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 w-36">Date & Time</th>
                <th className="py-3 px-4 w-52">Task Details</th>
                <th className="py-3 px-4 w-36">Performed By</th>
                <th className="py-3 px-4 w-44">Status Transition</th>
                <th className="py-3 px-4 w-28">Progress Delta</th>
                <th className="py-3 px-4 min-w-[200px]">Remarks & Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-400">
                    Loading audit trail records...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-400">
                    No matching activity logs found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isAssignedBySelf = 
                    Boolean(currentUser?.id && log.created_by_id === currentUser.id) ||
                    log.created_by_username === currentUser?.username;

                  const assignerDisplay = isAssignedBySelf 
                    ? 'Self' 
                    : formatShortDisplayName(log.created_by_full_name, log.created_by_username || 'Authority');

                  const assigneeDisplay = formatShortDisplayName(log.assigned_to_full_name, log.assigned_to_username || 'Assignee');
                  const actorDisplay = formatShortDisplayName(log.actor_full_name, log.actor_username || 'System');
                  const { date, time } = formatDateTimeParts(log);

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition group">
                      
                      {/* COL 1: Date & Time */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                        <div className="font-semibold text-slate-800">{date}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock size={11} className="text-slate-400 shrink-0" />
                          <span>{time}</span>
                        </div>
                      </td>

                      {/* COL 2: Task Details (Relative container without overflow-hidden on <td>) */}
                      <td className="py-3 px-4 relative">
                        <CellTooltip text={log.task_title} position="top" maxWidth="max-w-sm">
                          <div className="font-bold text-slate-900 truncate max-w-[190px] cursor-pointer hover:text-blue-600 transition">
                            {log.task_title}
                          </div>
                        </CellTooltip>
                        
                        <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 max-w-[190px]">
                          {isBaseEmployee || isAssignedBySelf ? (
                            <>
                              <span className="text-slate-400 shrink-0">Assigned by:</span>
                              <span className={`font-semibold truncate ${isAssignedBySelf ? 'text-blue-600' : 'text-slate-700'}`}>
                                {assignerDisplay}
                              </span>
                            </>
                          ) : (
                            <CellTooltip text={`${assignerDisplay} assigned this task to ${assigneeDisplay}`} position="bottom">
                              <span className="truncate text-slate-700 cursor-pointer">
                                <strong className={isAssignedBySelf ? 'text-blue-600' : 'text-slate-800'}>{assignerDisplay}</strong>
                                <span className="text-slate-400 mx-1">→</span>
                                <span className="text-slate-600">{assigneeDisplay}</span>
                              </span>
                            </CellTooltip>
                          )}
                        </div>
                      </td>

                      {/* COL 3: Performed By */}
                      <td className="py-3 px-4 whitespace-nowrap relative">
                        <CellTooltip text={`Action executed by: ${log.actor_username || 'System'}`} position="top">
                          <div className="flex items-center gap-1.5 text-slate-700 font-medium truncate max-w-[130px] cursor-pointer">
                            <User size={13} className="text-slate-400 shrink-0" />
                            <span className="truncate">{actorDisplay}</span>
                          </div>
                        </CellTooltip>
                      </td>

                      {/* COL 4: Status Transition */}
                      <td className="py-3 px-4 whitespace-nowrap relative">
                        <div className="flex items-center gap-1.5 text-[11px] max-w-[170px]">
                          {log.old_status && (
                            <>
                              <span className="text-slate-400 truncate max-w-[65px]" title={log.old_status}>
                                {log.old_status}
                              </span>
                              <ArrowRight size={11} className="text-slate-300 shrink-0" />
                            </>
                          )}
                          <CellTooltip text={`Transitioned to: ${log.new_status}`} position="top">
                            <span className={`px-2 py-0.5 rounded border text-[10px] font-semibold truncate max-w-[85px] cursor-pointer ${getStatusBadge(log.new_status)}`}>
                              {log.new_status}
                            </span>
                          </CellTooltip>
                        </div>
                      </td>

                      {/* COL 5: Progress Delta */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs">
                        <span className="text-slate-500">{log.old_progress}%</span>
                        <span className="text-slate-400 mx-1">→</span>
                        <span className={`font-bold ${log.new_progress > log.old_progress ? 'text-emerald-600' : 'text-blue-600'}`}>
                          {log.new_progress}%
                        </span>
                      </td>

                      {/* COL 6: Remarks & Notes */}
                      <td className="py-3 px-4 relative">
                        {log.remarks ? (
                          <CellTooltip text={log.remarks} position="left" maxWidth="max-w-md">
                            <div className="text-slate-600 text-[11px] truncate max-w-[280px] cursor-pointer bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded px-2 py-1 transition">
                              {log.remarks}
                            </div>
                          </CellTooltip>
                        ) : (
                          <span className="text-slate-300 italic text-[11px]">—</span>
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
    </div>
  );
}