import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Users, AlertTriangle, CheckCircle2, ChevronRight, RefreshCw, UserCheck, UserX } from 'lucide-react';

export default function SupervisorTeamView({ onSelectUser }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await api.get('/tasks/dashboard/team-overview/');
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  if (loading || !data) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading team capacity...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Dynamic Summary Banner: e.g. 10 emp, 9 present, 7 committed, 2 idle */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Subordinates</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{data.total_team} Staff</div>
          <p className="text-[11px] text-slate-400 mt-1">{data.on_leave_count} on leave today</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">On-Duty / Present</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{data.present_count} Present</div>
          <p className="text-[11px] text-slate-400 mt-1">Available for work today</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Commitments</span>
          <div className="text-2xl font-bold text-blue-600 mt-1">{data.committed_count} Working</div>
          <p className="text-[11px] text-slate-400 mt-1">Has &ge;1 daily task planned</p>
        </div>

        <div className={`p-4 rounded-xl border shadow-2xs transition ${
          data.idle_count > 0 ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'
        }`}>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Present but Idle</span>
          <div className="text-2xl font-bold text-amber-600 mt-1 flex items-center gap-2">
            {data.idle_count} Employees
            {data.idle_count > 0 && <AlertTriangle size={18} className="text-amber-500" />}
          </div>
          <p className="text-[11px] text-amber-800 mt-1">
            {data.idle_count} / {data.present_count} present have 0 active tasks
          </p>
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-sm text-slate-900">Direct & Indirect Subordinates</h3>
          <button
            onClick={fetchOverview}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 border border-slate-200 px-2.5 py-1 rounded-lg"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Duty Status</th>
                <th className="py-3 px-4">Today Active Plan</th>
                <th className="py-3 px-4">Focus Item</th>
                <th className="py-3 px-4 text-right">Drill-Down</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.members.map((m) => (
                <tr key={m.id} className={m.is_idle ? 'bg-amber-50/50' : 'hover:bg-slate-50/70'}>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {m.username}
                    <div className="text-[11px] text-slate-400 font-normal">{m.designation}</div>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-600">{m.department}</td>
                  <td className="py-3 px-4">
                    {m.is_present ? (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-semibold">
                        <UserCheck size={12} /> Present
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-medium">
                        <UserX size={12} /> On Leave
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {m.is_idle ? (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded font-bold">
                        <AlertTriangle size={12} /> 0 Tasks (Idle)
                      </span>
                    ) : (
                      <span className="font-semibold text-slate-800">{m.active_daily_tasks} Tasks Planned</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={m.primary_task_title}>
                    {m.primary_task_title}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => onSelectUser(m.id)}
                      className="bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1"
                    >
                      Inspect <ChevronRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}