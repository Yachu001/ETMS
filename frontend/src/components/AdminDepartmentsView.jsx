// frontend/src/components/AdminDepartmentsView.jsx

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  Search, 
  ChevronRight, 
  Layers,
  ArrowRight
} from 'lucide-react';
import api from '../api/axios';

export default function AdminDepartmentsView({ onSelectUser }) {
  const [departmentsData, setDepartmentsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptMembers, setSelectedDeptMembers] = useState(null);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const fetchDepartmentsSummary = async () => {
    setLoading(true);
    try {
      const res = await api.get('/tasks/dashboard/departments-summary/');
      setDepartmentsData(res.data || []);
    } catch (err) {
      console.error('Failed to load departments operational summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartmentsSummary();
  }, []);

  const handleInspectDepartment = async (dept) => {
    setLoadingMembers(true);
    try {
      // Fetch users scoped to this specific department
      const res = await api.get(`/auth/employees/manage/?department_id=${dept.id}`);
      setSelectedDeptMembers({
        department: dept,
        members: res.data || []
      });
    } catch (err) {
      console.error('Failed to inspect department members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  // Aggregated KPI Computations
  const totalUsers = departmentsData.reduce((acc, d) => acc + (d.total_users || 0), 0);
  const totalPresent = departmentsData.reduce((acc, d) => acc + (d.present_users || 0), 0);
  const totalIdle = departmentsData.reduce((acc, d) => acc + (d.idle_users_count || 0), 0);
  const totalActiveTasks = departmentsData.reduce((acc, d) => acc + (d.active_tasks_count || 0), 0);
  
  const avgOrgProgress = departmentsData.length > 0
    ? Math.round(departmentsData.reduce((acc, d) => acc + (d.avg_progress || 0), 0) / departmentsData.length)
    : 0;

  const filteredDepts = departmentsData.filter((d) =>
    (d.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center text-xs text-blue-600 font-mono font-semibold animate-pulse shadow-[0_8px_25px_rgba(15,23,42,0.05)]">
        Loading operational metrics across departments...
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-800">
      {/* 4-Card Executive KPI Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Attendance Capacity */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
              Attendance Ratio
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
              {totalPresent} <span className="text-xs font-normal text-slate-400">/ {totalUsers}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Present vs Total Headcount</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 hidden sm:flex items-center justify-center shrink-0">
            <Users size={19} />
          </div>
        </div>

        {/* Idle Staff Notice */}
        <div className={`p-4 sm:p-5 rounded-3xl border shadow-[0_8px_25px_rgba(15,23,42,0.05)] flex items-center justify-between transition ${
          totalIdle > 0 
            ? 'bg-gradient-to-b from-amber-50/90 to-white border-amber-200 shadow-[0_10px_25px_rgba(245,158,11,0.08)]' 
            : 'bg-white border-slate-200/90'
        }`}>
          <div>
            <span className={`text-[11px] font-bold uppercase tracking-wider block ${totalIdle > 0 ? 'text-amber-700' : 'text-blue-600'}`}>
              Total Idle
            </span>
            <div className={`text-2xl font-bold mt-1 font-mono ${totalIdle > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
              {totalIdle}
            </div>
            <p className={`text-[11px] mt-0.5 ${totalIdle > 0 ? 'text-amber-700/80' : 'text-slate-500'}`}>
              Present with 0 commitments
            </p>
          </div>
          <div className={`w-11 h-11 rounded-2xl hidden sm:flex items-center justify-center shrink-0 border ${
            totalIdle > 0 
              ? 'bg-amber-100/80 border-amber-200 text-amber-600' 
              : 'bg-blue-50 border-blue-100 text-blue-600'
          }`}>
            <AlertTriangle size={19} />
          </div>
        </div>

        {/* Active Tasks In-Flight */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
              Active Daily Work
            </span>
            <div className="text-2xl font-bold text-blue-700 font-mono mt-1">{totalActiveTasks}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Committed across organization</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 hidden sm:flex items-center justify-center shrink-0">
            <Layers size={19} />
          </div>
        </div>

        {/* Average Progress */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
              Avg Progress
            </span>
            <div className="text-2xl font-bold text-emerald-600 font-mono mt-1">{avgOrgProgress}%</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Org-wide task progression</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 hidden sm:flex items-center justify-center shrink-0">
            <TrendingUp size={19} />
          </div>
        </div>
      </div>

      {/* Selected Department Drill-down Drawer / Modal */}
      {selectedDeptMembers && (
        <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-blue-200 p-5 sm:p-6 shadow-[0_12px_30px_rgba(37,99,235,0.08)] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
            <div>
              <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">Department Inspection</span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                {selectedDeptMembers.department.name} &mdash; Member Roster
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDeptMembers(null)}
              className="text-xs text-slate-600 hover:text-slate-900 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-xl font-semibold transition cursor-pointer"
            >
              Close Inspection
            </button>
          </div>

          {loadingMembers ? (
            <div className="text-center py-6 text-xs text-blue-600 font-medium">Loading department members...</div>
          ) : selectedDeptMembers.members.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">No active members found in this department.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {selectedDeptMembers.members.map((m) => (
                <div
                  key={m.id}
                  onClick={() => onSelectUser(m.id)}
                  className="p-3.5 rounded-2xl border border-slate-200/90 bg-slate-50/60 hover:bg-white hover:border-blue-300 hover:shadow-[0_6px_18px_rgba(37,99,235,0.07)] transition cursor-pointer flex items-center justify-between group"
                >
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-700 transition">
                      {m.full_name || m.username}
                    </h4>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {m.designation || 'Staff'} &bull; {m.role}
                    </p>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                      Lead: {m.manager_name || 'Unassigned'}
                    </span>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-blue-600 shrink-0 transition" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white/95 backdrop-blur-md p-4 rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search functional department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none bg-slate-50/70 focus:bg-white text-slate-900 placeholder:text-slate-400 transition"
          />
        </div>
        <div className="text-xs text-slate-500 font-semibold font-mono">
          Showing {filteredDepts.length} Department Branches
        </div>
      </div>

      {/* Departments Summary Table / Responsive Card Stack */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] overflow-hidden">
        {/* Desktop View Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/90 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">Staff Count</th>
                <th className="py-3.5 px-4">Present Today</th>
                <th className="py-3.5 px-4">Idle Count</th>
                <th className="py-3.5 px-4">Committed Work</th>
                <th className="py-3.5 px-4">Avg Progress</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDepts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-400">
                    No departments found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredDepts.map((d) => (
                  <tr key={d.id} className="hover:bg-blue-50/40 transition duration-150">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {d.name}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">
                      {d.total_users} members
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[11px]">
                        <CheckCircle2 size={11} className="text-emerald-600" /> {d.present_users}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {d.idle_users_count > 0 ? (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full text-[11px] animate-pulse">
                          <AlertTriangle size={11} className="text-amber-600" /> {d.idle_users_count} Idle
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                      {d.active_tasks_count} active
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 font-mono">{d.avg_progress}%</span>
                        <div className="w-16 bg-slate-100 border border-slate-200/80 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-blue-600 to-emerald-500 h-full rounded-full" 
                            style={{ width: `${Math.min(d.avg_progress, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleInspectDepartment(d)}
                        className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold border border-blue-200 transition inline-flex items-center gap-1 cursor-pointer"
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

        {/* Mobile View Card Stack */}
        <div className="grid grid-cols-1 divide-y divide-slate-100 md:hidden">
          {filteredDepts.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">No departments found.</div>
          ) : (
            filteredDepts.map((d) => (
              <div key={d.id} className="p-4 space-y-3 hover:bg-blue-50/30 transition">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{d.name}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{d.total_users} staff assigned</p>
                  </div>
                  {d.idle_users_count > 0 ? (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      {d.idle_users_count} Idle
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Optimal
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs py-2 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Present</span>
                    <strong className="text-slate-900 font-mono">{d.present_users}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Active</span>
                    <strong className="text-blue-700 font-mono">{d.active_tasks_count}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Progress</span>
                    <strong className="text-emerald-600 font-mono">{d.avg_progress}%</strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleInspectDepartment(d)}
                  className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-xl border border-blue-200 transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  Inspect Department Roster <ArrowRight size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}