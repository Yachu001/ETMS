// frontend/src/components/MatrixDrilldownView.jsx

import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Users, 
  UserCheck, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ChevronRight, 
  ArrowLeft,
  RefreshCw,
  Search,
  Eye,
  ShieldAlert,
  Building2
} from 'lucide-react';
import api from '../api/axios';

export default function MatrixDrilldownView({ currentUser, onSelectUser }) {
  const [matrixData, setMatrixData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMatrix, setSelectedMatrix] = useState(null);

  const fetchMatrixData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/tasks/matrix-overview/');
      setMatrixData(res.data || []);
      // If a matrix was already selected, refresh its data in place
      if (selectedMatrix) {
        const updated = (res.data || []).find((m) => m.id === selectedMatrix.id);
        if (updated) setSelectedMatrix(updated);
      }
    } catch (err) {
      console.error('Failed to load matrix overview:', err);
      setError(err.response?.data?.detail || 'Failed to fetch matrix branch records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrixData();
  }, [currentUser]);

  // Overall Scope Metrics Aggregation
  const totalBranches = matrixData.length;
  const totalStaff = matrixData.reduce((acc, m) => acc + (m.total_members || 0), 0);
  const totalPresent = matrixData.reduce((acc, m) => acc + (m.present_count || 0), 0);
  const totalCommits = matrixData.reduce((acc, m) => acc + (m.daily_commits_count || m.working_count || 0), 0);
  const totalOverdues = matrixData.reduce((acc, m) => acc + (m.overdues_count || 0), 0);
  const totalIdle = matrixData.reduce((acc, m) => acc + (m.idle_count || 0), 0);

  const filteredMatrices = matrixData.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchesName = (m.name || '').toLowerCase().includes(q) || (m.code || '').toLowerCase().includes(q);
    const matchesLead = (m.supervisor_name || '').toLowerCase().includes(q);
    return matchesName || matchesLead;
  });

  return (
    <div className="space-y-5">
      {/* 1. Header & Live Scope KPI Summary */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
              {currentUser?.role === 'BUSINESS_ADMIN' ? 'Business Operations Cockpit' : 'Department Operations Cockpit'}
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              {currentUser?.role === 'BUSINESS_ADMIN' 
                ? `Operational Matrix Branches • ${currentUser.business_name || 'My Business'}`
                : `Operational Matrix Branches • ${currentUser.department_name || 'My Department'}`}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review live attendance, daily commit ratios, overdue tasks, and drill down into individual personnel.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchMatrixData}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* 5-Card Metric Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Branches</span>
            <span className="text-base font-bold text-slate-900 mt-0.5 block">{totalBranches}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Members</span>
            <span className="text-base font-bold text-slate-900 mt-0.5 block">
              <span className="text-emerald-600">{totalPresent}</span>
              <span className="text-slate-400 text-xs font-normal"> / {totalStaff}</span>
            </span>
          </div>

          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200">
            <span className="text-[10px] text-blue-700 font-bold uppercase block">Daily Commits</span>
            <span className="text-base font-bold text-blue-800 mt-0.5 block">{totalCommits}</span>
          </div>

          <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-200">
            <span className="text-[10px] text-rose-700 font-bold uppercase block">Overdues</span>
            <span className="text-base font-bold text-rose-800 mt-0.5 block">{totalOverdues}</span>
          </div>

          <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-amber-800 font-bold uppercase block">Idle Users</span>
            <span className="text-base font-bold text-amber-800 mt-0.5 block">{totalIdle}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Main Content: Branches Table vs Drill-Down Roster */}
      {!selectedMatrix ? (
        /* =================== VIEW 1: MATRIX BRANCHES TABLE =================== */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-3">
          {/* Search Toolbar */}
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
            <div className="relative w-full max-w-sm">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search branch code, name, supervisor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
              />
            </div>
            <span className="text-xs text-slate-400 hidden sm:inline">
              Showing {filteredMatrices.length} of {matrixData.length} branches
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Matrix Name</th>
                  <th className="py-3 px-4">Incharge</th>
                  <th className="py-3 px-4 text-center">Present / Active Users</th>
                  <th className="py-3 px-4 text-center">Daily Commits / Total Active</th>
                  <th className="py-3 px-4 text-center">Overdues</th>
                  <th className="py-3 px-4 text-center">Idle Users</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                      Loading matrix branches...
                    </td>
                  </tr>
                ) : filteredMatrices.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400">
                      No matrix branches found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredMatrices.map((matrix) => (
                    <tr key={matrix.id} className="hover:bg-slate-50/70 transition">
                      {/* Matrix Name & Code */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{matrix.name}</div>
                        <div className="font-mono text-[10px] text-slate-400">{matrix.code}</div>
                      </td>

                      {/* Appointed Incharge */}
                      <td className="py-3 px-4 font-medium text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <UserCheck size={14} className="text-indigo-600 shrink-0" />
                          <span>{matrix.supervisor_name || 'Unassigned Lead'}</span>
                        </div>
                      </td>

                      {/* Present / Active Users */}
                      <td className="py-3 px-4 text-center font-mono font-semibold">
                        <span className="text-emerald-700">{matrix.present_count || 0}</span>
                        <span className="text-slate-400 font-normal"> / {matrix.total_members || 0}</span>
                      </td>

                      {/* Daily Commits / Total Active Tasks */}
                      <td className="py-3 px-4 text-center font-mono font-semibold">
                        <span className="text-blue-700">{matrix.daily_commits_count || matrix.working_count || 0}</span>
                        <span className="text-slate-400 font-normal"> / {matrix.total_active_tasks || 0}</span>
                      </td>

                      {/* Overdues Count */}
                      <td className="py-3 px-4 text-center">
                        {(matrix.overdues_count || 0) > 0 ? (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-50 border border-rose-200 text-rose-700">
                            {matrix.overdues_count} Overdue
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">0</span>
                        )}
                      </td>

                      {/* Idle Users Count */}
                      <td className="py-3 px-4 text-center">
                        {(matrix.idle_count || 0) > 0 ? (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 border border-amber-300 text-amber-800 animate-pulse">
                            {matrix.idle_count} Idle
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">0</span>
                        )}
                      </td>

                      {/* Drill-Down Action Button */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedMatrix(matrix)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-lg border border-indigo-200 transition cursor-pointer"
                        >
                          <Eye size={13} /> View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* =================== VIEW 2: DRILL-DOWN MATRIX ROSTER =================== */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-4 p-5 animate-in fade-in duration-150">
          {/* Drill-down Navigation & Title Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedMatrix(null)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition cursor-pointer"
              >
                <ArrowLeft size={14} /> Back to Branches
              </button>
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Layers size={16} className="text-indigo-600" />
                  {selectedMatrix.name} — Personnel Roster
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Supervisor pinned at Row #1 • Click any user to inspect personal task cockpit
                </p>
              </div>
            </div>

            <span className="text-xs font-mono text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
              {selectedMatrix.roster?.length || 0} Total Members
            </span>
          </div>

          {/* Unified Roster Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Member Name</th>
                  <th className="py-3 px-4">Designation & Role</th>
                  <th className="py-3 px-4">
                    Activity Status
                    <span className="text-[10px] text-slate-400 lowercase font-normal ml-1">
                      (active • present • commits)
                    </span>
                  </th>
                  <th className="py-3 px-4 text-center">Active Backlog Tasks</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!selectedMatrix.roster || selectedMatrix.roster.length === 0) ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-400">
                      No personnel assigned to this matrix branch.
                    </td>
                  </tr>
                ) : (
                  selectedMatrix.roster.map((member, idx) => {
                    const isSupervisor = Boolean(member.is_supervisor);
                    const isPresent = Boolean(member.is_present);
                    const activeCount = member.active_tasks_count || 0;
                    const isIdle = isPresent && activeCount === 0;

                    return (
                      <tr 
                        key={member.id} 
                        className={`transition hover:bg-slate-50/70 ${
                          isSupervisor ? 'bg-indigo-50/30 font-medium' : ''
                        }`}
                      >
                        {/* Member Name with Supervisor Pin Pin Indicator */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {isSupervisor ? (
                              <span className="px-1.5 py-0.5 bg-indigo-600 text-white font-bold text-[9px] rounded uppercase tracking-wider">
                                Incharge
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono text-[10px]">#{idx + 1}</span>
                            )}
                            <div>
                              <span className="font-bold text-slate-900">{member.name}</span>
                              <span className="text-slate-400 text-[10px] block font-mono">@{member.username}</span>
                            </div>
                          </div>
                        </td>

                        {/* Designation & Role Badge */}
                        <td className="py-3 px-4 text-slate-600">
                          <div>{member.designation || 'Staff Member'}</div>
                          <div className="text-[10px] text-slate-400">{member.role}</div>
                        </td>

                        {/* Sequential 3-Dot Status Indicator */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {/* Dot 1: Active */}
                            <div className="flex items-center gap-1" title="User is Active">
                              <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                              </span>
                              <span className="text-[10px] text-slate-500">Active</span>
                            </div>

                            <span className="text-slate-300">•</span>

                            {/* Dot 2: Present */}
                            <div className="flex items-center gap-1" title={isPresent ? 'On Duty' : 'On Leave'}>
                              {isPresent ? (
                                <>
                                  <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                  </span>
                                  <span className="text-[10px] text-emerald-700 font-semibold">Present</span>
                                </>
                              ) : (
                                <>
                                  <span className="h-2 w-2 rounded-full bg-slate-300"></span>
                                  <span className="text-[10px] text-slate-400">On Leave</span>
                                </>
                              )}
                            </div>

                            <span className="text-slate-300">•</span>

                            {/* Dot 3: Work / Commits Indicator */}
                            <div className="flex items-center gap-1" title={isIdle ? '0 Commits (Idle)' : 'Active Work'}>
                              {!isPresent ? (
                                <>
                                  <span className="h-2 w-2 rounded-full bg-slate-200"></span>
                                  <span className="text-[10px] text-slate-400">Offline</span>
                                </>
                              ) : isIdle ? (
                                <>
                                  <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                                  </span>
                                  <span className="text-[10px] text-rose-600 font-bold">Idle</span>
                                </>
                              ) : (
                                <>
                                  <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
                                  </span>
                                  <span className="text-[10px] text-blue-700 font-semibold">Working</span>
                                </>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Active Backlog Tasks Count */}
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                          {activeCount}
                        </td>

                        {/* Drill-Down Action Button */}
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => onSelectUser && onSelectUser(member.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition cursor-pointer"
                          >
                            Inspect Cockpit <ChevronRight size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}