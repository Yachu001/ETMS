import React from 'react';
import { 
  X, User, Mail, Phone, Calendar, Clock, Building2, 
  Building, Shield, Star, CheckCircle, XCircle 
} from 'lucide-react';

export default function EmployeeProfileModal({ user, onClose }) {
  if (!user) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      {/* Modal Container: Jet black body, gold ambient glow, refined gold-tinted hairline border */}
      <div className="bg-[#0b0c0e] rounded-3xl max-w-xl w-full p-7 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_40px_rgba(212,175,55,0.08)] border border-amber-500/25 max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        
        {/* Header */}
        <div className="flex justify-between items-start pb-5 border-b border-amber-500/20">
          <div className="flex items-center gap-4">
            {/* Avatar Badge with Gold Gradient Border & Lustrous Fill */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1c1917] via-[#161412] to-[#0a0a0a] text-amber-300 border border-amber-400/40 flex items-center justify-center font-bold text-xl shadow-[0_4px_20px_rgba(212,175,55,0.15)] ring-1 ring-amber-400/20">
              {(user.username || 'U').substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-lg font-bold text-white tracking-wide">{user.full_name || user.username}</h3>
                <span className="text-[10px] font-mono tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 uppercase font-semibold">
                  {user.role}
                </span>
              </div>
              <p className="text-xs text-amber-200/50 font-mono mt-1">
                {user.employee_code || `EID-${user.id}`} • @{user.username}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 bg-white/[0.03] hover:bg-amber-500/15 border border-white/5 hover:border-amber-500/30 rounded-xl text-neutral-400 hover:text-amber-300 transition duration-150"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status Indicators */}
        <div className="flex flex-wrap gap-2.5 my-5">
          <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border tracking-wide transition ${
            user.is_active 
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.1)]' 
              : 'bg-rose-950/40 text-rose-400 border-rose-500/30'
          }`}>
            {user.is_active ? <CheckCircle size={14} className="text-emerald-400" /> : <XCircle size={14} className="text-rose-400" />}
            Account: <span className="font-semibold">{user.is_active ? 'Active' : 'Disabled'}</span>
          </span>
          <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border tracking-wide transition ${
            user.is_present 
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.15)]' 
              : 'bg-neutral-900/60 text-neutral-400 border-neutral-800'
          }`}>
            <Clock size={14} className={user.is_present ? "text-amber-400" : "text-neutral-500"} />
            Duty: <span className="font-semibold">{user.is_present ? 'On Duty (Present)' : 'On Leave / Offline'}</span>
          </span>
        </div>

        {/* Master Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 bg-gradient-to-b from-[#141518] to-[#101114] rounded-2xl border border-amber-500/15 hover:border-amber-500/30 transition space-y-1">
            <span className="text-amber-400/70 uppercase font-semibold text-[10px] tracking-wider flex items-center gap-1.5">
              <Mail size={12} className="text-amber-400" /> Email
            </span>
            <div className="font-medium text-neutral-200 break-all">{user.email || 'None'}</div>
          </div>

          <div className="p-3.5 bg-gradient-to-b from-[#141518] to-[#101114] rounded-2xl border border-amber-500/15 hover:border-amber-500/30 transition space-y-1">
            <span className="text-amber-400/70 uppercase font-semibold text-[10px] tracking-wider flex items-center gap-1.5">
              <Phone size={12} className="text-amber-400" /> Phone Number
            </span>
            <div className="font-medium text-neutral-200">{user.phone || 'Not Specified'}</div>
          </div>

          <div className="p-3.5 bg-gradient-to-b from-[#141518] to-[#101114] rounded-2xl border border-amber-500/15 hover:border-amber-500/30 transition space-y-1">
            <span className="text-amber-400/70 uppercase font-semibold text-[10px] tracking-wider flex items-center gap-1.5">
              <Shield size={12} className="text-amber-400" /> Designation
            </span>
            <div className="font-medium text-neutral-200">{user.designation || 'Staff'}</div>
          </div>

          <div className="p-3.5 bg-gradient-to-b from-[#141518] to-[#101114] rounded-2xl border border-amber-500/15 hover:border-amber-500/30 transition space-y-1">
            <span className="text-amber-400/70 uppercase font-semibold text-[10px] tracking-wider flex items-center gap-1.5">
              <Calendar size={12} className="text-amber-400" /> Date of Joining
            </span>
            <div className="font-medium text-neutral-200">{user.date_of_joining || 'Not recorded'}</div>
          </div>

          <div className="p-3.5 bg-gradient-to-b from-[#141518] to-[#101114] rounded-2xl border border-amber-500/15 hover:border-amber-500/30 transition space-y-1 col-span-2">
            <span className="text-amber-400/70 uppercase font-semibold text-[10px] tracking-wider flex items-center gap-1.5">
              <Clock size={12} className="text-amber-400" /> Shift Schedule
            </span>
            <div className="font-medium text-neutral-200">
              {user.shift_start_time || '09:00:00'} — {user.shift_end_time || '18:00:00'} <span className="text-amber-400/60 font-normal">(Standard Workday)</span>
            </div>
          </div>
        </div>

        {/* Entity Relationships */}
        <div className="mt-5 space-y-4 pt-4 border-t border-amber-500/20 text-xs">
          <div>
            <span className="font-semibold text-amber-200/90 block mb-2 tracking-wide uppercase text-[10px]">Associated Businesses</span>
            {user.businesses && user.businesses.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {user.businesses.map((b) => (
                  <span 
                    key={b.id} 
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs tracking-wide transition ${
                      b.is_primary 
                        ? 'bg-gradient-to-r from-amber-500/20 to-amber-600/10 text-amber-200 border-amber-500/40 font-semibold shadow-[0_0_15px_rgba(212,175,55,0.12)]' 
                        : 'bg-[#141518] text-neutral-300 border-white/5 hover:border-amber-500/20'
                    }`}
                  >
                    <Building2 size={13} className={b.is_primary ? "text-amber-400" : "text-neutral-400"} /> 
                    {b.name} <span className="opacity-60 text-[11px]">({b.code})</span>
                    {b.is_primary && (
                      <span className="text-[10px] bg-amber-400/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.2 rounded font-bold ml-1 flex items-center gap-0.5">
                        <Star size={9} fill="currentColor" /> Primary
                      </span>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-neutral-500 italic">No Business Linked</span>
            )}
          </div>

          <div>
            <span className="font-semibold text-amber-200/90 block mb-2 tracking-wide uppercase text-[10px]">Assigned Departments</span>
            {user.departments && user.departments.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {user.departments.map((d) => (
                  <span 
                    key={d.id} 
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs tracking-wide transition ${
                      d.is_primary 
                        ? 'bg-gradient-to-r from-amber-500/20 to-amber-600/10 text-amber-200 border-amber-500/40 font-semibold shadow-[0_0_15px_rgba(212,175,55,0.12)]' 
                        : 'bg-[#141518] text-neutral-300 border-white/5 hover:border-amber-500/20'
                    }`}
                  >
                    <Building size={13} className={d.is_primary ? "text-amber-400" : "text-neutral-400"} /> 
                    {d.name}
                    {d.is_primary && (
                      <span className="text-[10px] bg-amber-400/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.2 rounded font-bold ml-1 flex items-center gap-0.5">
                        <Star size={9} fill="currentColor" /> Primary
                      </span>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-neutral-500 italic">No Department Linked</span>
            )}
          </div>

          <div>
            <span className="font-semibold text-amber-200/90 block mb-2 tracking-wide uppercase text-[10px]">Reporting Managers</span>
            {user.reporting_managers && user.reporting_managers.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {user.reporting_managers.map((m) => (
                  <span 
                    key={m.id} 
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs tracking-wide transition ${
                      m.is_primary 
                        ? 'bg-gradient-to-r from-amber-500/20 to-amber-600/10 text-amber-200 border-amber-500/40 font-semibold shadow-[0_0_15px_rgba(212,175,55,0.12)]' 
                        : 'bg-[#141518] text-neutral-300 border-white/5 hover:border-amber-500/20'
                    }`}
                  >
                    <User size={13} className={m.is_primary ? "text-amber-400" : "text-neutral-400"} /> 
                    {m.full_name || m.username} <span className="opacity-60 text-[11px]">({m.designation})</span>
                    {m.is_primary && (
                      <span className="text-[10px] bg-amber-400/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.2 rounded font-bold ml-1 flex items-center gap-0.5">
                        <Star size={9} fill="currentColor" /> Primary Lead
                      </span>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-neutral-500 italic">None Assigned</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-5 mt-5 border-t border-amber-500/20">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold rounded-xl text-xs tracking-wide shadow-[0_0_20px_rgba(212,175,55,0.25)] hover:shadow-[0_0_25px_rgba(212,175,55,0.4)] transition-all duration-200"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
}