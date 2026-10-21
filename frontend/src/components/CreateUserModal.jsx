import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { UserPlus, X } from 'lucide-react';

export default function CreateUserModal({ isOpen, onClose, currentUserRole }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('EMPLOYEE');
  const [designation, setDesignation] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      api.get('/auth/departments/')
        .then(res => {
          setDepartments(res.data);
          if (res.data.length > 0) setDepartmentId(res.data[0].id);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/auth/users/', {
        username,
        email,
        role,
        designation,
        department_id: departmentId ? parseInt(departmentId) : undefined,
      });
      alert(`User "${username}" created! Default password: TempPass@123`);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.role?.[0] || err.response?.data?.username?.[0] || 'Failed to create user.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
        
        <div className="flex justify-between items-center border-b border-slate-700 pb-3">
          <div className="flex items-center gap-2 text-white font-bold">
            <UserPlus className="text-emerald-400" size={18} />
            <h3>Provision New User</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white"
              placeholder="e.g. alex_rivera"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Corporate Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white"
              placeholder="alex@company.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-2 text-sm text-white"
              >
                <option value="EMPLOYEE">Employee</option>
                {currentUserRole !== 'SUPERVISOR' && (
                  <>
                    <option value="SUPERVISOR">Supervisor</option>
                    <option value="ADMIN">Admin</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Department</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-2 text-sm text-white"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Designation</label>
            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white"
              placeholder="e.g. Digital Marketing Executive"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-slate-700 rounded text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-1.5 rounded transition disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}