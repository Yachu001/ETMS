import React, { useState, useEffect } from 'react';
import { 
  Users, UserCheck, AlertTriangle, ListTodo, Search, 
  ChevronRight, Clock, CheckCircle2
} from 'lucide-react';
import api from '../api/axios';

export default function SupervisorTeamView({ onSelectUser }) {
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'IDLE' | 'ON_LEAVE'

  const fetchTeamOverview = async () => {
    setLoading(true);
    try {
      const res = await api.get('/tasks/dashboard/team-overview/');
      setTeamData(res.data);
    } catch (err) {
      console.error('Failed to load team overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamOverview();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-400">
        Loading team metrics and daily workload...
      </div>
    );
  }

  if (!teamData) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-rose-500">
        Failed to retrieve team overview data.
      </div>
    );
  }

  const {
    total_team = 0,
    present_count = 0,
    committed_count = 0,
    idle_count = 0,
    on_leave_count = 0,
    members = []
  } = teamData;

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      (m.username || '').toLowerCase().includes(q) ||
      (m.designation || '').toLowerCase().includes(q) ||
      (m.department || '').toLowerCase().includes(q);

    if (filterMode === 'ACTIVE') return matchesSearch && m.load_status === 'ACTIVE';
    if (filterMode === 'IDLE') return matchesSearch && m.load_status === 'IDLE';
    if (filterMode === 'ON_LEAVE') return matchesSearch && m.load_status === 'ON_LEAVE';
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* 4-Card Team KPI Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Team</span>
            <Users size={18} className="text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{total_team}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Assigned matrix staff</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">On-Duty</span>
            <UserCheck size={18} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{present_count}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">{on_leave_count} on leave today</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Committed</span>
            <ListTodo size={18} className="text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600">{committed_count}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Active morning planners</p>
        </div>

        <div className={`p-4 sm:p-5 rounded-2xl border shadow-2xs transition ${
          idle_count > 0 
            ? 'bg-amber-50/70 border-amber-200' 
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Idle Alert
            </span>
            <AlertTriangle size={18} className={idle_count > 0 ? 'text-amber-600' : 'text-slate-400'} />
          </div>
          <div className={`text-2xl font-bold ${idle_count > 0 ? 'text-amber-700 font-mono' : 'text-slate-800'}`}>
            {idle_count}
          </div>
          <p className="text-[11px] text-amber-700/80 mt-0.5">Present with 0 commitments</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search subordinate name, designation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden bg-slate-50/40"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { key: 'ALL', label: 'All Staff' },
            { key: 'ACTIVE', label: 'Active Work' },
            { key: 'IDLE', label: 'Idle Staff' },
            { key: 'ON_LEAVE', label: 'On Leave' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterMode(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                filterMode === tab.key
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Member Roster Card / Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Designation</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Duty Status</th>
                <th className="py-3 px-4">Daily Commitments</th>
                <th className="py-3 px-4">Primary Work Item</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-400">
                    No team members found matching your search.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => (
                  <tr 
                    key={m.id} 
                    className={`hover:bg-slate-50/70 transition ${m.is_idle ? 'bg-amber-50/30' : ''}`}
                  >
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {m.username}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-medium">
                      {m.designation || 'Staff'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-medium">
                      {m.department || 'General'}
                    </td>
                    <td className="py-3 px-4">
                      {m.is_present ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                          <CheckCircle2 size={12} /> Present
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                          <Clock size={12} /> On Leave
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {m.is_idle ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full animate-pulse">
                          <AlertTriangle size={12} /> 0 Commits (Idle)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full font-mono">
                          {m.active_daily_tasks} Committed
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-700">
                      {m.primary_task_title}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onSelectUser(m.id)}
                        className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold border border-blue-200 transition inline-flex items-center gap-1 cursor-pointer"
                      >
                        Inspect <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card Stack */}
        <div className="grid grid-cols-1 divide-y divide-slate-100 md:hidden">
          {filteredMembers.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">No team members found.</div>
          ) : (
            filteredMembers.map((m) => (
              <div 
                key={m.id} 
                className={`p-4 space-y-2.5 ${m.is_idle ? 'bg-amber-50/40' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{m.username}</h4>
                    <p className="text-[11px] text-slate-400">{m.designation || 'Staff'} • {m.department}</p>
                  </div>
                  {m.is_idle ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                      Idle
                    </span>
                  ) : m.is_present ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Working
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      Offline
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-600">
                  <span className="text-slate-400">Current Work: </span>
                  <span className="font-medium">{m.primary_task_title}</span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-mono text-slate-500">
                    {m.active_daily_tasks} daily task(s)
                  </span>
                  <button
                    onClick={() => onSelectUser(m.id)}
                    className="text-xs font-semibold text-blue-600 inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    Inspect Cockpit <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}