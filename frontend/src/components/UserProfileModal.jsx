// frontend/src/components/UserProfileModal.jsx

import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { 
  X, 
  User, 
  Building, 
  Building2, 
  Mail, 
  Phone, 
  Clock, 
  Layers, 
  CheckCircle2, 
  XCircle, 
  Globe, 
  Calendar,
  Briefcase
} from 'lucide-react';

const ROLE_BADGE_STYLES = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
  ADMIN: 'bg-blue-100 text-blue-800 border-blue-200',
  BUSINESS_ADMIN: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  DEPT_HEAD: 'bg-teal-100 text-teal-800 border-teal-200',
  SUPERVISOR: 'bg-amber-100 text-amber-900 border-amber-200',
  EMPLOYEE: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function UserProfileModal({ isOpen, onClose, userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      setLoading(true);
      api.get(`/auth/employees/manage/${userId}/`)
        .then((res) => setUser(res.data))
        .catch((err) => console.error('Failed to load profile:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const role = user?.role || 'EMPLOYEE';
  const isSuperAdminOrAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(role);
  const isBusinessAdmin = role === 'BUSINESS_ADMIN';
  const isDeptAdmin = role === 'DEPT_HEAD';
  const isSupervisor = role === 'SUPERVISOR';
  const dualLeads = Array.isArray(user?.dual_reporting_leads) ? user.dual_reporting_leads : [];

  // Scoped display values
  const businessDisplay = isSuperAdminOrAdmin || isDeptAdmin 
    ? 'All Businesses' 
    : (user?.business_name || 'No Business');

  const departmentDisplay = isSuperAdminOrAdmin || isBusinessAdmin 
    ? 'All Departments' 
    : (user?.department_name || 'No Department');

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <User className="text-blue-600" size={18} />
            <h3 className="font-bold text-slate-900 text-base">Employee Profile & Scope</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-xs text-slate-400">Loading user profile...</div>
        ) : !user ? (
          <div className="text-center py-8 text-xs text-rose-500">Failed to load profile data.</div>
        ) : (
          <div className="space-y-4 text-xs">
            {/* Identity Banner */}
            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="w-14 h-14 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-xs shrink-0">
                {(user.username || 'U').substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-slate-900 truncate">{user.full_name || user.username}</h4>
                  <span className={`font-mono text-[10px] px-2 py-0.5 rounded border font-semibold shrink-0 ${ROLE_BADGE_STYLES[role] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                    {role.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                  {user.designation || 'Staff'} • {user.employee_code || `EID-${user.id}`} • @{user.username}
                </div>
              </div>
            </div>

            {/* Scope & Hierarchy Cards */}
            {isSuperAdminOrAdmin ? (
              <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-blue-900 uppercase text-[10px] tracking-wider">
                  <Globe size={13} className="text-blue-600" /> Global Platform Governance
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Full administrative authority across all registered businesses, operational departments, and matrix branches. No upstream reporting line assigned.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center gap-1.5 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  <Layers size={13} className="text-blue-600" /> Organizational Placement
                </div>

                {/* Matrix Branch if applicable */}
                {!isBusinessAdmin && !isDeptAdmin && (
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block font-medium">Matrix Branch</span>
                    <span className="font-semibold text-slate-900 text-xs">
                      {user.matrix_title || 'No Matrix Assigned'}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block font-medium">Business</span>
                    {isDeptAdmin ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 mt-0.5">
                        All Businesses
                      </span>
                    ) : (
                      <span className="font-semibold text-slate-800">{businessDisplay}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block font-medium">Department</span>
                    {isBusinessAdmin ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 mt-0.5">
                        All Departments
                      </span>
                    ) : (
                      <span className="font-semibold text-slate-800">{departmentDisplay}</span>
                    )}
                  </div>
                </div>

                {/* Reporting Leads */}
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase block font-medium mb-1">
                    {isSupervisor ? 'Dual Upstream Direct Reporting Leads' : 'Direct Reporting Lead'}
                  </span>
                  {isSupervisor && dualLeads.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {dualLeads.map((lead, idx) => (
                        <div key={lead.id || idx} className="p-2 bg-indigo-50/60 rounded-lg border border-indigo-100">
                          <div className="text-[10px] font-bold text-indigo-700">{lead.type}</div>
                          <div className="font-semibold text-slate-800">{lead.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{lead.scope}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="font-semibold text-slate-800">
                      {user.manager_name || 'Self-Directed / Unassigned'}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Profile Grid Details */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-semibold">
                  <Mail size={12} /> Email Address
                </div>
                <div className="text-slate-800 font-medium truncate" title={user.email || ''}>
                  {user.email || 'Not provided'}
                </div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-semibold">
                  <Phone size={12} /> Contact Phone
                </div>
                <div className="text-slate-800 font-medium">{user.phone || 'Not provided'}</div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-semibold">
                  <Calendar size={12} /> Date of Joining
                </div>
                <div className="text-slate-800 font-medium font-mono">
                  {user.date_of_joining || 'Not Specified'}
                </div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-semibold">
                  <Clock size={12} /> Shift Schedule
                </div>
                <div className="text-slate-800 font-medium font-mono">
                  {String(user.shift_start_time || '09:00').slice(0, 5)} - {String(user.shift_end_time || '18:00').slice(0, 5)}
                </div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1 col-span-2">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-semibold">
                  Account Status
                </div>
                <div className="flex items-center gap-2">
                  {user.is_active ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={11} /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                      <XCircle size={11} /> Disabled
                    </span>
                  )}
                  {user.is_present && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      On-Duty
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}