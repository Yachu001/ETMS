import React, { useState, useMemo } from 'react';
import { 
  Clock, 
  CheckCircle2, 
  Layers, 
  TrendingUp, 
  AlertCircle, 
  Filter,
  UserCheck
} from 'lucide-react';

export default function DashboardAnalyticsBanner({ tasks, currentUser, onFilterChange }) {
  // Today's date formatted as YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  // First day of current month YYYY-MM-01
  const mtdStartStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }, []);

  // Filter mode: 'MTD' | 'ALL' | 'CUSTOM'
  const [dateMode, setDateMode] = useState('MTD');
  const [fromDate, setFromDate] = useState(mtdStartStr);
  const [toDate, setToDate] = useState(todayStr);
  const [dateError, setDateError] = useState(null);

  // Validate and notify parent if necessary
  const handleDateChange = (from, to, mode) => {
    setDateError(null);
    if (mode === 'CUSTOM') {
      if (!from || !to) {
        setDateError('Both start and end dates are required.');
        return;
      }
      if (from > to) {
        setDateError('Start date must be earlier than or equal to end date.');
        return;
      }
      if (to > todayStr) {
        setDateError('End date cannot be in the future.');
        return;
      }
    }
    if (onFilterChange) {
      onFilterChange({ mode, fromDate: from, toDate: to });
    }
  };

  // Filter tasks based on selected date window (created_at date)
  const scopedTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (dateMode === 'ALL') return true;

      const taskDate = t.created_at ? t.created_at.split('T')[0] : null;
      if (!taskDate) return true;

      if (dateMode === 'MTD') {
        return taskDate >= mtdStartStr && taskDate <= todayStr;
      }
      if (dateMode === 'CUSTOM') {
        if (fromDate && taskDate < fromDate) return false;
        if (toDate && taskDate > toDate) return false;
        return true;
      }
      return true;
    });
  }, [tasks, dateMode, fromDate, toDate, mtdStartStr, todayStr]);

  // ==========================================
  // METRICS COMPUTATION (CARDS 1 - 4)
  // ==========================================
  const totalTasks = scopedTasks.length;

  // CARD 1: INTAKE & OWNERSHIP BREAKDOWN
  // Self Assigned = created_by equals assigned_to
  const selfAssignedCount = scopedTasks.filter(
    (t) => t.created_by === t.assigned_to || (currentUser && t.created_by === currentUser.id && t.assigned_to === currentUser.id)
  ).length;

  // Assigned Total = tasks delegated by managers/others
  const assignedByOthersCount = totalTasks - selfAssignedCount;

  // Acceptance & Rejection
  const acceptedCount = scopedTasks.filter((t) => 
    ['ACCEPTED', 'IN_PROGRESS', 'AWAITING_VERIFICATION', 'VERIFIED', 'ON_HOLD'].includes(t.status)
  ).length;
  const rejectedCount = scopedTasks.filter((t) => t.status === 'REJECTED').length;
  const pendingRequestsCount = scopedTasks.filter((t) => t.status === 'REQUEST_PENDING').length;

  // CARD 2: WORK BREAKDOWN (Total Accepted = In-Progress + Accepted + On-Hold)
  const startedCount = scopedTasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const notStartedCount = scopedTasks.filter((t) => t.status === 'ACCEPTED').length;
  const onHoldCount = scopedTasks.filter((t) => t.status === 'ON_HOLD').length;
  const totalAcceptedWork = startedCount + notStartedCount + onHoldCount;

  // CARD 3: COMPLETION & VERIFICATION
  const pendingVerificationCount = scopedTasks.filter((t) => t.status === 'AWAITING_VERIFICATION').length;
  const verifiedCount = scopedTasks.filter((t) => t.status === 'VERIFIED').length;
  const totalCompleted = pendingVerificationCount + verifiedCount;

  // CARD 4: VELOCITY & PROGRESS
  const activeTasks = scopedTasks.filter((t) => ['IN_PROGRESS', 'ACCEPTED'].includes(t.status));
  const activeCount = activeTasks.length;
  const activeRatio = totalTasks > 0 ? ((activeCount / totalTasks) * 100).toFixed(0) : 0;
  
  const totalActiveProgress = activeTasks.reduce((sum, t) => sum + (Number(t.progress_percentage) || 0), 0);
  const avgActiveProgress = activeCount > 0 ? (totalActiveProgress / activeCount).toFixed(1) : 0;

  return (
    <div className="space-y-4">
      {/* ================= DATE FILTER TOOLBAR ================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex flex-wrap justify-between items-center gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-slate-500" />
          <span className="font-bold text-slate-700">Metrics Timeframe:</span>

          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setDateMode('MTD');
                handleDateChange(mtdStartStr, todayStr, 'MTD');
              }}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                dateMode === 'MTD'
                  ? 'bg-white text-blue-600 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Month to Date (MTD)
            </button>
            <button
              type="button"
              onClick={() => {
                setDateMode('ALL');
                handleDateChange(null, null, 'ALL');
              }}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                dateMode === 'ALL'
                  ? 'bg-white text-blue-600 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => {
                setDateMode('CUSTOM');
                handleDateChange(fromDate, toDate, 'CUSTOM');
              }}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                dateMode === 'CUSTOM'
                  ? 'bg-white text-blue-600 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Custom Range
            </button>
          </div>
        </div>

        {/* Custom Date Pickers */}
        {dateMode === 'CUSTOM' && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px]">From:</span>
              <input
                type="date"
                max={todayStr}
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  handleDateChange(e.target.value, toDate, 'CUSTOM');
                }}
                className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px]">To:</span>
              <input
                type="date"
                max={todayStr}
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  handleDateChange(fromDate, e.target.value, 'CUSTOM');
                }}
                className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        <div className="text-[11px] text-slate-400 font-medium">
          Showing metrics for <strong>{totalTasks}</strong> tasks
        </div>
      </div>

      {dateError && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0 text-rose-500" />
          <span>{dateError}</span>
        </div>
      )}

      {/* ================= 4 KPI CARDS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* CARD 1: INTAKE & OWNERSHIP (UPDATED) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Intake & Ownership</span>
              <UserCheck size={16} className="text-blue-600" />
            </div>
            
            {/* Assigned Total vs Self Assigned */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="bg-slate-50 border border-slate-200/80 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 font-medium block">Assigned Total</span>
                <span className="text-xl font-bold text-slate-900">{assignedByOthersCount}</span>
              </div>
              <div className="bg-blue-50/60 border border-blue-100 p-2 rounded-lg">
                <span className="text-[10px] text-blue-700 font-medium block">Self Assigned</span>
                <span className="text-xl font-bold text-blue-700">{selfAssignedCount}</span>
              </div>
            </div>
          </div>

          {/* Sub-metrics: Accepted, Rejected, and Pending */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-emerald-700 font-semibold">{acceptedCount} Accepted</span>
            <span className="text-rose-600 font-semibold">{rejectedCount} Rejected</span>
            {pendingRequestsCount > 0 && (
              <span className="text-amber-600 font-medium">({pendingRequestsCount} Pending)</span>
            )}
          </div>
        </div>

        {/* CARD 2: WORK BREAKDOWN */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Work Breakdown</span>
              <Layers size={16} className="text-indigo-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-indigo-600">{totalAcceptedWork}</span>
              <span className="text-xs text-slate-400 font-medium">Total Accepted Work</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-1 text-[10px] text-center">
            <div className="bg-blue-50/70 p-1 rounded text-blue-800">
              <div className="font-bold text-xs">{startedCount}</div>
              <span>Started</span>
            </div>
            <div className="bg-slate-100 p-1 rounded text-slate-700">
              <div className="font-bold text-xs">{notStartedCount}</div>
              <span>Not Started</span>
            </div>
            <div className="bg-amber-50/70 p-1 rounded text-amber-800">
              <div className="font-bold text-xs">{onHoldCount}</div>
              <span>On Hold</span>
            </div>
          </div>
        </div>

        {/* CARD 3: COMPLETION & VERIFICATION */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Completed Tasks</span>
              <CheckCircle2 size={16} className="text-emerald-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-emerald-600">{totalCompleted}</span>
              <span className="text-xs text-slate-400 font-medium">Total Done</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-[11px]">
            <span className="text-purple-700 font-medium">{pendingVerificationCount} Pending Sign-off</span>
            <span className="text-emerald-700 font-bold">{verifiedCount} Verified</span>
          </div>
        </div>

        {/* CARD 4: VELOCITY & PROGRESS */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Velocity & Progress</span>
              <TrendingUp size={16} className="text-blue-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-blue-600">{avgActiveProgress}%</span>
              <span className="text-xs text-slate-400 font-medium">Avg Progress</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center text-[11px]">
            <span className="text-slate-500">Active Task Ratio:</span>
            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {activeRatio}% ({activeCount}/{totalTasks})
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}