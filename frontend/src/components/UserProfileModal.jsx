// frontend/src/components/UserProfileModal.jsx

import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  Clock, 
  Layers, 
  CheckCircle2, 
  XCircle, 
  Globe, 
  Calendar
} from 'lucide-react';

const ROLE_BADGE_STYLES = {
  SUPER_ADMIN: 'bg-rose-50 text-rose-700 border-rose-200',
  ADMIN: 'bg-blue-100/80 text-blue-800 border-blue-300',
  BUSINESS_ADMIN: 'bg-sky-50 text-sky-700 border-sky-200',
  DEPT_HEAD: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  SUPERVISOR: 'bg-blue-50 text-blue-700 border-blue-200',
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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 transition-all font-sans">
      {/* Modal Container: Crisp white body, subtle slate border, hidden scrollbars */}
      <div className="bg-white border border-slate-200/90 rounded-t-3xl sm:rounded-3xl shadow-[0_24px_50px_rgba(15,23,42,0.16)] max-w-xl w-full p-5 sm:p-6 space-y-4 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden text-slate-800">
        
        {/* Header with Top-Right Close Button */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-600 flex items-center justify-center shadow-2xs">
              <User size={17} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base tracking-wide">
                Employee Profile & Scope
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Organizational placement and access details
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-xs text-blue-600 font-mono font-semibold animate-pulse">
            Loading user profile details...
          </div>
        ) : !user ? (
          <div className="text-center py-12 text-xs text-rose-700 bg-rose-50 rounded-2xl border border-rose-200 font-medium">
            Failed to load profile data.
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {/* Identity Banner */}
            <div className="flex items-center gap-3.5 sm:gap-4 bg-slate-50/90 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-white flex items-center justify-center font-extrabold text-lg sm:text-xl shadow-[0_6px_16px_rgba(37,99,235,0.28)] ring-4 ring-blue-50 shrink-0 font-mono">
                {(user.username || 'U').substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                    {user.full_name || user.username}
                  </h4>
                  <span className={`font-mono text-[10px] px-2.5 py-0.5 rounded-full border font-bold uppercase shrink-0 ${ROLE_BADGE_STYLES[role] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                    {role.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                  <span className="text-slate-700 font-sans font-semibold">{user.designation || 'Staff'}</span> &bull; <span className="text-blue-700 font-semibold">{user.employee_code || `EID-${user.id}`}</span> &bull; @{user.username}
                </div>
              </div>
            </div>

            {/* Scope & Hierarchy Cards */}
            {isSuperAdminOrAdmin ? (
              <div className="p-4 bg-gradient-to-r from-blue-50/90 to-indigo-50/70 rounded-2xl border border-blue-200/80 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-blue-700 uppercase text-[10px] tracking-wider">
                  <Globe size={13} className="text-blue-600 shrink-0" /> Global Platform Governance
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed">
                  Full administrative authority across all registered businesses, operational departments, and matrix branches. No upstream reporting line assigned.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-3">
                <div className="flex items-center gap-1.5 text-blue-600 text-[10px] uppercase font-bold tracking-wider">
                  <Layers size={13} className="text-blue-600 shrink-0" /> Organizational Placement
                </div>

                {/* Matrix Branch if applicable */}
                {!isBusinessAdmin && !isDeptAdmin && (
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-bold tracking-wider">Matrix Branch</span>
                    <span className="font-bold text-slate-900 text-xs mt-0.5 block">
                      {user.matrix_title || 'No Matrix Assigned'}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2.5 border-t border-slate-200/70">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-bold tracking-wider">Business</span>
                    {isDeptAdmin ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 mt-1">
                        All Businesses
                      </span>
                    ) : (
                      <span className="font-bold text-slate-900 mt-0.5 block">{businessDisplay}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-bold tracking-wider">Department</span>
                    {isBusinessAdmin ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 mt-1">
                        All Departments
                      </span>
                    ) : (
                      <span className="font-bold text-slate-900 mt-0.5 block">{departmentDisplay}</span>
                    )}
                  </div>
                </div>

                {/* Reporting Leads */}
                <div className="pt-2.5 border-t border-slate-200/70">
                  <span className="text-[10px] text-slate-500 uppercase block font-bold tracking-wider mb-1.5">
                    {isSupervisor ? 'Dual Upstream Direct Reporting Leads' : 'Direct Reporting Lead'}
                  </span>
                  {isSupervisor && dualLeads.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {dualLeads.map((lead, idx) => (
                        <div key={lead.id || idx} className="p-2.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs">
                          <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">{lead.type}</div>
                          <div className="font-bold text-slate-900 mt-0.5">{lead.name}</div>
                          <div className="text-[10px] text-slate-500 truncate mt-0.5 font-mono">{lead.scope}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="font-bold text-slate-900">
                      {user.manager_name || 'Self-Directed / Unassigned'}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Profile Grid Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <div className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-1 hover:border-blue-300 transition">
                <div className="flex items-center gap-1.5 text-blue-600 text-[10px] uppercase font-bold tracking-wider">
                  <Mail size={12} className="shrink-0" /> Email Address
                </div>
                <div className="text-slate-900 font-semibold truncate" title={user.email || ''}>
                  {user.email || 'Not provided'}
                </div>
              </div>

              <div className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-1 hover:border-blue-300 transition">
                <div className="flex items-center gap-1.5 text-blue-600 text-[10px] uppercase font-bold tracking-wider">
                  <Phone size={12} className="shrink-0" /> Contact Phone
                </div>
                <div className="text-slate-900 font-semibold">{user.phone || 'Not provided'}</div>
              </div>

              <div className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-1 hover:border-blue-300 transition">
                <div className="flex items-center gap-1.5 text-blue-600 text-[10px] uppercase font-bold tracking-wider">
                  <Calendar size={12} className="shrink-0" /> Date of Joining
                </div>
                <div className="text-slate-900 font-semibold font-mono">
                  {user.date_of_joining || 'Not Specified'}
                </div>
              </div>

              <div className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-1 hover:border-blue-300 transition">
                <div className="flex items-center gap-1.5 text-blue-600 text-[10px] uppercase font-bold tracking-wider">
                  <Clock size={12} className="shrink-0" /> Shift Schedule
                </div>
                <div className="text-slate-900 font-semibold font-mono">
                  {String(user.shift_start_time || '09:00').slice(0, 5)} - {String(user.shift_end_time || '18:00').slice(0, 5)}
                </div>
              </div>

              <div className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-1.5 sm:col-span-2">
                <div className="flex items-center gap-1.5 text-blue-600 text-[10px] uppercase font-bold tracking-wider">
                  Account Status
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {user.is_active ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-0.5 rounded-full">
                      <CheckCircle2 size={12} className="text-emerald-600" /> Active Account
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-3 py-0.5 rounded-full">
                      <XCircle size={12} className="text-slate-400" /> Disabled
                    </span>
                  )}
                  {user.is_present && (
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-3 py-0.5 rounded-full border border-blue-200 font-mono">
                      &bull; On-Duty
                    </span>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}