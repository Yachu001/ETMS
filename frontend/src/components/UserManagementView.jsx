import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Search, Shield, Building2, Building, 
  CheckCircle, XCircle, Edit2, Eye, UserX, Clock, X, Lock
} from 'lucide-react';
import api from '../api/axios';
import EmployeeProfileModal from './EmployeeProfileModal';

export default function UserManagementView({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [viewingProfileUser, setViewingProfileUser] = useState(null);

  // Metadata state
  const [formOptions, setFormOptions] = useState({
    businesses: [],
    departments: [],
    candidate_managers: [],
    defaults: {}
  });

  useEffect(() => {
    fetchUsers();
    fetchFormOptions();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/employees/manage/');
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFormOptions = async () => {
    try {
      // 1. Primary: Load scoped form options from dedicated endpoint
      const res = await api.get('/auth/employees/manage/form-options/');
      setFormOptions(res.data);
    } catch (e) {
      console.warn('Form options endpoint unavailable, falling back to standard list APIs');
      try {
        const [bizRes, deptRes] = await Promise.all([
          api.get('/auth/businesses/'),
          api.get('/auth/departments/')
        ]);
        setFormOptions({
          businesses: bizRes.data,
          departments: deptRes.data,
          candidate_managers: [],
          defaults: {}
        });
      } catch (err) {
        console.error('Fallback metadata fetch failed', err);
      }
    }
  };

  const handleToggleStatus = async (user) => {
    const actionText = user.is_active ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${actionText} the account for ${user.username}?`)) return;
    try {
      await api.patch(`/auth/employees/manage/${user.id}/toggle-status/`);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to toggle status.');
    }
  };

  const roleBadgeStyles = {
    SUPER_ADMIN: 'bg-rose-100 text-rose-800 border-rose-200',
    DEPT_HEAD: 'bg-purple-100 text-purple-800 border-purple-200',
    BUSINESS_ADMIN: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    ADMIN: 'bg-amber-100 text-amber-800 border-amber-200',
    SUPERVISOR: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    EMPLOYEE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  // Helper: Display items with star for primary
  const renderRelationshipCell = (items, fallbackText, primaryKey = 'is_primary', nameKey = 'name') => {
    if (!items || items.length === 0) {
      return <span className="text-slate-400 italic text-[11px]">{fallbackText}</span>;
    }

    if (items.length === 1) {
      const item = items[0];
      return (
        <span className="font-medium text-slate-800 text-xs">
          {item[nameKey] || item.username || item.code}
        </span>
      );
    }

    const primaryItem = items.find((i) => i[primaryKey]) || items[0];
    const otherCount = items.length - 1;

    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1 font-medium text-slate-800 text-xs">
          <span>{primaryItem[nameKey] || primaryItem.username || primaryItem.code}</span>
          <span className="text-amber-500 font-bold text-xs" title="Primary">★</span>
        </div>
        {otherCount > 0 && (
          <div className="text-[10px] text-slate-400">
            +{otherCount} more
          </div>
        )}
      </div>
    );
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.employee_code || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q);

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus = 
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && u.is_active) ||
      (statusFilter === 'DISABLED' && !u.is_active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Search Bar */}
        <div className="relative w-full md:w-80 self-start">
          <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, username, EID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
          />
        </div>

        {/* Right: Filters & Create User Button */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end self-end">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
          >
            <option value="ALL">All Roles</option>
            {currentUser.role === 'SUPER_ADMIN' && <option value="ADMIN">Main Admins</option>}
            {['SUPER_ADMIN', 'ADMIN'].includes(currentUser.role) && (
              <>
                <option value="DEPT_HEAD">Dept Heads</option>
                <option value="BUSINESS_ADMIN">Business Admins</option>
              </>
            )}
            <option value="SUPERVISOR">Supervisors</option>
            <option value="EMPLOYEE">Employees</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="DISABLED">Disabled Only</option>
          </select>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-xs shrink-0"
          >
            <UserPlus size={15} /> + Create User
          </button>
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Role & Designation</th>
                <th className="py-3 px-4">Business</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Reports To</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-400">Loading directory...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-400">No users match your criteria.</td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition">
                    {/* Employee */}
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-semibold text-slate-900">{u.full_name || u.username}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {u.employee_code || `EID-${u.id}`} • @{u.username}
                        </div>
                      </div>
                    </td>

                    {/* Role & Designation */}
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        roleBadgeStyles[u.role] || 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {u.role}
                      </span>
                      <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                        {u.designation || 'Staff'}
                      </div>
                    </td>

                    {/* Business */}
                    <td className="py-3 px-4">
                      {renderRelationshipCell(u.businesses, 'No Business', 'is_primary', 'name')}
                    </td>

                    {/* Department */}
                    <td className="py-3 px-4">
                      {renderRelationshipCell(u.departments, 'No Department', 'is_primary', 'name')}
                    </td>

                    {/* Reports To */}
                    <td className="py-3 px-4">
                      {renderRelationshipCell(u.reporting_managers, 'None', 'is_primary', 'full_name')}
                    </td>

                    {/* Status Column */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {u.is_active ? (
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <span>Active</span>
                          {u.is_present ? (
                            <span className="relative flex h-2 w-2" title="Present / On Duty">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                          ) : (
                            <span 
                              className="inline-flex rounded-full h-2 w-2 bg-slate-300" 
                              title="On Leave / Offline"
                            ></span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle size={12} /> Disabled
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="View Profile"
                          onClick={() => setViewingProfileUser(u)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-indigo-600 transition"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          title="Edit Profile"
                          onClick={() => setEditingUser(u)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-blue-600 transition"
                        >
                          <Edit2 size={15} />
                        </button>
                        {u.id !== currentUser.id && (
                          <button
                            title={u.is_active ? 'Disable Account' : 'Enable Account'}
                            onClick={() => handleToggleStatus(u)}
                            className={`p-1.5 hover:bg-slate-100 rounded-lg transition ${
                              u.is_active ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'
                            }`}
                          >
                            <UserX size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Profile Modal */}
      {viewingProfileUser && (
        <EmployeeProfileModal
          user={viewingProfileUser}
          onClose={() => setViewingProfileUser(null)}
        />
      )}

      {/* Scoped Create User Modal */}
      {isCreateOpen && (
        <ScopedCreateUserModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          currentUser={currentUser}
          formOptions={formOptions}
          onSuccess={() => {
            setIsCreateOpen(false);
            fetchUsers();
          }}
        />
      )}

      {/* Full Edit User Modal */}
      {editingUser && (
        <FullEditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          currentUser={currentUser}
          formOptions={formOptions}
          onSuccess={() => {
            setEditingUser(null);
            fetchUsers();
          }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// SCOPED USER CREATION MODAL WITH AUTOMATIC MATRIX BINDING
// -------------------------------------------------------------
function ScopedCreateUserModal({ isOpen, onClose, currentUser, formOptions, onSuccess }) {
  const { businesses, departments, candidate_managers, defaults } = formOptions;

  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    email: '',
    phone: '',
    role: 'EMPLOYEE',
    designation: '',
    department_id: '',
    business_ids: [],
    reports_to_id: '',
    shift_start_time: '09:00:00',
    shift_end_time: '18:00:00',
    date_of_joining: new Date().toISOString().split('T')[0],
    password: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Initialize auto-selected single items and locks
  useEffect(() => {
    setFormData(prev => {
      const next = { ...prev };

      // Role Auto-lock
      if (currentUser.role === 'SUPERVISOR') {
        next.role = 'EMPLOYEE';
        next.reports_to_id = currentUser.id;
      }

      // Department Auto-selection
      if (defaults.department_id) {
        next.department_id = defaults.department_id;
      } else if (departments.length === 1) {
        next.department_id = departments[0].id;
      }

      // Business Auto-selection
      if (defaults.business_id) {
        next.business_ids = [defaults.business_id];
      } else if (businesses.length === 1) {
        next.business_ids = [businesses[0].id];
      }

      return next;
    });
  }, [defaults, departments, businesses, currentUser]);

  const getSelectableRoles = () => {
    if (currentUser.role === 'SUPER_ADMIN') {
      return ['ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD', 'SUPERVISOR', 'EMPLOYEE'];
    }
    if (currentUser.role === 'ADMIN') {
      return ['BUSINESS_ADMIN', 'DEPT_HEAD', 'SUPERVISOR', 'EMPLOYEE'];
    }
    if (['BUSINESS_ADMIN', 'DEPT_HEAD'].includes(currentUser.role)) {
      return ['SUPERVISOR', 'EMPLOYEE'];
    }
    return ['EMPLOYEE'];
  };

  const isSupervisor = currentUser.role === 'SUPERVISOR';
  const isBusinessLocked = defaults.is_business_locked || (businesses.length === 1 && !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role));
  const isDepartmentLocked = defaults.is_department_locked || (departments.length === 1 && !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = { ...formData };
    if (!payload.department_id) delete payload.department_id;
    if (!payload.business_ids || payload.business_ids.length === 0) delete payload.business_ids;
    if (!payload.reports_to_id) delete payload.reports_to_id;
    if (!payload.password) delete payload.password; // Django fallback: TempPass@123

    try {
      await api.post('/auth/employees/manage/', payload);
      onSuccess();
    } catch (err) {
      const errData = err.response?.data;
      setError(typeof errData === 'object' ? JSON.stringify(errData) : 'Failed to provision user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-bold text-slate-900">Provision New User</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
            <X size={18} />
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-lg">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Username *</label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
              <select
                value={formData.role}
                disabled={isSupervisor}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
              >
                {getSelectableRoles().map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Designation</label>
              <input
                type="text"
                placeholder="e.g. Associate Analyst"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Operating Business Dropdown */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center justify-between">
                <span>Operating Business</span>
                {isBusinessLocked && <Lock size={12} className="text-slate-400" title="Locked by your matrix role" />}
              </label>
              <select
                value={formData.business_ids?.[0] || ''}
                disabled={isBusinessLocked}
                onChange={(e) => {
                  const val = e.target.value ? [parseInt(e.target.value)] : [];
                  setFormData({ ...formData, business_ids: val });
                }}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-600 font-medium"
              >
                {!isBusinessLocked && <option value="">Select Business</option>}
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>

            {/* Department Dropdown */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center justify-between">
                <span>Department</span>
                {isDepartmentLocked && <Lock size={12} className="text-slate-400" title="Locked by your matrix role" />}
              </label>
              <select
                value={formData.department_id || ''}
                disabled={isDepartmentLocked}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-600 font-medium"
              >
                {!isDepartmentLocked && <option value="">Select Department</option>}
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Reporting Line Assignment */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center justify-between">
              <span>Direct Reporting Manager</span>
              {isSupervisor && <Lock size={12} className="text-slate-400" title="Subordinates report directly to you" />}
            </label>
            <select
              value={formData.reports_to_id || ''}
              disabled={isSupervisor}
              onChange={(e) => setFormData({ ...formData, reports_to_id: e.target.value })}
              className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-600 font-medium"
            >
              {isSupervisor ? (
                <option value={currentUser.id}>{currentUser.full_name || currentUser.username} (Self)</option>
              ) : (
                <>
                  <option value="">Default (Direct to Current User)</option>
                  {candidate_managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name || m.username} ({m.role})
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Shift Start & End Boundaries */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Shift Start Time</label>
              <input
                type="time"
                value={formData.shift_start_time}
                onChange={(e) => setFormData({ ...formData, shift_start_time: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Shift End Time</label>
              <input
                type="time"
                value={formData.shift_end_time}
                onChange={(e) => setFormData({ ...formData, shift_end_time: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Custom Password (Optional)</label>
            <input
              type="password"
              placeholder="Leave blank for 'TempPass@123'"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-medium transition shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Provisioning...' : 'Provision User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// FULL USER EDIT MODAL (ALL FIELDS EDITABLE EXCEPT EID)
// -------------------------------------------------------------
function FullEditUserModal({ user, onClose, currentUser, formOptions, onSuccess }) {
  const { businesses, departments, candidate_managers, defaults } = formOptions;

  const [formData, setFormData] = useState({
    full_name: user.full_name || '',
    username: user.username || '',
    email: user.email || '',
    phone: user.phone || '',
    designation: user.designation || '',
    role: user.role,
    department_id: user.primary_department_id || (user.departments?.[0]?.id || ''),
    business_ids: (user.businesses || []).map(b => b.id),
    reports_to_id: user.primary_manager_id || (user.reporting_managers?.[0]?.id || ''),
    shift_start_time: user.shift_start_time || '09:00:00',
    shift_end_time: user.shift_end_time || '18:00:00',
    date_of_joining: user.date_of_joining || ''
  });
  const [submitting, setSubmitting] = useState(false);

  const canEditRoles = ['SUPER_ADMIN', 'ADMIN'].includes(currentUser.role);
  const canEditReporting = ['SUPER_ADMIN', 'ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD'].includes(currentUser.role);
  const isBusinessLocked = defaults.is_business_locked && currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'ADMIN';
  const isDepartmentLocked = defaults.is_department_locked && currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'ADMIN';

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.patch(`/auth/employees/manage/${user.id}/`, formData);
      onSuccess();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update employee details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Edit Profile: {user.username}</h2>
            <p className="text-[11px] text-slate-400">
              Employee ID: <span className="font-mono font-semibold text-slate-700">{user.employee_code || `EID-${user.id}`} (Read-only)</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleUpdate} className="space-y-3.5 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Username *</label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Designation</label>
              <input
                type="text"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Date of Joining</label>
              <input
                type="date"
                value={formData.date_of_joining}
                onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Primary Business</label>
              <select
                value={formData.business_ids?.[0] || ''}
                disabled={isBusinessLocked}
                onChange={(e) => {
                  const val = e.target.value ? [parseInt(e.target.value)] : [];
                  setFormData({ ...formData, business_ids: val });
                }}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-600 font-medium"
              >
                <option value="">No Business</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
              <select
                value={formData.department_id || ''}
                disabled={isDepartmentLocked}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-600 font-medium"
              >
                <option value="">No Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {canEditReporting && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Reporting Lead / Manager</label>
              <select
                value={formData.reports_to_id || ''}
                onChange={(e) => setFormData({ ...formData, reports_to_id: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
              >
                <option value="">None (Top-Level)</option>
                {candidate_managers.map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name || m.username} ({m.role})</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Shift Start</label>
              <input
                type="time"
                value={formData.shift_start_time}
                onChange={(e) => setFormData({ ...formData, shift_start_time: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Shift End</label>
              <input
                type="time"
                value={formData.shift_end_time}
                onChange={(e) => setFormData({ ...formData, shift_end_time: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
              />
            </div>
          </div>

          {canEditRoles && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Role Tier</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {currentUser.role === 'SUPER_ADMIN' && <option value="ADMIN">ADMIN</option>}
                <option value="DEPT_HEAD">DEPT_HEAD</option>
                <option value="BUSINESS_ADMIN">BUSINESS_ADMIN</option>
                <option value="SUPERVISOR">SUPERVISOR</option>
                <option value="EMPLOYEE">EMPLOYEE</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save & Apply'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}