import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { X, UserCheck, AlertCircle, Save } from 'lucide-react';

export default function EmployeeEditModal({ isOpen, onClose, employee, currentUserRole, onEmployeeUpdated }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [role, setRole] = useState('EMPLOYEE');
  const [shiftStart, setShiftStart] = useState('09:00');
  const [shiftEnd, setShiftEnd] = useState('18:00');
  const [departmentId, setDepartmentId] = useState('');
  const [businessIds, setBusinessIds] = useState([]);
  const [reportsToId, setReportsToId] = useState('');

  const [departments, setDepartments] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [eligibleManagers, setEligibleManagers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isAdminTier = ['ADMIN', 'SUPER_ADMIN'].includes(currentUserRole);

  useEffect(() => {
    if (employee && isOpen) {
      setFullName(employee.full_name || '');
      setEmail(employee.email || '');
      setPhone(employee.phone || '');
      setDesignation(employee.designation || '');
      setRole(employee.role || 'EMPLOYEE');
      setShiftStart(employee.shift_start_time || '09:00');
      setShiftEnd(employee.shift_end_time || '18:00');
      setDepartmentId(employee.primary_department_id || '');
      setReportsToId(employee.primary_manager_id || '');
      setBusinessIds(employee.businesses ? employee.businesses.map(b => b.id) : []);
      setError(null);

      // Load master catalogs
      if (isAdminTier) {
        api.get('/auth/departments/')
          .then((res) => setDepartments(res.data))
          .catch(() => {});

        api.get('/auth/businesses/')
          .then((res) => setBusinesses(res.data))
          .catch(() => {});

        api.get('/auth/employees/manage/')
          .then((res) => {
            const filtered = res.data.filter((u) => u.id !== employee.id && ['SUPERVISOR', 'ADMIN', 'SUPER_ADMIN'].includes(u.role));
            setEligibleManagers(filtered);
          })
          .catch(() => {});
      }
    }
  }, [employee, isOpen, currentUserRole, isAdminTier]);

  if (!isOpen || !employee) return null;

  const handleBusinessToggle = (bizId) => {
    setBusinessIds(prev => 
      prev.includes(bizId) ? prev.filter(id => id !== bizId) : [...prev, bizId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      full_name: fullName,
      email,
      phone,
      designation,
      shift_start_time: shiftStart,
      shift_end_time: shiftEnd,
    };

    if (isAdminTier) {
      payload.role = role;
      if (departmentId) payload.department_id = departmentId;
      if (reportsToId) payload.reports_to_id = reportsToId;
      payload.business_ids = businessIds;
    }

    try {
      await api.patch(`/auth/employees/manage/${employee.id}/`, payload);
      onEmployeeUpdated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update employee details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <UserCheck className="text-blue-600" size={18} />
            <h3 className="font-bold text-slate-900 text-base">Edit Employee Profile & Entities</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Designation</label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Shift Start</label>
              <input
                type="time"
                value={shiftStart}
                onChange={(e) => setShiftStart(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Shift End</label>
              <input
                type="time"
                value={shiftEnd}
                onChange={(e) => setShiftEnd(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Admin Tier Fields */}
          {isAdminTier && (
            <>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Role Tier</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="SUPERVISOR">Supervisor</option>
                    <option value="BUSINESS_ADMIN">Business Admin</option>
                    <option value="DEPT_HEAD">Department Head (CMO/CFO)</option>
                    {currentUserRole === 'SUPER_ADMIN' && <option value="ADMIN">Admin</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Primary Department</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select Department...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Businesses Selector */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Assigned Businesses / Companies</label>
                <div className="flex flex-wrap gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  {businesses.map((biz) => {
                    const isChecked = businessIds.includes(biz.id);
                    return (
                      <button
                        key={biz.id}
                        type="button"
                        onClick={() => handleBusinessToggle(biz.id)}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition border ${
                          isChecked 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs' 
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {biz.name} ({biz.code})
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Direct Reporting Manager</label>
                <select
                  value={reportsToId}
                  onChange={(e) => setReportsToId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">No Direct Manager / Top Level</option>
                  {eligibleManagers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name || m.username} ({m.role}) — {m.designation || 'Staff'}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition disabled:opacity-50 shadow-xs"
            >
              <Save size={14} />
              {loading ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}