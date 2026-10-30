import React, { useState, useEffect } from 'react';
import { 
  Building2, 
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
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-400">
        Loading operational metrics across departments...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 4-Card Executive KPI Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Attendance Capacity */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Attendance Ratio</span>
            <Users size={18} className="text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {totalPresent} <span className="text-xs font-normal text-slate-500">/ {totalUsers}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Present vs Total Headcount</p>
        </div>

        {/* Idle Staff Notice */}
        <div className={`p-4 sm:p-5 rounded-2xl border shadow-2xs transition ${
          totalIdle > 0 
            ? 'bg-amber-50/70 border-amber-200' 
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Total Idle
            </span>
            <AlertTriangle size={18} className={totalIdle > 0 ? 'text-amber-600' : 'text-slate-400'} />
          </div>
          <div className={`text-2xl font-bold ${totalIdle > 0 ? 'text-amber-700 font-mono' : 'text-slate-800'}`}>
            {totalIdle}
          </div>
          <p className="text-[11px] text-amber-700/80 mt-0.5">Present with 0 commitments</p>
        </div>

        {/* Active Tasks In-Flight */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Daily Work</span>
            <Layers size={18} className="text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600 font-mono">{totalActiveTasks}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Committed across organization</p>
        </div>

        {/* Average Progress */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Avg Progress</span>
            <TrendingUp size={18} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 font-mono">{avgOrgProgress}%</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Org-wide task progression</p>
        </div>
      </div>

      {/* Selected Department Drill-down Drawer / Modal */}
      {selectedDeptMembers && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">Department Inspection</span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                {selectedDeptMembers.department.name} — Member Roster
              </h3>
            </div>
            <button
              onClick={() => setSelectedDeptMembers(null)}
              className="text-xs text-slate-500 hover:text-slate-800 px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition cursor-pointer"
            >
              Close Inspection
            </button>
          </div>

          {loadingMembers ? (
            <div className="text-center py-6 text-xs text-slate-400">Loading department members...</div>
          ) : selectedDeptMembers.members.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">No active members found in this department.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {selectedDeptMembers.members.map((m) => (
                <div
                  key={m.id}
                  onClick={() => onSelectUser(m.id)}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-indigo-300 transition cursor-pointer flex items-center justify-between group"
                >
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-indigo-600">
                      {m.full_name || m.username}
                    </h4>
                    <p className="text-[11px] text-slate-500 truncate">{m.designation || 'Staff'} • {m.role}</p>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                      Lead: {m.manager_name || 'Unassigned'}
                    </span>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search functional department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden bg-slate-50/40"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Showing {filteredDepts.length} Department Branches
        </div>
      </div>

      {/* Departments Summary Table / Responsive Card Stack */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Desktop View Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Staff Count</th>
                <th className="py-3 px-4">Present Today</th>
                <th className="py-3 px-4">Idle Count</th>
                <th className="py-3 px-4">Committed Work</th>
                <th className="py-3 px-4">Avg Progress</th>
                <th className="py-3 px-4 text-right">Actions</th>
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
                  <tr key={d.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {d.name}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {d.total_users} members
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[11px]">
                        <CheckCircle2 size={11} /> {d.present_users}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {d.idle_users_count > 0 ? (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full text-[11px] animate-pulse">
                          <AlertTriangle size={11} /> {d.idle_users_count} Idle
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                      {d.active_tasks_count} active
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 font-mono">{d.avg_progress}%</span>
                        <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full rounded-full" 
                            style={{ width: `${Math.min(d.avg_progress, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleInspectDepartment(d)}
                        className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold border border-indigo-200 transition inline-flex items-center gap-1 cursor-pointer"
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
              <div key={d.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{d.name}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">{d.total_users} staff assigned</p>
                  </div>
                  {d.idle_users_count > 0 ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                      {d.idle_users_count} Idle
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Optimal
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs py-1 bg-slate-50 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Present</span>
                    <strong className="text-slate-800 font-mono">{d.present_users}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Active</span>
                    <strong className="text-blue-600 font-mono">{d.active_tasks_count}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Progress</span>
                    <strong className="text-emerald-600 font-mono">{d.avg_progress}%</strong>
                  </div>
                </div>

                <button
                  onClick={() => handleInspectDepartment(d)}
                  className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-lg border border-indigo-200 transition flex items-center justify-center gap-1 cursor-pointer"
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