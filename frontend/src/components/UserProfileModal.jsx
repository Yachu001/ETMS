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
  Briefcase,
  ShieldCheck,
  UserCheck
} from 'lucide-react';

const ROLE_BADGE_STYLES = {
  SUPER_ADMIN: 'bg-purple-950/60 text-purple-300 border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.15)]',
  ADMIN: 'bg-blue-950/60 text-blue-300 border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.15)]',
  BUSINESS_ADMIN: 'bg-indigo-950/60 text-indigo-300 border-indigo-500/40 shadow-[0_0_10px_rgba(99,102,241,0.15)]',
  DEPT_HEAD: 'bg-teal-950/60 text-teal-300 border-teal-500/40 shadow-[0_0_10px_rgba(20,184,166,0.15)]',
  SUPERVISOR: 'bg-amber-950/60 text-amber-300 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.15)]',
  EMPLOYEE: 'bg-neutral-800/80 text-neutral-300 border-neutral-700/60',
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 transition-all font-sans">
      {/* Modal Container: Scrollbar hidden across all browsers, scrolls smoothly */}
      <div className="bg-[#141518] border border-amber-500/25 rounded-t-3xl sm:rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_25px_rgba(245,158,11,0.12)] max-w-xl w-full p-5 sm:p-6 space-y-4 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden text-neutral-200">
        
        {/* Header with Top-Right Close Button */}
        <div className="flex justify-between items-center border-b border-amber-500/20 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
              <User className="text-amber-400" size={18} />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base tracking-wide">
                Employee Profile & Scope
              </h3>
              <p className="text-[10px] text-amber-400/70 font-mono">
                Organizational placement and access details
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-amber-300 rounded-lg transition border border-transparent hover:border-amber-500/20 cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-xs text-amber-400/70 font-mono italic animate-pulse">
            Loading user profile details...
          </div>
        ) : !user ? (
          <div className="text-center py-12 text-xs text-rose-400 bg-rose-950/20 rounded-xl border border-rose-500/20">
            Failed to load profile data.
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {/* Identity Banner */}
            <div className="flex items-center gap-3.5 sm:gap-4 bg-[#0b0c0e] p-3.5 sm:p-4 rounded-xl border border-amber-500/20">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-black flex items-center justify-center font-extrabold text-lg sm:text-xl shadow-[0_0_15px_rgba(245,158,11,0.25)] shrink-0 font-mono">
                {(user.username || 'U').substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <h4 className="text-sm sm:text-base font-bold text-white truncate">
                    {user.full_name || user.username}
                  </h4>
                  <span className={`font-mono text-[10px] px-2 py-0.5 rounded-lg border font-bold uppercase shrink-0 ${ROLE_BADGE_STYLES[role] || 'bg-neutral-800 text-neutral-300 border-neutral-700'}`}>
                    {role.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-[11px] text-neutral-400 font-mono mt-0.5 truncate">
                  <span className="text-amber-300/80">{user.designation || 'Staff'}</span> • {user.employee_code || `EID-${user.id}`} • @{user.username}
                </div>
              </div>
            </div>

            {/* Scope & Hierarchy Cards */}
            {isSuperAdminOrAdmin ? (
              <div className="p-3.5 bg-purple-950/20 rounded-xl border border-purple-500/30 space-y-1.5 shadow-[0_0_12px_rgba(168,85,247,0.08)]">
                <div className="flex items-center gap-1.5 font-bold text-purple-300 uppercase text-[10px] tracking-wider font-mono">
                  <Globe size={13} className="text-purple-400 shrink-0" /> Global Platform Governance
                </div>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  Full administrative authority across all registered businesses, operational departments, and matrix branches. No upstream reporting line assigned.
                </p>
              </div>
            ) : (
              <div className="p-3.5 bg-[#0b0c0e] border border-amber-500/20 rounded-xl space-y-2.5">
                <div className="flex items-center gap-1.5 text-amber-400 text-[10px] uppercase font-bold tracking-wider font-mono">
                  <Layers size={13} className="text-amber-400 shrink-0" /> Organizational Placement
                </div>

                {/* Matrix Branch if applicable */}
                {!isBusinessAdmin && !isDeptAdmin && (
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase block font-mono">Matrix Branch</span>
                    <span className="font-semibold text-white text-xs">
                      {user.matrix_title || 'No Matrix Assigned'}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-amber-500/15">
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase block font-mono">Business</span>
                    {isDeptAdmin ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-950/50 text-indigo-300 border border-indigo-500/30 mt-0.5 font-mono">
                        All Businesses
                      </span>
                    ) : (
                      <span className="font-semibold text-neutral-200">{businessDisplay}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase block font-mono">Department</span>
                    {isBusinessAdmin ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 mt-0.5 font-mono">
                        All Departments
                      </span>
                    ) : (
                      <span className="font-semibold text-neutral-200">{departmentDisplay}</span>
                    )}
                  </div>
                </div>

                {/* Reporting Leads */}
                <div className="pt-2 border-t border-amber-500/15">
                  <span className="text-[10px] text-neutral-400 uppercase block font-mono mb-1.5">
                    {isSupervisor ? 'Dual Upstream Direct Reporting Leads' : 'Direct Reporting Lead'}
                  </span>
                  {isSupervisor && dualLeads.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {dualLeads.map((lead, idx) => (
                        <div key={lead.id || idx} className="p-2.5 bg-[#141518] rounded-lg border border-amber-500/20">
                          <div className="text-[10px] font-bold text-amber-300 uppercase font-mono">{lead.type}</div>
                          <div className="font-semibold text-white mt-0.5">{lead.name}</div>
                          <div className="text-[10px] text-neutral-400 truncate mt-0.5">{lead.scope}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="font-semibold text-neutral-200">
                      {user.manager_name || 'Self-Directed / Unassigned'}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Profile Grid Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <div className="p-3 bg-[#0b0c0e] border border-amber-500/15 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 text-[10px] uppercase font-mono font-semibold">
                  <Mail size={12} className="shrink-0" /> Email Address
                </div>
                <div className="text-neutral-200 font-medium truncate" title={user.email || ''}>
                  {user.email || 'Not provided'}
                </div>
              </div>

              <div className="p-3 bg-[#0b0c0e] border border-amber-500/15 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 text-[10px] uppercase font-mono font-semibold">
                  <Phone size={12} className="shrink-0" /> Contact Phone
                </div>
                <div className="text-neutral-200 font-medium">{user.phone || 'Not provided'}</div>
              </div>

              <div className="p-3 bg-[#0b0c0e] border border-amber-500/15 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 text-[10px] uppercase font-mono font-semibold">
                  <Calendar size={12} className="shrink-0" /> Date of Joining
                </div>
                <div className="text-neutral-200 font-medium font-mono">
                  {user.date_of_joining || 'Not Specified'}
                </div>
              </div>

              <div className="p-3 bg-[#0b0c0e] border border-amber-500/15 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 text-[10px] uppercase font-mono font-semibold">
                  <Clock size={12} className="shrink-0" /> Shift Schedule
                </div>
                <div className="text-neutral-200 font-medium font-mono">
                  {String(user.shift_start_time || '09:00').slice(0, 5)} - {String(user.shift_end_time || '18:00').slice(0, 5)}
                </div>
              </div>

              <div className="p-3 bg-[#0b0c0e] border border-amber-500/15 rounded-xl space-y-1 sm:col-span-2">
                <div className="flex items-center gap-1.5 text-amber-400 text-[10px] uppercase font-mono font-semibold">
                  Account Status
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {user.is_active ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-mono">
                      <CheckCircle2 size={11} className="text-emerald-400" /> Active Account
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400 bg-neutral-800 border border-neutral-700 px-2.5 py-0.5 rounded-full font-mono">
                      <XCircle size={11} className="text-neutral-500" /> Disabled
                    </span>
                  )}
                  {user.is_present && (
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/30 font-mono shadow-[0_0_8px_rgba(245,158,11,0.2)]">
                      ● On-Duty
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