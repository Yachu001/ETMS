// frontend/src/components/PersonalProfileView.jsx

import React, { useState, useEffect } from 'react';
import { 
  User, Mail, Phone, Clock, Network, Building2, 
  Building, Bell, Shield, Layers, CheckCircle2, 
  Calendar, AlertCircle, Save, Star, Globe, Info, Briefcase
} from 'lucide-react';
import api from '../api/axios';

const ROLE_BADGE_STYLES = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
  ADMIN: 'bg-blue-100 text-blue-800 border-blue-200',
  BUSINESS_ADMIN: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  DEPT_HEAD: 'bg-teal-100 text-teal-800 border-teal-200',
  SUPERVISOR: 'bg-amber-100 text-amber-900 border-amber-200',
  EMPLOYEE: 'bg-slate-100 text-slate-700 border-slate-200',
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
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-400">
        Loading personal master details...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-rose-500">
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
    <div className="space-y-6 max-w-5xl mx-auto pb-10 text-slate-800">
      
      {/* 1. Header Identity Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-2xl shadow-xs shrink-0">
            {(profile.full_name || profile.username || 'U').substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900">
                {profile.full_name || profile.username}
              </h2>
              <span className={`font-mono text-xs px-2.5 py-0.5 rounded-md border font-bold ${ROLE_BADGE_STYLES[role] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                {role.replace('_', ' ')}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                profile.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {profile.is_active ? 'Active' : 'Disabled'}
              </span>
              {profile.is_present !== undefined && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  profile.is_present ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {profile.is_present ? 'Duty: Present' : 'Duty: Offline'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-mono mt-1">
              {profile.designation || 'Staff Associate'} &bull; EID: <span className="font-semibold text-slate-700">{profile.employee_code || `EID-${profile.id}`}</span> &bull; @{profile.username}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs self-start sm:self-center">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-right">
            <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-end gap-1">
              <Calendar size={11} /> Date of Joining
            </span>
            <span className="font-mono font-semibold text-slate-800 text-xs">
              {profile.date_of_joining ? String(profile.date_of_joining).slice(0, 10) : 'Not Specified'}
            </span>
          </div>
        </div>
      </div>

      {/* Alert Notices */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2. Organizational Matrix & Scoping Section */}
      <div className="space-y-3">
        <h3 className="font-bold text-slate-700 uppercase tracking-wider text-xs flex items-center gap-1.5 px-1">
          <Layers size={14} className="text-blue-600" />
          Linked Organizational Matrix & Hierarchy Scope
        </h3>

        {/* CASE A: ADMIN / SUPER ADMIN - GLOBAL SCOPE */}
        {isSuperAdminOrAdmin ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 border-b border-slate-100 pb-2">
              <Globe size={15} className="text-blue-600" />
              Global Platform Governance & Scope
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200 space-y-1">
                <span className="text-[10px] text-blue-600 uppercase font-bold tracking-wider">Business Alignment</span>
                <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Building2 size={15} className="text-blue-700" /> All Operating Businesses (Organization-Wide)
                </div>
                <p className="text-[11px] text-slate-500">Full executive authority across all child companies & corporate entities.</p>
              </div>

              <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-200 space-y-1">
                <span className="text-[10px] text-indigo-600 uppercase font-bold tracking-wider">Departmental Scope</span>
                <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Building size={15} className="text-indigo-700" /> All Functional Departments
                </div>
                <p className="text-[11px] text-slate-500">Full operational access across all organizational departments & units.</p>
              </div>
            </div>
          </div>
        ) : (
          /* CASE B: BUSINESS ADMIN, DEPT ADMIN, SUPERVISOR & BASE EMPLOYEE */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* BUSINESS CARD */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Building2 size={14} className="text-blue-600" />
                  {isDeptAdmin ? 'Business Scope' : 'Assigned Business'}
                </span>
                {isDeptAdmin && (
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold px-1.5 py-0.5 rounded">
                    All Businesses
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {isDeptAdmin ? (
                  <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-200 text-xs font-semibold text-indigo-900">
                    Active across all operating businesses
                  </div>
                ) : profile.business_name ? (
                  <div className="p-2.5 rounded-xl border text-xs bg-blue-50/60 border-blue-200 text-blue-950 font-semibold flex items-center justify-between">
                    <span className="truncate">{profile.business_name} {profile.business_code ? `(${profile.business_code})` : ''}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full font-bold uppercase">
                      <Star size={9} className="fill-emerald-600 text-emerald-600" /> Primary
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic p-2">No business associated</div>
                )}
              </div>
            </div>

            {/* DEPARTMENT CARD */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Building size={14} className="text-teal-600" />
                  {isBusinessAdmin ? 'Department Scope' : 'Assigned Department'}
                </span>
                {isBusinessAdmin && (
                  <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-semibold px-1.5 py-0.5 rounded">
                    All Departments
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {isBusinessAdmin ? (
                  <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-200 text-xs font-semibold text-blue-900">
                    Active across all departments in this business
                  </div>
                ) : profile.department_name ? (
                  <div className="p-2.5 rounded-xl border text-xs bg-teal-50/60 border-teal-200 text-teal-950 font-semibold flex items-center justify-between">
                    <span className="truncate">{profile.department_name}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full font-bold uppercase">
                      <Star size={9} className="fill-emerald-600 text-emerald-600" /> Primary
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic p-2">No department associated</div>
                )}
              </div>
            </div>

            {/* DIRECT REPORTING LINE */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Network size={14} className="text-emerald-600" />
                  {isSupervisor ? 'Dual Direct Reporting Leads' : 'Direct Reporting Lead'}
                </span>
              </div>
              
              <div className="space-y-1.5">
                {isSupervisor && dualLeads.length > 0 ? (
                  dualLeads.map((lead, idx) => (
                    <div key={lead.id || idx} className="p-2 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs">
                      <div className="text-[10px] uppercase font-bold text-indigo-600">{lead.type}</div>
                      <div className="font-semibold text-slate-800">{lead.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{lead.scope}</div>
                    </div>
                  ))
                ) : isBusinessAdmin || isDeptAdmin ? (
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                    Direct Functional Lead (Executive Tier)
                  </div>
                ) : profile.manager_name && profile.manager_name !== 'Unassigned' && profile.manager_name !== 'None' ? (
                  <div className="p-2.5 rounded-xl border text-xs bg-emerald-50/60 border-emerald-200 text-emerald-950 font-semibold flex items-center justify-between">
                    <div>
                      <div className="truncate">{profile.manager_name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">Matrix Supervisor</div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full font-bold uppercase">
                      <Star size={9} className="fill-emerald-600 text-emerald-600" /> Primary
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 p-2 italic">Direct / Self Lead</div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* OPERATIONAL MATRIX BADGE FOR SUPERVISORS & EMPLOYEES */}
        {!isSuperAdminOrAdmin && profile.matrix_title && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Layers size={13} className="text-blue-600" /> Operational Matrix Branch
            </span>
            <span className="font-mono font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              {profile.matrix_title}
            </span>
          </div>
        )}
      </div>

      {/* 3. Workday Schedule & Contact Details */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
            <Clock size={14} className="text-blue-600" /> Shift Timings
          </div>
          <div className="font-mono text-sm font-semibold text-slate-800">
            {String(profile.shift_start_time || '09:00:00').slice(0, 5)} - {String(profile.shift_end_time || '18:00:00').slice(0, 5)}
          </div>
          <p className="text-[11px] text-slate-400">Shift end controls daily commitment lockouts.</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
            <Mail size={14} className="text-purple-600" /> Corporate Email
          </div>
          <div className="text-sm font-semibold text-slate-800 truncate" title={profile.email || ''}>
            {profile.email || 'Not Configured'}
          </div>
          <p className="text-[11px] text-slate-400">Used for credentials & password recovery OTP.</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
            <Phone size={14} className="text-emerald-600" /> Phone Contact
          </div>
          <div className="text-sm font-semibold text-slate-800 truncate">
            {profile.phone || 'Not Configured'}
          </div>
          <p className="text-[11px] text-slate-400">Direct contact for escalation notices.</p>
        </div>
      </div>

      {/* 4. Shift Reminders, Idle Timers & Preferences Form */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5">
        <div className="flex items-center gap-2 font-bold text-slate-800 uppercase tracking-wider text-xs border-b border-slate-100 pb-3">
          <Bell size={15} className="text-amber-500" />
          Shift Reminders & Idle Monitoring Preferences
        </div>

        <form onSubmit={handleSavePreferences} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Phone Edit Field */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <label className="block text-slate-700 font-semibold text-[11px]">Contact Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 XXXXX XXXXX"
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-[10px] text-slate-400">Update direct contact mobile line.</p>
            </div>

            {/* Self Idle Trigger Start Time */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <label className="block text-slate-700 font-semibold text-[11px]">Self Idle Alert Start Time</label>
              <input
                type="time"
                value={String(selfIdleTimer).slice(0, 5)}
                onChange={(e) => setSelfIdleTimer(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-[10px] text-slate-400">Idle warning triggers past this hour if 0 tasks are committed.</p>
            </div>

            {/* Team Idle Trigger (Privileged roles only) */}
            {isPrivileged && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1 md:col-span-2">
                <label className="block text-slate-700 font-semibold text-[11px]">
                  Team Idle Oversight Start Time (Management Tier)
                </label>
                <input
                  type="time"
                  value={String(teamIdleTimer).slice(0, 5)}
                  onChange={(e) => setTeamIdleTimer(e.target.value)}
                  className="w-full max-w-xs bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
                />
                <p className="text-[10px] text-slate-400">Alerts you when reporting staff remain on duty without committed tasks past this time.</p>
              </div>
            )}

            {/* End-of-Day Evening Reminder Configuration */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 md:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800 flex items-center gap-2">
                    <Bell size={13} className="text-amber-600" /> Evening Work Log Reminder
                  </div>
                  <div className="text-[11px] text-slate-500">
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
                  <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {reminderEnabled && (
                <div className="pt-2 border-t border-slate-200 flex items-center gap-3">
                  <span className="text-slate-600 font-medium">Daily Reminder Time:</span>
                  <input
                    type="time"
                    step="1"
                    value={String(reminderTime).slice(0, 5)}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 font-mono outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                  />
                </div>
              )}
            </div>

          </div>

          {/* Form Actions */}
          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium transition cursor-pointer disabled:opacity-50 shadow-2xs"
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