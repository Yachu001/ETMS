import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { UserPlus, X, Shield, Users } from 'lucide-react';

export default function CreateUserModal({ isOpen, onClose, currentUserRole }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('EMPLOYEE');
  const [designation, setDesignation] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [reportsToId, setReportsToId] = useState('');
  
  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isSupervisor = currentUserRole === 'SUPERVISOR';
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(currentUserRole);

  useEffect(() => {
    if (isOpen) {
      setError('');
      // 1. Fetch accessible departments
      api.get('/auth/departments/manage/')
        .then((res) => {
          if (Array.isArray(res.data) && res.data.length > 0) {
            setDepartments(res.data);
            setDepartmentId(res.data[0].id);
          }
        })
        .catch(() => {
          api.get('/auth/departments/')
            .then((res) => {
              if (Array.isArray(res.data) && res.data.length > 0) {
                setDepartments(res.data);
                setDepartmentId(res.data[0].id);
              }
            })
            .catch((err) => console.error('Could not load departments:', err));
        });

      // 2. If Admin, fetch candidate managers
      if (isAdmin) {
        api.get('/auth/managers/candidates/')
          .then((res) => {
            if (Array.isArray(res.data)) {
              setManagers(res.data);
            }
          })
          .catch(() => {
            // Fallback to subordinates list if needed
            api.get('/auth/org/my-subordinates/')
              .then((res) => {
                if (Array.isArray(res.data)) setManagers(res.data);
              })
              .catch(() => {});
          });
      }
    }
  }, [isOpen, isAdmin]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload = {
      username: username.trim(),
      email: email.trim(),
      role: isSupervisor ? 'EMPLOYEE' : role,
      designation: designation.trim(),
      department_id: departmentId ? parseInt(departmentId, 10) : undefined,
      reports_to_id: !isSupervisor && reportsToId ? parseInt(reportsToId, 10) : undefined,
    };

    try {
      await api.post('/auth/users/', payload);
      alert(`User "${username}" created! Default password: TempPass@123`);
      // Reset form
      setUsername('');
      setEmail('');
      setDesignation('');
      setRole('EMPLOYEE');
      setReportsToId('');
      onClose();
    } catch (err) {
      const msg =
        err.response?.data?.role?.[0] ||
        err.response?.data?.username?.[0] ||
        err.response?.data?.email?.[0] ||
        err.response?.data?.detail ||
        'Failed to create user.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
              <UserPlus size={16} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Provision New User</h3>
              <p className="text-[11px] text-slate-400 font-normal">
                {isSupervisor ? 'Create an employee under your supervision' : 'Onboard personnel and configure hierarchy'}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none transition"
              placeholder="e.g. alex_rivera"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Corporate Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none transition"
              placeholder="alex@company.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Role</label>
              {isSupervisor ? (
                <div className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-600 font-medium">
                  Employee
                </div>
              ) : (
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-2.5 py-2 text-sm text-slate-800 outline-none transition"
                >
                  <option value="EMPLOYEE">Employee</option>
                  <option value="SUPERVISOR">Supervisor</option>
                  {currentUserRole === 'SUPER_ADMIN' && <option value="ADMIN">Admin</option>}
                </select>
              )}
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Department</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-2.5 py-2 text-sm text-slate-800 outline-none transition"
              >
                {departments.length === 0 && <option value="">No Departments</option>}
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Direct Manager Assignment (Admins only; for Supervisors, it's automatically self) */}
          {isAdmin && (
            <div>
              <label className="block text-slate-700 font-semibold mb-1 flex items-center justify-between">
                <span>Direct Reporting Manager</span>
                <span className="text-[10px] text-slate-400 font-normal">Optional</span>
              </label>
              <select
                value={reportsToId}
                onChange={(e) => setReportsToId(e.target.value)}
                className="w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-2.5 py-2 text-sm text-slate-800 outline-none transition"
              >
                <option value="">-- No Direct Manager (Direct Org Report) --</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.username} ({m.role}) {m.designation ? `- ${m.designation}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Designation</label>
            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              className="w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none transition"
              placeholder="e.g. Digital Marketing Executive"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-1.5 rounded-lg transition disabled:opacity-50 shadow-xs"
            >
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}