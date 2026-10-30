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
  Network, 
  CheckCircle2, 
  XCircle, 
  Bell, 
  Layers,
  Shield
} from 'lucide-react';

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

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-xl w-full p-6 space-y-5">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <User className="text-blue-600" size={18} />
            <h3 className="font-bold text-slate-900 text-base">Employee Profile & Scope</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
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
              <div className="w-14 h-14 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-xs">
                {(user.username || 'U').substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-slate-900 truncate">{user.full_name || user.username}</h4>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded border font-semibold bg-blue-50 text-blue-700 border-blue-200 shrink-0">
                    {user.role}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                  {user.designation || 'Staff'} • {user.employee_code || 'ID Unassigned'}
                </div>
              </div>
            </div>

            {/* Matrix Association Details */}
            <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <Layers size={13} className="text-indigo-600" /> Matrix Branch Alignment
              </div>
              <div className="text-sm font-semibold text-slate-900">
                {user.matrix_name || 'No Matrix Assigned'}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-medium">Business</span>
                  <span className="font-medium text-slate-700">{user.business_name || 'No Business'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-medium">Department</span>
                  <span className="font-medium text-slate-700">{user.department_name || 'No Department'}</span>
                </div>
              </div>
            </div>

            {/* Reporting Leads */}
            <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <Network size={13} className="text-emerald-600" /> 
                {user.role === 'SUPERVISOR' ? 'Dual Direct Upstream Leads' : 'Direct Reporting Lead'}
              </div>
              <div>
                <span className="font-semibold text-slate-800 text-xs">
                  {user.manager_name || 'None / Unassigned'}
                </span>
                {user.role === 'SUPERVISOR' && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Reports to Business Admin & Department Admin governing this matrix branch.
                  </p>
                )}
              </div>
            </div>

            {/* Profile Grid Details */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-semibold">
                  <Mail size={12} /> Email Address
                </div>
                <div className="text-slate-800 font-medium truncate">{user.email || 'Not provided'}</div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-semibold">
                  <Phone size={12} /> Contact Phone
                </div>
                <div className="text-slate-800 font-medium">{user.phone || 'Not provided'}</div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-semibold">
                  <Clock size={12} /> Shift Schedule
                </div>
                <div className="text-slate-800 font-medium font-mono">
                  {user.shift_start_time || '09:00'} - {user.shift_end_time || '18:00'}
                </div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-semibold">
                  Account Status
                </div>
                <div>
                  {user.is_active ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={11} /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                      <XCircle size={11} /> Disabled
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
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg transition"
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