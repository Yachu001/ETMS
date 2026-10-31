import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Search, Shield, Building2, Building, 
  CheckCircle, XCircle, Edit2, Eye, UserX, Clock, X, Lock, Layers, Network
} from 'lucide-react';
import api from '../api/axios';
import UserProfileModal from './UserProfileModal';

export default function UserManagementView({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [viewingProfileUserId, setViewingProfileUserId] = useState(null);

  // Form options from backend
  const [formOptions, setFormOptions] = useState({
    matrices: [],
    businesses: [],
    departments: [],
    currentUser: {}
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
      const res = await api.get('/auth/employees/manage/form-options/');
      setFormOptions(res.data);
    } catch (err) {
      console.error('Failed to fetch form options', err);
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
        <div className="relative w-full md:w-80 self-start">
          <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, username, EID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end self-end">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
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
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="DISABLED">Disabled Only</option>
          </select>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-xs shrink-0 cursor-pointer"
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
                <th className="py-3 px-4">Assigned Matrix</th>
                <th className="py-3 px-4">Business</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Direct Lead</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-slate-400">Loading directory...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-slate-400">No users match your criteria.</td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-semibold text-slate-900">{u.full_name || u.username}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {u.employee_code || `EID-${u.id}`} • @{u.username}
                        </div>
                      </div>
                    </td>

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

                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800">
                        {u.matrix_name || 'No Matrix'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800">
                        {u.business_name || 'No Business'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800">
                        {u.department_name || 'No Department'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800">
                        {u.manager_name || 'Unassigned'}
                      </span>
                    </td>

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

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="View Profile"
                          onClick={() => setViewingProfileUserId(u.id)}
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
                        {u.id !== currentUser.id && currentUser.role !== 'SUPERVISOR' && (
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

      {/* User Profile Modal */}
      {viewingProfileUserId && (
        <UserProfileModal
          isOpen={Boolean(viewingProfileUserId)}
          userId={viewingProfileUserId}
          onClose={() => setViewingProfileUserId(null)}
        />
      )}

      {/* Create User Modal */}
      {isCreateOpen && (
        <MatrixCreateUserModal
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

      {/* Edit User Modal */}
      {editingUser && (
        <MatrixEditUserModal
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
// MATRIX-FIRST USER CREATION MODAL
// -------------------------------------------------------------
function MatrixCreateUserModal({ isOpen, onClose, currentUser, formOptions, onSuccess }) {
  const { matrices = [], businesses = [], departments = [] } = formOptions;

  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    email: '',
    phone: '',
    role: 'EMPLOYEE',
    designation: '',
    matrix_id: '',
    business_id: '',
    department_id: '',
    shift_start_time: '09:00:00',
    shift_end_time: '18:00:00',
    date_of_joining: new Date().toISOString().split('T')[0],
    password: ''
  });

  const [selectedMatrixDetails, setSelectedMatrixDetails] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Auto-lock for supervisor
  useEffect(() => {
    if (currentUser.role === 'SUPERVISOR') {
      const supMatrix = matrices.find(m => m.supervisor_id === currentUser.id);
      if (supMatrix) {
        setFormData(prev => ({
          ...prev,
          role: 'EMPLOYEE',
          matrix_id: supMatrix.id
        }));
        setSelectedMatrixDetails(supMatrix);
      }
    }
  }, [currentUser, matrices]);

  const handleMatrixChange = (matrixIdStr) => {
    if (!matrixIdStr || matrixIdStr === 'none') {
      setFormData(prev => ({ ...prev, matrix_id: '' }));
      setSelectedMatrixDetails(null);
      return;
    }

    const mId = parseInt(matrixIdStr, 10);
    const found = matrices.find(m => m.id === mId);
    setFormData(prev => ({ 
      ...prev, 
      matrix_id: mId,
      business_id: '',
      department_id: ''
    }));
    setSelectedMatrixDetails(found || null);
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = { ...formData };
    if (!payload.matrix_id) delete payload.matrix_id;
    if (!payload.business_id) delete payload.business_id;
    if (!payload.department_id) delete payload.department_id;
    if (!payload.password) delete payload.password;

    try {
      await api.post('/auth/employees/manage/', payload);
      onSuccess();
    } catch (err) {
      const errData = err.response?.data;
      setError(typeof errData === 'object' ? JSON.stringify(errData) : 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const isUpperTierRole = ['ADMIN', 'SUPER_ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD'].includes(formData.role);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-bold text-slate-900">Provision User</h2>
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
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-hidden"
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
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
              <select
                value={formData.role}
                disabled={currentUser.role === 'SUPERVISOR'}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-hidden disabled:bg-slate-100 disabled:text-slate-500 font-medium"
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
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>
          </div>

          {/* Matrix Selection Dropdown */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center justify-between">
              <span>Operational Matrix Branch</span>
              {currentUser.role === 'SUPERVISOR' && <Lock size={12} className="text-slate-400" title="Locked to your matrix" />}
            </label>
            <select
              value={formData.matrix_id || 'none'}
              disabled={currentUser.role === 'SUPERVISOR'}
              onChange={(e) => handleMatrixChange(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-hidden disabled:bg-slate-100 font-medium"
            >
              <option value="none">-- No Matrix ({isUpperTierRole ? 'Select Direct Org Entities Below' : 'Unassigned Pool'}) --</option>
              {matrices.map((m) => (
                <option key={m.id} value={m.id}>{m.title || `${m.name} [${m.code}]`}</option>
              ))}
            </select>
          </div>

          {/* Conditional Upper-Tier Direct Entity Selection (When Matrix is not set) */}
          {!formData.matrix_id && isUpperTierRole && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Direct Business</label>
                <select
                  value={formData.business_id || ''}
                  onChange={(e) => setFormData({ ...formData, business_id: e.target.value ? parseInt(e.target.value, 10) : '' })}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- No Direct Business --</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Direct Department</label>
                <select
                  value={formData.department_id || ''}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value ? parseInt(e.target.value, 10) : '' })}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- No Direct Department --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Read-Only Matrix Auto-Derived Badges */}
          {formData.matrix_id && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={13} className="text-indigo-600" />
                Auto-Assigned Matrix Attributes
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase block font-medium">Business</span>
                  <span className="font-semibold text-slate-800">
                    {selectedMatrixDetails ? selectedMatrixDetails.business_name : 'No Business'}
                  </span>
                </div>

                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase block font-medium">Department</span>
                  <span className="font-semibold text-slate-800">
                    {selectedMatrixDetails ? selectedMatrixDetails.department_name : 'No Department'}
                  </span>
                </div>
              </div>

              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase block font-medium">
                  {formData.role === 'SUPERVISOR' ? 'Matrix Incharge Designation' : 'Direct Reporting Manager'}
                </span>
                <span className="font-semibold text-indigo-700">
                  {formData.role === 'SUPERVISOR'
                    ? 'Self will be registered as Incharge of this Matrix'
                    : (selectedMatrixDetails ? selectedMatrixDetails.supervisor_name : 'None / Unassigned')}
                </span>
              </div>
            </div>
          )}

          {/* Shift Schedule */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Shift Start Time</label>
              <input
                type="time"
                value={formData.shift_start_time}
                onChange={(e) => setFormData({ ...formData, shift_start_time: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-hidden font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Shift End Time</label>
              <input
                type="time"
                value={formData.shift_end_time}
                onChange={(e) => setFormData({ ...formData, shift_end_time: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-hidden font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Temporary Password (Optional)</label>
            <input
              type="password"
              placeholder="Leave blank for 'TempPass@123'"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-hidden"
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
// MATRIX-FIRST USER EDIT MODAL
// -------------------------------------------------------------
function MatrixEditUserModal({ user, onClose, currentUser, formOptions, onSuccess }) {
  const { matrices = [], businesses = [], departments = [] } = formOptions;

  const [formData, setFormData] = useState({
    full_name: user.full_name || '',
    username: user.username || '',
    email: user.email || '',
    phone: user.phone || '',
    designation: user.designation || '',
    role: user.role,
    matrix_id: user.matrix_id || '',
    business_id: user.business_id || '',
    department_id: user.department_id || '',
    shift_start_time: user.shift_start_time || '09:00:00',
    shift_end_time: user.shift_end_time || '18:00:00',
    date_of_joining: user.date_of_joining || ''
  });

  const [selectedMatrixDetails, setSelectedMatrixDetails] = useState(
    matrices.find(m => m.id === user.matrix_id) || null
  );
  const [submitting, setSubmitting] = useState(false);

  const canEditRoles = ['SUPER_ADMIN', 'ADMIN'].includes(currentUser.role);
  const isSupervisor = currentUser.role === 'SUPERVISOR';
  const isUpperTierRole = ['ADMIN', 'SUPER_ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD'].includes(formData.role);

  const handleMatrixChange = (matrixIdStr) => {
    if (!matrixIdStr || matrixIdStr === 'none') {
      setFormData(prev => ({ ...prev, matrix_id: 'none' }));
      setSelectedMatrixDetails(null);
      return;
    }

    const mId = parseInt(matrixIdStr, 10);
    const found = matrices.find(m => m.id === mId);
    setFormData(prev => ({ 
      ...prev, 
      matrix_id: mId,
      business_id: '',
      department_id: ''
    }));
    setSelectedMatrixDetails(found || null);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...formData };
      if (payload.matrix_id === 'none') payload.matrix_id = null;
      if (!payload.business_id) payload.business_id = null;
      if (!payload.department_id) payload.department_id = null;

      await api.patch(`/auth/employees/manage/${user.id}/`, payload);
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
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Username *</label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-hidden"
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
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-hidden"
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
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Date of Joining</label>
              <input
                type="date"
                value={formData.date_of_joining}
                onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>
          </div>

          {/* Matrix Reassignment Dropdown */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center justify-between">
              <span>Operational Matrix Branch</span>
              {isSupervisor && <Lock size={12} className="text-slate-400" title="Supervisors cannot move members to another matrix" />}
            </label>
            <select
              value={formData.matrix_id || 'none'}
              disabled={isSupervisor}
              onChange={(e) => handleMatrixChange(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-hidden disabled:bg-slate-100 font-medium"
            >
              <option value="none">-- No Matrix ({isUpperTierRole ? 'Select Direct Org Entities Below' : 'Unassigned Pool'}) --</option>
              {matrices.map((m) => (
                <option key={m.id} value={m.id}>{m.title || `${m.name} [${m.code}]`}</option>
              ))}
            </select>
          </div>

          {/* Conditional Upper-Tier Direct Entity Selection (When Matrix is not set) */}
          {(formData.matrix_id === 'none' || !formData.matrix_id) && isUpperTierRole && canEditRoles && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Direct Business</label>
                <select
                  value={formData.business_id || ''}
                  onChange={(e) => setFormData({ ...formData, business_id: e.target.value ? parseInt(e.target.value, 10) : '' })}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- No Direct Business --</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Direct Department</label>
                <select
                  value={formData.department_id || ''}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value ? parseInt(e.target.value, 10) : '' })}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- No Direct Department --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Auto-derived Matrix Badges */}
          {formData.matrix_id && formData.matrix_id !== 'none' && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={13} className="text-indigo-600" />
                Derived Relationships
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase block font-medium">Business</span>
                  <span className="font-semibold text-slate-800">
                    {selectedMatrixDetails ? selectedMatrixDetails.business_name : 'No Business'}
                  </span>
                </div>

                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase block font-medium">Department</span>
                  <span className="font-semibold text-slate-800">
                    {selectedMatrixDetails ? selectedMatrixDetails.department_name : 'No Department'}
                  </span>
                </div>
              </div>

              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase block font-medium">Direct Manager</span>
                <span className="font-semibold text-indigo-700">
                  {selectedMatrixDetails ? selectedMatrixDetails.supervisor_name : 'Unassigned Lead'}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Shift Start</label>
              <input
                type="time"
                value={formData.shift_start_time}
                onChange={(e) => setFormData({ ...formData, shift_start_time: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-hidden font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Shift End</label>
              <input
                type="time"
                value={formData.shift_end_time}
                onChange={(e) => setFormData({ ...formData, shift_end_time: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-hidden font-mono"
              />
            </div>
          </div>

          {canEditRoles && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Role Tier</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-hidden"
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