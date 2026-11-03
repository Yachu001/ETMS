import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Users, 
  Building2, 
  Building, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  UserCheck, 
  RefreshCw,
  Search
} from 'lucide-react';
import api from '../api/axios';

export default function MatrixDrilldownView({ currentUser, onSelectUser }) {
  const [matrixData, setMatrixData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMatrixId, setExpandedMatrixId] = useState(null);

  const fetchMatrixData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/tasks/matrix-overview/');
      setMatrixData(res.data || []);
      // Auto-expand first branch if list has items
      if (res.data?.length > 0 && !expandedMatrixId) {
        setExpandedMatrixId(res.data[0].id);
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
  const totalWorking = matrixData.reduce((acc, m) => acc + (m.working_count || 0), 0);
  const totalIdle = matrixData.reduce((acc, m) => acc + (m.idle_count || 0), 0);

  const filteredMatrices = matrixData.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchesName = (m.name || '').toLowerCase().includes(q) || (m.code || '').toLowerCase().includes(q);
    const matchesLead = (m.supervisor_name || '').toLowerCase().includes(q);
    const matchesMembers = (m.members || []).some(mem => (mem.name || '').toLowerCase().includes(q));
    return matchesName || matchesLead || matchesMembers;
  });

  return (
    <div className="space-y-5">
      {/* 1. Header & Live Scope KPI Summary */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
              {currentUser.role === 'BUSINESS_ADMIN' ? 'Business Operations Cockpit' : 'Department Operations Cockpit'}
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              {currentUser.role === 'BUSINESS_ADMIN' 
                ? `Operational Matrix Branches • ${currentUser.business_name || 'My Business'}`
                : `Operational Matrix Branches • ${currentUser.department_name || 'My Department'}`}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review live attendance, active commitments, and drill down into individual team member cockpits.
            </p>
          </div>

          <button
            onClick={fetchMatrixData}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Aggregate KPI Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Branches</span>
            <span className="text-base font-bold text-slate-900 mt-0.5 block">{totalBranches}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Staff</span>
            <span className="text-base font-bold text-slate-900 mt-0.5 block">{totalStaff}</span>
          </div>

          <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200">
            <span className="text-[10px] text-emerald-700 font-bold uppercase block">On-Duty</span>
            <span className="text-base font-bold text-emerald-800 mt-0.5 block">{totalPresent}</span>
          </div>

          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200">
            <span className="text-[10px] text-blue-700 font-bold uppercase block">Committed Tasks</span>
            <span className="text-base font-bold text-blue-800 mt-0.5 block">{totalWorking}</span>
          </div>

          <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-200 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-rose-700 font-bold uppercase block">Idle Warnings</span>
            <span className="text-base font-bold text-rose-800 mt-0.5 block">{totalIdle}</span>
          </div>
        </div>
      </div>

      {/* 2. Search Filter */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search branch code, supervisor, member..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
          />
        </div>
        <span className="text-xs text-slate-400 hidden sm:inline">
          Showing {filteredMatrices.length} of {matrixData.length} branches
        </span>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. Matrix Branches Accordion Roster */}
      {loading ? (
        <div className="bg-white p-12 text-center text-xs text-slate-400 border border-slate-200 rounded-2xl shadow-2xs">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
          Loading scoped matrix branches...
        </div>
      ) : filteredMatrices.length === 0 ? (
        <div className="bg-white p-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
          No matrix branches found matching your search.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMatrices.map((matrix) => {
            const isExpanded = expandedMatrixId === matrix.id;

            return (
              <div 
                key={matrix.id} 
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition"
              >
                {/* Branch Header Row */}
                <div 
                  onClick={() => setExpandedMatrixId(isExpanded ? null : matrix.id)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 select-none"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-600 shrink-0">
                      <Layers size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm">
                          {matrix.name}
                        </h3>
                        <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {matrix.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <UserCheck size={13} className="text-indigo-600" />
                          Lead: {matrix.supervisor_name}
                        </span>
                        <span>&bull;</span>
                        <span className="text-slate-400">
                          {matrix.business_name} &rarr; {matrix.department_name}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Branch Metrics & Expand Indicator */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 self-stretch sm:self-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px]" title="Total Members">
                        {matrix.total_members} Staff
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold text-[11px]" title="On Duty">
                        {matrix.present_count} Present
                      </span>
                      {matrix.idle_count > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px] flex items-center gap-1">
                          <AlertTriangle size={11} /> {matrix.idle_count} Idle
                        </span>
                      )}
                    </div>

                    <button 
                      type="button"
                      className="p-1 hover:bg-slate-200/60 rounded-lg text-slate-400 text-slate-600"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Branch Member Roster */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                      <span>Branch Personnel ({matrix.members?.length || 0})</span>
                      <span className="text-slate-400 normal-case font-normal text-[11px]">
                        Click any member to open their task cockpit &rarr;
                      </span>
                    </div>

                    {(!matrix.members || matrix.members.length === 0) ? (
                      <div className="p-4 bg-white border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                        No base employees assigned to this matrix branch.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {matrix.members.map((member) => (
                          <div 
                            key={member.id}
                            onClick={() => onSelectUser && onSelectUser(member.id)}
                            className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition cursor-pointer flex items-center justify-between group"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5">
                                <h4 className="font-bold text-slate-900 text-xs truncate group-hover:text-indigo-600 transition">
                                  {member.name}
                                </h4>
                                {member.is_present ? (
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" title="Present / On-Duty" />
                                ) : (
                                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0" title="Offline / Leave" />
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                {member.designation || 'Staff'} &bull; {member.role}
                              </p>
                              {member.is_idle ? (
                                <span className="inline-block mt-1 text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded">
                                  Idle (0 Tasks Committed)
                                </span>
                              ) : member.is_present ? (
                                <span className="inline-block mt-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                  Active On-Duty
                                </span>
                              ) : null}
                            </div>

                            <button 
                              type="button" 
                              className="p-1 text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 rounded-lg transition"
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}