import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { 
  User, 
  Building, 
  Building2, 
  Network, 
  Mail, 
  Phone, 
  Clock, 
  Bell, 
  Star, 
  ShieldCheck, 
  Save, 
  AlertCircle, 
  CheckCircle2,
  Calendar
} from 'lucide-react';

export default function PersonalProfileView({ currentUser, onProfileUpdated }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Editable local fields
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState('17:45:00');
  const [phone, setPhone] = useState('');

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/me/');
      const data = res.data;
      setProfile(data);
      setReminderEnabled(data.reminder_enabled ?? true);
      setReminderTime(data.reminder_time || '17:45:00');
      setPhone(data.phone || '');
    } catch (err) {
      setErrorMsg('Failed to fetch personal profile details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const payload = {
        reminder_enabled: reminderEnabled,
        reminder_time: reminderTime,
        phone: phone.trim()
      };
      const res = await api.patch('/auth/me/', payload);
      setProfile(res.data);
      setSuccessMsg('Your personal preferences were updated successfully.');
      if (onProfileUpdated) onProfileUpdated(res.data);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-xs text-slate-400">
        Loading personal details...
      </div>
    );
  }

  if (!profile) return null;

  // Primary Badge Component
  const PrimaryBadge = () => (
    <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ml-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
      Primary
    </span>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Top Banner Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-2xl shadow-xs">
            {(profile.full_name || profile.username || 'U').substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{profile.full_name || profile.username}</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold bg-blue-50 text-blue-700 border-blue-200">
                {profile.role}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {profile.designation || 'Staff Associate'} • {profile.employee_code || 'ID-NA'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border bg-slate-50 border-slate-200 text-slate-700 font-medium">
            <ShieldCheck size={14} className="text-blue-600" />
            {profile.is_active ? 'Account Active' : 'Account Inactive'}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-medium ${
            profile.is_present 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${profile.is_present ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            {profile.is_present ? 'On-Duty Today' : 'On Leave'}
          </span>
        </div>
      </div>

      {/* Notifications / Alerts */}
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

      {/* Scope Sections: Businesses, Departments & Reporting Hierarchy */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* 1. BUSINESSES */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
            <Building2 size={16} className="text-indigo-600" />
            Associated Businesses
          </div>
          <div className="space-y-2">
            {profile.businesses && profile.businesses.length > 0 ? (
              profile.businesses.map((b) => (
                <div 
                  key={b.id} 
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition ${
                    b.is_primary 
                      ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950 font-semibold' 
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div>
                    <span>{b.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono ml-1.5">({b.code})</span>
                  </div>
                  {b.is_primary && <PrimaryBadge />}
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic">No business linked</p>
            )}
          </div>
        </div>

        {/* 2. DEPARTMENTS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
            <Building size={16} className="text-blue-600" />
            Associated Departments
          </div>
          <div className="space-y-2">
            {profile.departments && profile.departments.length > 0 ? (
              profile.departments.map((d) => (
                <div 
                  key={d.id} 
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition ${
                    d.is_primary 
                      ? 'bg-blue-50/70 border-blue-200 text-blue-950 font-semibold' 
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <span>{d.name}</span>
                  {d.is_primary && <PrimaryBadge />}
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic">No department linked</p>
            )}
          </div>
        </div>

        {/* 3. REPORTING MANAGERS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
            <Network size={16} className="text-emerald-600" />
            Reporting Leads
          </div>
          <div className="space-y-2">
            {profile.reporting_managers && profile.reporting_managers.length > 0 ? (
              profile.reporting_managers.map((m) => (
                <div 
                  key={m.id} 
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition ${
                    m.is_primary 
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950 font-semibold' 
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div>
                    <span>{m.full_name || m.username}</span>
                    <span className="text-[10px] text-slate-400 block font-normal">{m.designation}</span>
                  </div>
                  {m.is_primary && <PrimaryBadge />}
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic">Direct / Top-Level Management</p>
            )}
          </div>
        </div>
      </div>

      {/* Profile Details & Workday Parameters Form */}
      <form onSubmit={handleSavePreferences} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
        <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
          <Clock size={16} className="text-blue-600" /> Duty Timings & Workday Preferences
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          
          {/* Email */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-slate-400 uppercase font-semibold text-[10px] flex items-center gap-1.5">
              <Mail size={12} /> Corporate Email
            </span>
            <div className="font-medium text-slate-800">{profile.email || 'Not assigned'}</div>
          </div>

          {/* Shift Schedule */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-slate-400 uppercase font-semibold text-[10px] flex items-center gap-1.5">
              <Clock size={12} /> Shift Schedule (Check-in / Out)
            </span>
            <div className="font-mono font-medium text-slate-800">
              {profile.shift_start_time || '09:00:00'} — {profile.shift_end_time || '18:00:00'}
            </div>
          </div>

          {/* Phone Field (Self-editable) */}
          <div className="p-3 bg-white rounded-xl border border-slate-300 space-y-1.5">
            <label className="text-slate-700 font-semibold text-[11px] flex items-center gap-1.5">
              <Phone size={12} className="text-blue-600" /> Contact Mobile Number
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 XXXXX XXXXX"
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
          </div>

          {/* Date of Joining */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-slate-400 uppercase font-semibold text-[10px] flex items-center gap-1.5">
              <Calendar size={12} /> Date of Joining
            </span>
            <div className="font-mono font-medium text-slate-800">
              {profile.date_of_joining || 'N/A'}
            </div>
          </div>

          {/* End-of-Day Reminder Config */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 md:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-semibold text-slate-800 flex items-center gap-2">
                  <Bell size={14} className="text-amber-600" /> Daily Work Log Reminder
                </div>
                <div className="text-[11px] text-slate-500">
                  Receive daily prompt before shift ends to ensure commitments and progress are logged.
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {reminderEnabled && (
              <div className="pt-2 border-t border-slate-200 flex items-center gap-3">
                <span className="text-slate-600 font-medium">Daily Reminder Time:</span>
                <input
                  type="time"
                  step="1"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 font-mono outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                />
              </div>
            )}
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs px-4 py-2 rounded-xl font-medium transition disabled:opacity-50 shadow-xs"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </form>
    </div>
  );
}