import React from 'react';
import { 
  X, User, Mail, Phone, Calendar, Clock, Building2, 
  Building, Shield, Star, CheckCircle, XCircle 
} from 'lucide-react';

export default function EmployeeProfileModal({ user, onClose }) {
  if (!user) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-start pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center font-bold text-lg shadow-2xs">
              {(user.username || 'U').substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{user.full_name || user.username}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border font-bold">
                  {user.role}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {user.employee_code || `EID-${user.id}`} • @{user.username}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status Indicators */}
        <div className="flex gap-2 my-4">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
            user.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            {user.is_active ? <CheckCircle size={14} /> : <XCircle size={14} />}
            Account: {user.is_active ? 'Active' : 'Disabled'}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
            user.is_present ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}>
            <Clock size={14} />
            Duty: {user.is_present ? 'On Duty (Present)' : 'On Leave / Offline'}
          </span>
        </div>

        {/* Master Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
            <span className="text-slate-400 uppercase font-semibold text-[10px] flex items-center gap-1">
              <Mail size={12} /> Email
            </span>
            <div className="font-semibold text-slate-800 break-all">{user.email || 'None'}</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
            <span className="text-slate-400 uppercase font-semibold text-[10px] flex items-center gap-1">
              <Phone size={12} /> Phone Number
            </span>
            <div className="font-semibold text-slate-800">{user.phone || 'Not Specified'}</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
            <span className="text-slate-400 uppercase font-semibold text-[10px] flex items-center gap-1">
              <Shield size={12} /> Designation
            </span>
            <div className="font-semibold text-slate-800">{user.designation || 'Staff'}</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
            <span className="text-slate-400 uppercase font-semibold text-[10px] flex items-center gap-1">
              <Calendar size={12} /> Date of Joining
            </span>
            <div className="font-semibold text-slate-800">{user.date_of_joining || 'Not recorded'}</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 col-span-2">
            <span className="text-slate-400 uppercase font-semibold text-[10px] flex items-center gap-1">
              <Clock size={12} /> Shift Schedule
            </span>
            <div className="font-semibold text-slate-800">
              {user.shift_start_time || '09:00:00'} — {user.shift_end_time || '18:00:00'} (Standard Workday)
            </div>
          </div>
        </div>

        {/* Entity Relationships */}
        <div className="mt-4 space-y-3 pt-3 border-t border-slate-100 text-xs">
          <div>
            <span className="font-semibold text-slate-700 block mb-1">Associated Businesses</span>
            {user.businesses && user.businesses.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {user.businesses.map((b) => (
                  <span 
                    key={b.id} 
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs ${
                      b.is_primary ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold' : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Building2 size={12} /> {b.name} ({b.code})
                    {b.is_primary && <span className="text-[10px] text-indigo-600 font-bold ml-0.5">★ Primary</span>}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-400">No Business Linked</span>
            )}
          </div>

          <div>
            <span className="font-semibold text-slate-700 block mb-1">Assigned Departments</span>
            {user.departments && user.departments.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {user.departments.map((d) => (
                  <span 
                    key={d.id} 
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs ${
                      d.is_primary ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold' : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Building size={12} /> {d.name}
                    {d.is_primary && <span className="text-[10px] text-indigo-600 font-bold ml-0.5">★ Primary</span>}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-400">No Department Linked</span>
            )}
          </div>

          <div>
            <span className="font-semibold text-slate-700 block mb-1">Reporting Managers</span>
            {user.reporting_managers && user.reporting_managers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {user.reporting_managers.map((m) => (
                  <span 
                    key={m.id} 
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs ${
                      m.is_primary ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold' : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <User size={12} /> {m.full_name || m.username} ({m.designation})
                    {m.is_primary && <span className="text-[10px] text-indigo-600 font-bold ml-0.5">★ Primary Lead</span>}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-400">None Assigned</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 mt-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
}