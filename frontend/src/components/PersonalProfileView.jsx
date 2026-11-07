// frontend/src/components/PersonalProfileView.jsx

import React, { useState, useEffect } from 'react';
import { 
  User, Mail, Phone, Clock, Network, Building2, 
  Building, Bell, Shield, Layers, CheckCircle2, 
  Calendar, AlertCircle, Save, Star, Globe, Info, Briefcase
} from 'lucide-react';
import api from '../api/axios';

const ROLE_BADGE_STYLES = {
  SUPER_ADMIN: 'bg-amber-500/15 text-amber-300 border-amber-400/40 shadow-[0_0_10px_rgba(245,158,11,0.15)]',
  ADMIN: 'bg-amber-500/10 text-amber-200 border-amber-400/30',
  BUSINESS_ADMIN: 'bg-[#181510] text-amber-300 border-amber-500/30',
  DEPT_HEAD: 'bg-[#181612] text-amber-200 border-amber-500/25',
  SUPERVISOR: 'bg-neutral-900 text-amber-300/90 border-amber-500/20',
  EMPLOYEE: 'bg-neutral-900/80 text-neutral-300 border-neutral-800',
};

export default function PersonalProfileView({ currentUser, onProfileUpdated }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Editable configurations
  const [phone, setPhone] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('17:45:00');
  const [selfIdleTimer, setSelfIdleTimer] = useState('10:00');
  const [teamIdleTimer, setTeamIdleTimer] = useState('10:30');

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/me/');
      const data = res.data;
      setProfile(data);
      setPhone(data.phone || '');
      setReminderEnabled(Boolean(data.reminder_enabled));
      setReminderTime(data.reminder_time || '17:45:00');
      setSelfIdleTimer(data.self_idle_timer_start || '10:00');
      setTeamIdleTimer(data.team_idle_timer_start || '10:30');
    } catch (err) {
      console.error('Failed to load profile details:', err);
      setErrorMsg('Failed to load profile information.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const payload = {
        phone: phone.trim(),
        reminder_enabled: reminderEnabled,
        reminder_time: reminderTime,
        self_idle_timer_start: selfIdleTimer,
      };

      if (['SUPERVISOR', 'ADMIN', 'SUPER_ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD'].includes(profile?.role)) {
        payload.team_idle_timer_start = teamIdleTimer;
      }

      const res = await api.patch('/auth/me/', payload);
      setProfile(res.data);
      if (onProfileUpdated) onProfileUpdated(res.data);
      setSuccessMsg('Profile and preferences updated successfully.');
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to update preferences.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#0b0c0e] rounded-3xl border border-amber-500/20 p-12 text-center text-xs text-amber-200/50 shadow-2xl">
        Loading personal master details...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-[#0b0c0e] rounded-3xl border border-rose-500/30 p-8 text-center text-xs text-rose-400 shadow-2xl">
        Unable to load personal details.
      </div>
    );
  }

  const role = profile.role || 'EMPLOYEE';
  const isSuperAdminOrAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(role);
  const isBusinessAdmin = role === 'BUSINESS_ADMIN';
  const isDeptAdmin = role === 'DEPT_HEAD';
  const isSupervisor = role === 'SUPERVISOR';
  const isPrivileged = ['SUPERVISOR', 'ADMIN', 'SUPER_ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD'].includes(role);

  // Dual reporting leads for Supervisors
  const dualLeads = Array.isArray(profile.dual_reporting_leads) ? profile.dual_reporting_leads : [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10 text-neutral-200">
      
      {/* 1. Header Identity Banner */}
      <div className="bg-[#0b0c0e] p-6 sm:p-7 rounded-3xl border border-amber-500/25 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_35px_rgba(212,175,55,0.06)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative overflow-hidden">
        {/* Subtle ambient gold glow */}
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1c1917] via-[#161412] to-[#0a0a0a] text-amber-300 border border-amber-400/40 flex items-center justify-center font-bold text-2xl shadow-[0_4px_20px_rgba(212,175,55,0.15)] ring-1 ring-amber-400/20 shrink-0">
            {(profile.full_name || profile.username || 'U').substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-white tracking-wide">
                {profile.full_name || profile.username}
              </h2>
              <span className={`font-mono text-xs px-2.5 py-0.5 rounded-full border font-bold uppercase tracking-wider ${ROLE_BADGE_STYLES[role] || 'bg-neutral-900 text-neutral-300 border-neutral-800'}`}>
                {role.replace('_', ' ')}
              </span>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border tracking-wider uppercase ${
                profile.is_active 
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]' 
                  : 'bg-rose-950/40 text-rose-400 border-rose-500/30'
              }`}>
                {profile.is_active ? 'Active' : 'Disabled'}
              </span>
              {profile.is_present !== undefined && (
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border tracking-wider uppercase ${
                  profile.is_present 
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.15)]' 
                    : 'bg-neutral-900/60 text-neutral-400 border-neutral-800'
                }`}>
                  {profile.is_present ? 'Duty: Present' : 'Duty: Offline'}
                </span>
              )}
            </div>
            <p className="text-xs text-amber-200/50 font-mono mt-1.5">
              {profile.designation || 'Staff Associate'} &bull; EID: <span className="font-semibold text-amber-300/80">{profile.employee_code || `EID-${profile.id}`}</span> &bull; @{profile.username}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs self-start sm:self-center relative z-10">
          <div className="p-3.5 bg-gradient-to-b from-[#141518] to-[#101114] border border-amber-500/20 rounded-2xl text-right shadow-inner">
            <span className="text-[10px] text-amber-400/70 uppercase font-semibold flex items-center justify-end gap-1.5 tracking-wider">
              <Calendar size={11} className="text-amber-400" /> Date of Joining
            </span>
            <span className="font-mono font-semibold text-neutral-100 text-xs mt-0.5 block">
              {profile.date_of_joining ? String(profile.date_of_joining).slice(0, 10) : 'Not Specified'}
            </span>
          </div>
        </div>
      </div>

      {/* Alert Notices */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 flex items-center gap-2.5 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 bg-rose-950/30 border border-rose-500/30 rounded-2xl text-xs text-rose-300 flex items-center gap-2.5 shadow-[0_0_15px_rgba(244,63,94,0.1)]">
          <AlertCircle size={16} className="text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2. Organizational Matrix & Scoping Section */}
      <div className="space-y-3.5">
        <h3 className="font-bold text-amber-300/90 uppercase tracking-wider text-xs flex items-center gap-2 px-1">
          <Layers size={14} className="text-amber-400" />
          Linked Organizational Matrix & Hierarchy Scope
        </h3>

        {/* CASE A: ADMIN / SUPER ADMIN - GLOBAL SCOPE */}
        {isSuperAdminOrAdmin ? (
          <div className="bg-[#0b0c0e] border border-amber-500/20 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-200 border-b border-amber-500/15 pb-3">
              <Globe size={15} className="text-amber-400" />
              Global Platform Governance & Scope
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-gradient-to-b from-[#141518] to-[#101114] rounded-2xl border border-amber-500/20 space-y-1.5">
                <span className="text-[10px] text-amber-400/80 uppercase font-bold tracking-wider">Business Alignment</span>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <Building2 size={16} className="text-amber-400" /> All Operating Businesses (Organization-Wide)
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">Full executive authority across all child companies & corporate entities.</p>
              </div>

              <div className="p-4 bg-gradient-to-b from-[#141518] to-[#101114] rounded-2xl border border-amber-500/20 space-y-1.5">
                <span className="text-[10px] text-amber-400/80 uppercase font-bold tracking-wider">Departmental Scope</span>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <Building size={16} className="text-amber-400" /> All Functional Departments
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">Full operational access across all organizational departments & units.</p>
              </div>
            </div>
          </div>
        ) : (
          /* CASE B: BUSINESS ADMIN, DEPT ADMIN, SUPERVISOR & BASE EMPLOYEE */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* BUSINESS CARD */}
            <div className="bg-[#0b0c0e] border border-amber-500/20 rounded-3xl p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-amber-500/15 pb-2.5">
                <span className="font-bold text-xs uppercase tracking-wider text-amber-200/90 flex items-center gap-2">
                  <Building2 size={14} className="text-amber-400" />
                  {isDeptAdmin ? 'Business Scope' : 'Assigned Business'}
                </span>
                {isDeptAdmin && (
                  <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-400/30 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    All Businesses
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {isDeptAdmin ? (
                  <div className="p-3 bg-[#141518] rounded-2xl border border-white/5 text-xs font-semibold text-neutral-200">
                    Active across all operating businesses
                  </div>
                ) : profile.business_name ? (
                  <div className="p-3 rounded-2xl border text-xs bg-gradient-to-r from-amber-500/15 to-transparent border-amber-500/30 text-amber-100 font-semibold flex items-center justify-between shadow-[0_0_12px_rgba(212,175,55,0.06)]">
                    <span className="truncate">{profile.business_name} {profile.business_code ? `(${profile.business_code})` : ''}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/20 border border-amber-400/30 px-2 py-0.5 rounded-full font-bold uppercase shrink-0">
                      <Star size={9} className="fill-amber-300 text-amber-300" /> Primary
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-neutral-500 italic p-2">No business associated</div>
                )}
              </div>
            </div>

            {/* DEPARTMENT CARD */}
            <div className="bg-[#0b0c0e] border border-amber-500/20 rounded-3xl p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-amber-500/15 pb-2.5">
                <span className="font-bold text-xs uppercase tracking-wider text-amber-200/90 flex items-center gap-2">
                  <Building size={14} className="text-amber-400" />
                  {isBusinessAdmin ? 'Department Scope' : 'Assigned Department'}
                </span>
                {isBusinessAdmin && (
                  <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-400/30 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    All Departments
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {isBusinessAdmin ? (
                  <div className="p-3 bg-[#141518] rounded-2xl border border-white/5 text-xs font-semibold text-neutral-200">
                    Active across all departments in this business
                  </div>
                ) : profile.department_name ? (
                  <div className="p-3 rounded-2xl border text-xs bg-gradient-to-r from-amber-500/15 to-transparent border-amber-500/30 text-amber-100 font-semibold flex items-center justify-between shadow-[0_0_12px_rgba(212,175,55,0.06)]">
                    <span className="truncate">{profile.department_name}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/20 border border-amber-400/30 px-2 py-0.5 rounded-full font-bold uppercase shrink-0">
                      <Star size={9} className="fill-amber-300 text-amber-300" /> Primary
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-neutral-500 italic p-2">No department associated</div>
                )}
              </div>
            </div>

            {/* DIRECT REPORTING LINE */}
            <div className="bg-[#0b0c0e] border border-amber-500/20 rounded-3xl p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-amber-500/15 pb-2.5">
                <span className="font-bold text-xs uppercase tracking-wider text-amber-200/90 flex items-center gap-2">
                  <Network size={14} className="text-amber-400" />
                  {isSupervisor ? 'Dual Direct Reporting Leads' : 'Direct Reporting Lead'}
                </span>
              </div>
              
              <div className="space-y-2">
                {isSupervisor && dualLeads.length > 0 ? (
                  dualLeads.map((lead, idx) => (
                    <div key={lead.id || idx} className="p-2.5 bg-[#141518] rounded-2xl border border-amber-500/15 text-xs space-y-0.5">
                      <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">{lead.type}</div>
                      <div className="font-semibold text-neutral-100">{lead.name}</div>
                      <div className="text-[10px] text-amber-200/50 font-mono">{lead.scope}</div>
                    </div>
                  ))
                ) : isBusinessAdmin || isDeptAdmin ? (
                  <div className="p-3 bg-[#141518] rounded-2xl border border-white/5 text-xs text-neutral-300">
                    Direct Functional Lead (Executive Tier)
                  </div>
                ) : profile.manager_name && profile.manager_name !== 'Unassigned' && profile.manager_name !== 'None' ? (
                  <div className="p-3 rounded-2xl border text-xs bg-gradient-to-r from-amber-500/15 to-transparent border-amber-500/30 text-amber-100 font-semibold flex items-center justify-between shadow-[0_0_12px_rgba(212,175,55,0.06)]">
                    <div>
                      <div className="truncate text-white">{profile.manager_name}</div>
                      <div className="text-[10px] text-amber-200/60 font-normal">Matrix Supervisor</div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/20 border border-amber-400/30 px-2 py-0.5 rounded-full font-bold uppercase shrink-0">
                      <Star size={9} className="fill-amber-300 text-amber-300" /> Primary
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-neutral-500 p-2 italic">Direct / Self Lead</div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* OPERATIONAL MATRIX BADGE FOR SUPERVISORS & EMPLOYEES */}
        {!isSuperAdminOrAdmin && profile.matrix_title && (
          <div className="p-3.5 bg-[#0b0c0e] rounded-2xl border border-amber-500/20 flex items-center justify-between text-xs shadow-md">
            <span className="font-semibold text-amber-200/90 flex items-center gap-2">
              <Layers size={13} className="text-amber-400" /> Operational Matrix Branch
            </span>
            <span className="font-mono font-bold text-amber-200 bg-[#16171a] px-3 py-1 rounded-xl border border-amber-500/30 shadow-inner">
              {profile.matrix_title}
            </span>
          </div>
        )}
      </div>

      {/* 3. Workday Schedule & Contact Details */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="bg-[#0b0c0e] p-5 rounded-3xl border border-amber-500/20 shadow-2xl space-y-1.5 hover:border-amber-500/35 transition">
          <div className="flex items-center gap-2 font-bold text-amber-400 uppercase tracking-wider text-[11px]">
            <Clock size={14} className="text-amber-400" /> Shift Timings
          </div>
          <div className="font-mono text-sm font-semibold text-white">
            {String(profile.shift_start_time || '09:00:00').slice(0, 5)} - {String(profile.shift_end_time || '18:00:00').slice(0, 5)}
          </div>
          <p className="text-[11px] text-neutral-400">Shift end controls daily commitment lockouts.</p>
        </div>

        <div className="bg-[#0b0c0e] p-5 rounded-3xl border border-amber-500/20 shadow-2xl space-y-1.5 hover:border-amber-500/35 transition">
          <div className="flex items-center gap-2 font-bold text-amber-400 uppercase tracking-wider text-[11px]">
            <Mail size={14} className="text-amber-400" /> Corporate Email
          </div>
          <div className="text-sm font-semibold text-neutral-100 truncate" title={profile.email || ''}>
            {profile.email || 'Not Configured'}
          </div>
          <p className="text-[11px] text-neutral-400">Used for credentials & password recovery OTP.</p>
        </div>

        <div className="bg-[#0b0c0e] p-5 rounded-3xl border border-amber-500/20 shadow-2xl space-y-1.5 hover:border-amber-500/35 transition">
          <div className="flex items-center gap-2 font-bold text-amber-400 uppercase tracking-wider text-[11px]">
            <Phone size={14} className="text-amber-400" /> Phone Contact
          </div>
          <div className="text-sm font-semibold text-neutral-100 truncate">
            {profile.phone || 'Not Configured'}
          </div>
          <p className="text-[11px] text-neutral-400">Direct contact for escalation notices.</p>
        </div>
      </div>

      {/* 4. Shift Reminders, Idle Timers & Preferences Form */}
      <div className="bg-[#0b0c0e] p-6 sm:p-7 rounded-3xl border border-amber-500/25 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_35px_rgba(212,175,55,0.06)] space-y-5">
        <div className="flex items-center gap-2 font-bold text-white uppercase tracking-wider text-xs border-b border-amber-500/20 pb-3.5">
          <Bell size={15} className="text-amber-400" />
          Shift Reminders & Idle Monitoring Preferences
        </div>

        <form onSubmit={handleSavePreferences} className="space-y-5 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Phone Edit Field */}
            <div className="p-4 bg-gradient-to-b from-[#141518] to-[#101114] rounded-2xl border border-amber-500/15 space-y-1.5">
              <label className="block text-amber-300 font-semibold text-[11px] tracking-wide">Contact Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 XXXXX XXXXX"
                className="w-full bg-[#0b0c0e] border border-amber-500/30 rounded-xl p-2.5 font-mono text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
              />
              <p className="text-[10px] text-neutral-400">Update direct contact mobile line.</p>
            </div>

            {/* Self Idle Trigger Start Time */}
            <div className="p-4 bg-gradient-to-b from-[#141518] to-[#101114] rounded-2xl border border-amber-500/15 space-y-1.5">
              <label className="block text-amber-300 font-semibold text-[11px] tracking-wide">Self Idle Alert Start Time</label>
              <input
                type="time"
                value={String(selfIdleTimer).slice(0, 5)}
                onChange={(e) => setSelfIdleTimer(e.target.value)}
                className="w-full bg-[#0b0c0e] border border-amber-500/30 rounded-xl p-2.5 font-mono text-neutral-100 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
              />
              <p className="text-[10px] text-neutral-400">Idle warning triggers past this hour if 0 tasks are committed.</p>
            </div>

            {/* Team Idle Trigger (Privileged roles only) */}
            {isPrivileged && (
              <div className="p-4 bg-gradient-to-b from-[#141518] to-[#101114] rounded-2xl border border-amber-500/15 space-y-1.5 md:col-span-2">
                <label className="block text-amber-300 font-semibold text-[11px] tracking-wide">
                  Team Idle Oversight Start Time (Management Tier)
                </label>
                <input
                  type="time"
                  value={String(teamIdleTimer).slice(0, 5)}
                  onChange={(e) => setTeamIdleTimer(e.target.value)}
                  className="w-full max-w-xs bg-[#0b0c0e] border border-amber-500/30 rounded-xl p-2.5 font-mono text-neutral-100 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                />
                <p className="text-[10px] text-neutral-400">Alerts you when reporting staff remain on duty without committed tasks past this time.</p>
              </div>
            )}

            {/* End-of-Day Evening Reminder Configuration */}
            <div className="p-4 bg-gradient-to-b from-[#141518] to-[#101114] rounded-2xl border border-amber-500/15 md:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-neutral-100 flex items-center gap-2">
                    <Bell size={13} className="text-amber-400" /> Evening Work Log Reminder
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">
                    Receive daily evening notification before shift end to ensure commitments and progress are logged.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reminderEnabled}
                    onChange={(e) => setReminderEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-900 peer-focus:outline-none rounded-full border border-amber-500/30 peer peer-checked:after:translate-x-full peer-checked:after:border-amber-300 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-300 after:border-neutral-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-amber-500 peer-checked:to-amber-600 peer-checked:after:bg-black"></div>
                </label>
              </div>

              {reminderEnabled && (
                <div className="pt-3 border-t border-amber-500/15 flex items-center gap-3">
                  <span className="text-amber-200/80 font-medium">Daily Reminder Time:</span>
                  <input
                    type="time"
                    step="1"
                    value={String(reminderTime).slice(0, 5)}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="bg-[#0b0c0e] border border-amber-500/30 rounded-xl px-3 py-1.5 text-neutral-100 font-mono outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-xs transition"
                  />
                </div>
              )}
            </div>

          </div>

          {/* Form Actions */}
          <div className="flex justify-end pt-4 border-t border-amber-500/20">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold rounded-xl text-xs tracking-wide shadow-[0_0_20px_rgba(212,175,55,0.25)] hover:shadow-[0_0_25px_rgba(212,175,55,0.4)] transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}