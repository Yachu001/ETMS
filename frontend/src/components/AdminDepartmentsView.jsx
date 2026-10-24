import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Building2, AlertTriangle, CheckCircle2, ChevronRight, RefreshCw } from 'lucide-react';

export default function AdminDepartmentsView({ onSelectDepartment }) {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await api.get('/tasks/dashboard/departments-summary/');
      setDepartments(res.data);
    } catch (err) {
      console.error('Failed to load department summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500 shadow-xs">
        <div className="flex items-center justify-center gap-2">
          <RefreshCw size={14} className="animate-spin text-blue-600" />
          Loading organization department statistics...
        </div>
      </div>
    );
  }

  const totalIdleAcrossOrg = departments.reduce((acc, d) => acc + (d.idle_users_count || 0), 0);
  const totalActiveTasksAcrossOrg = departments.reduce((acc, d) => acc + (d.active_tasks_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Departments
          </span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{departments.length} Units</div>
          <p className="text-[11px] text-slate-400 mt-1">Company functional business divisions</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Company-Wide Idle Staff
          </span>
          <div className="text-2xl font-bold text-amber-600 mt-1 flex items-center gap-2">
            {totalIdleAcrossOrg} Employees
            {totalIdleAcrossOrg > 0 && <AlertTriangle size={18} className="text-amber-500" />}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Present on duty with 0 daily commitments</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Active Workload
          </span>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {totalActiveTasksAcrossOrg} Tasks
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Tasks committed for work today</p>
        </div>
      </div>

      {/* Departments Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Departments Operational Matrix</h3>
            <p className="text-xs text-slate-400">Click any department row to inspect assigned personnel</p>
          </div>
          <button
            onClick={fetchSummary}
            className="text-xs text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 transition"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Headcount (Present / Total)</th>
                <th className="py-3 px-4">Idle Status</th>
                <th className="py-3 px-4">Today Active Tasks</th>
                <th className="py-3 px-4">Avg Completion</th>
                <th className="py-3 px-4 text-right">Drill-Down</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {departments.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-400">
                    No departments found in directory.
                  </td>
                </tr>
              ) : (
                departments.map((dept) => (
                  <tr
                    key={dept.id}
                    className={`hover:bg-slate-50 transition cursor-pointer ${
                      dept.idle_users_count > 0 ? 'bg-amber-50/20' : ''
                    }`}
                    onClick={() => onSelectDepartment(dept.id)}
                  >
                    <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <Building2 size={16} className="text-blue-600" />
                      {dept.name}
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      {dept.present_users} present / {dept.total_users} staff
                    </td>

                    <td className="py-3.5 px-4">
                      {dept.idle_users_count === 0 ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold px-2 py-0.5 rounded text-[11px]">
                          <CheckCircle2 size={12} /> 0 Idle (Optimal)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-300 font-bold px-2 py-0.5 rounded text-[11px]">
                          <AlertTriangle size={12} /> {dept.idle_users_count} Idle
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-blue-600">
                      {dept.active_tasks_count}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700">{dept.avg_progress}%</span>
                        <div className="w-16 bg-slate-200 rounded-full h-1.5">
                          <div
                            className="bg-emerald-600 h-1.5 rounded-full"
                            style={{ width: `${Math.min(dept.avg_progress, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDepartment(dept.id);
                        }}
                        className="inline-flex items-center gap-1 text-xs bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-1.5 rounded-lg transition font-medium"
                      >
                        Inspect <ChevronRight size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}