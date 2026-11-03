// frontend/src/components/UserManagementView.jsx

import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Eye,
  Edit2,
  Trash2,
  Shield,
  Building,
  Briefcase,
  Layers,
  ChevronDown,
  X,
  AlertCircle,
  Clock,
  Phone,
  Mail,
  UserCheck,
  RefreshCw,
  Calendar
} from 'lucide-react';
import UserProfileModal from './UserProfileModal';

// Strict Role Tier Weighting: Lower number = higher authority
const ROLE_HIERARCHY_RANK = {
  SUPER_ADMIN: 1,
  ADMIN: 2,
  BUSINESS_ADMIN: 3,
  DEPT_HEAD: 3,
  SUPERVISOR: 4,
  EMPLOYEE: 5,
};

export default function UserManagementView({ currentUser, onInspectUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Metadata dropdown options
  const [formOptions, setFormOptions] = useState({
    matrices: [],
    businesses: [],
    departments: []
  });

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editUserData, setEditUserData] = useState(null);
  const [inspectProfileUserId, setInspectProfileUserId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    fetchUsers();
    fetchFormOptions();
  }, [roleFilter, statusFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let url = '/auth/employees/manage/?';
      if (roleFilter !== 'ALL') url += `role=${roleFilter}&`;
      if (statusFilter !== 'ALL') url += `is_active=${statusFilter === 'ACTIVE'}&`;
      const res = await api.get(url);
      setUsers(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch (err) {
      console.error('Failed to load employee list:', err);
      showFeedback('error', 'Failed to retrieve user directory.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFormOptions = async () => {
    try {
      const res = await api.get('/auth/employees/manage/form-options/');
      setFormOptions({
        matrices: res.data.matrices || [],
        businesses: res.data.businesses || [],
        departments: res.data.departments || []
      });
    } catch (err) {
      console.error('Failed to load form options:', err);
    }
  };

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4500);
  };

  // Hierarchy validation helper: checks if the current user can manage target user
  const canManageTargetUser = (targetUser) => {
    if (!currentUser || !targetUser) return false;
    if (targetUser.id === currentUser.id) return false; // Self-management is handled via personal profile

    const actorRank = ROLE_HIERARCHY_RANK[currentUser.role] || 99;
    const targetRank = ROLE_HIERARCHY_RANK[targetUser.role] || 99;

    // Can only manage strictly lower-tier roles (targetRank > actorRank)
    return targetRank > actorRank;
  };

  // Toggle User Active / Disabled status
  const handleToggleStatus = async (user) => {
    if (!canManageTargetUser(user)) {
      alert("Permission denied. You can only modify account access for lower-tier roles.");
      return;
    }

    const actionText = user.is_active ? 'disable' : 'enable';
    if (!window.confirm(`Are you sure you want to ${actionText} account access for "${user.full_name || user.username}"?`)) {
      return;
    }

    try {
      const res = await api.patch(`/auth/employees/manage/${user.id}/toggle-status/`);
      showFeedback('success', res.data.message || `User status updated successfully.`);
      fetchUsers();
    } catch (err) {
      const msg = err.response?.data?.detail || "Operation failed.";
      alert(msg);
    }
  };

  // Delete User Action (Admins and Super Admins Only)
  const handleDeleteUser = async (user) => {
    if (!canDeleteUser(user)) {
      alert("Permission denied. Only Admins and Super Admins can delete lower-tier accounts.");
      return;
    }

    if (!window.confirm(`Are you sure you want to PERMANENTLY delete user "${user.full_name || user.username}" (${user.role})? This cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/auth/employees/manage/${user.id}/`);
      showFeedback('success', `User "${user.full_name || user.username}" deleted successfully.`);
      fetchUsers();
      fetchFormOptions();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to delete user.";
      alert(msg);
    }
  };

  const canDeleteUser = (targetUser) => {
    if (!currentUser || targetUser.id === currentUser.id) return false;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) return false;

    const actorRank = ROLE_HIERARCHY_RANK[currentUser.role] || 99;
    const targetRank = ROLE_HIERARCHY_RANK[targetUser.role] || 99;

    return targetRank > actorRank;
  };

  // Filtered users for instant search
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        u.username?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.employee_code?.toLowerCase().includes(q) ||
        u.designation?.toLowerCase().includes(q) ||
        u.matrix_title?.toLowerCase().includes(q) ||
        u.business_name?.toLowerCase().includes(q) ||
        u.department_name?.toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery]);

  const getRoleBadge = (role) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'BUSINESS_ADMIN':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'DEPT_HEAD':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'SUPERVISOR':
        return 'bg-amber-100 text-amber-900 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 pb-12">
      {/* Top Banner & Action */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="text-blue-600" size={22} />
            User & Authority Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage organizational staff, matrix appointments, hierarchical reporting lines, and access permissions.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              fetchUsers();
              fetchFormOptions();
            }}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
            title="Refresh Directory"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg font-semibold shadow-xs transition cursor-pointer"
          >
            <UserPlus size={15} />
            <span>+ Add New User</span>
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, employee code, email, designation, or branch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter size={13} />
            <span className="font-medium">Role:</span>
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:bg-white"
          >
            <option value="ALL">All Roles</option>
            <option value="EMPLOYEE">Base Employee</option>
            <option value="SUPERVISOR">Supervisor</option>
            {['SUPER_ADMIN', 'ADMIN'].includes(currentUser?.role) && (
              <>
                <option value="DEPT_HEAD">Department Head</option>
                <option value="BUSINESS_ADMIN">Business Admin</option>
              </>
            )}
            {currentUser?.role === 'SUPER_ADMIN' && (
              <>
                <option value="ADMIN">System Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </>
            )}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:bg-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Accounts</option>
            <option value="DISABLED">Disabled Accounts</option>
          </select>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw size={20} className="animate-spin text-blue-500" />
            <span>Loading user directory...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1">
            <Users size={32} className="text-slate-300 stroke-[1.5]" />
            <p className="font-semibold text-slate-600 mt-2">No users matching search criteria</p>
            <p className="text-[11px] text-slate-400">Try adjusting your filters or search keywords.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Matrix Branch</th>
                  <th className="py-3 px-4">Bus & Dept Scope</th>
                  <th className="py-3 px-4">Reporting To</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredUsers.map((u) => {
                  const isDeptHead = u.role === 'DEPT_HEAD';
                  const isBizAdmin = u.role === 'BUSINESS_ADMIN';
                  const isGlobalAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(u.role);

                  const bizDisplay = isGlobalAdmin || isDeptHead ? 'All Businesses' : (u.business_name || 'No Business');
                  const deptDisplay = isGlobalAdmin || isBizAdmin ? 'All Departments' : (u.department_name || 'No Department');

                  const isEditable = canManageTargetUser(u);

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{u.full_name || u.username}</div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                          <span>{u.employee_code || `EID${u.id.toString().padStart(3, '0')}`}</span>
                          <span>•</span>
                          <span>{u.username}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${getRoleBadge(u.role)}`}>
                            {u.role.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1 font-medium">{u.designation || 'Staff Member'}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        {isGlobalAdmin || isBizAdmin || isDeptHead ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            All Matrices
                          </span>
                        ) : u.matrix_title && u.matrix_title !== 'No Matrix' ? (
                          <div className="flex items-center gap-1.5 text-blue-700 font-semibold bg-blue-50/60 border border-blue-100 px-2.5 py-1 rounded-lg w-fit">
                            <Layers size={13} className="text-blue-500 shrink-0" />
                            <span>{u.matrix_title}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No Matrix</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Briefcase size={12} className="text-slate-400 shrink-0" />
                            {isGlobalAdmin || isDeptHead ? (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                All Businesses
                              </span>
                            ) : (
                              <span className="text-slate-800 font-medium">{bizDisplay}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Building size={12} className="text-slate-400 shrink-0" />
                            {isGlobalAdmin || isBizAdmin ? (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                All Departments
                              </span>
                            ) : (
                              <span className="text-slate-600 font-medium text-[11px]">{deptDisplay}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {u.role === 'SUPERVISOR' && u.dual_reporting_leads?.length > 0 ? (
                          <div className="space-y-1">
                            {u.dual_reporting_leads.map((lead, idx) => (
                              <div key={idx} className="text-[10px] font-semibold text-slate-700 bg-slate-100 rounded px-1.5 py-0.5 w-fit">
                                <span className="text-blue-600">{lead.type}:</span> {lead.name}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-slate-700 font-semibold">
                            {u.manager_name || 'Global Operations'}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            u.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {u.is_active ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Disabled
                            </>
                          )}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Profile Inspect Trigger */}
                          <button
                            type="button"
                            onClick={() => setInspectProfileUserId(u.id)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="View Profile Details"
                          >
                            <Eye size={15} />
                          </button>

                          {/* Edit Action: Only shown if user is strictly lower-tier */}
                          {isEditable && (
                            <button
                              type="button"
                              onClick={() => setEditUserData(u)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                              title="Edit User Profile"
                            >
                              <Edit2 size={15} />
                            </button>
                          )}

                          {/* Status Toggle Action: Only allowed for strictly lower-tier */}
                          {isEditable && (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(u)}
                              className={`px-2 py-1 rounded text-[10px] font-bold transition border cursor-pointer ${
                                u.is_active
                                  ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                                  : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {u.is_active ? 'Disable' : 'Enable'}
                            </button>
                          )}

                          {/* Delete Action: Admins/Super Admins managing lower-tier */}
                          {canDeleteUser(u) && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition border border-transparent hover:border-rose-200 cursor-pointer"
                              title="Delete User Account"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE USER MODAL */}
      {isCreateOpen && (
        <CreateUserModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          formOptions={formOptions}
          currentUser={currentUser}
          onSuccess={() => {
            setIsCreateOpen(false);
            showFeedback('success', 'User account successfully provisioned and synchronized.');
            fetchUsers();
            fetchFormOptions();
          }}
        />
      )}

      {/* EDIT USER MODAL */}
      {editUserData && (
        <EditUserModal
          isOpen={Boolean(editUserData)}
          user={editUserData}
          onClose={() => setEditUserData(null)}
          formOptions={formOptions}
          currentUser={currentUser}
          onSuccess={() => {
            setEditUserData(null);
            showFeedback('success', 'User profile details synchronized.');
            fetchUsers();
            fetchFormOptions();
          }}
        />
      )}

      {/* USER PROFILE MODAL */}
      {inspectProfileUserId && (
        <UserProfileModal
          isOpen={Boolean(inspectProfileUserId)}
          userId={inspectProfileUserId}
          onClose={() => setInspectProfileUserId(null)}
        />
      )}
    </div>
  );
}

// ==========================================
// CREATE USER MODAL (ROLE-ADAPTIVE & LOWER-TIER RESTRICTED)
// ==========================================
function CreateUserModal({ isOpen, onClose, formOptions, currentUser, onSuccess }) {
  const todayStr = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    email: '',
    password: '',
    role: 'EMPLOYEE',
    designation: '',
    phone: '',
    date_of_joining: todayStr,
    matrix_id: '',
    business_id: currentUser?.role === 'BUSINESS_ADMIN' && currentUser?.business_id ? String(currentUser.business_id) : '',
    department_id: currentUser?.role === 'DEPT_HEAD' && currentUser?.department_id ? String(currentUser.department_id) : '',
    shift_start_time: '09:00',
    shift_end_time: '18:00',
    self_idle_timer_start: '10:00',
    reminder_enabled: true
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const selectedMatrix = formOptions.matrices.find(
    (m) => String(m.id) === String(formData.matrix_id)
  );

  const availableBusinesses = formOptions.businesses.filter((b) => !b.has_incharge);
  const availableDepartments = formOptions.departments.filter((d) => !d.has_incharge);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        ...formData,
        matrix_id: formData.matrix_id ? parseInt(formData.matrix_id, 10) : null,
        business_id: formData.business_id ? parseInt(formData.business_id, 10) : null,
        department_id: formData.department_id ? parseInt(formData.department_id, 10) : null,
        date_of_joining: formData.date_of_joining || null
      };

      if (payload.role === 'EMPLOYEE' || payload.role === 'SUPERVISOR') {
        payload.business_id = null;
        payload.department_id = null;
      } else if (payload.role === 'BUSINESS_ADMIN') {
        payload.matrix_id = null;
        payload.department_id = null;
      } else if (payload.role === 'DEPT_HEAD') {
        payload.matrix_id = null;
        payload.business_id = null;
      } else {
        payload.matrix_id = null;
        payload.business_id = null;
        payload.department_id = null;
      }

      await api.post('/auth/employees/manage/', payload);
      onSuccess();
    } catch (err) {
      const detail = err.response?.data;
      if (typeof detail === 'object' && detail !== null) {
        const firstKey = Object.keys(detail)[0];
        const val = detail[firstKey];
        setErrorMsg(`${firstKey}: ${Array.isArray(val) ? val[0] : val}`);
      } else {
        setErrorMsg(detail?.detail || 'Failed to provision user.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full my-6 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserPlus size={18} className="text-blue-600" />
              Provision New Staff Account
            </h2>
            <p className="text-[11px] text-slate-500">Assign role and placement strictly within your administrative jurisdiction.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="m-4 mb-0 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Username *</label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.trim() })}
                placeholder="e.g. john_doe"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Corporate Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value.trim() })}
                placeholder="john@company.com"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Full Name</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="John Doe"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Initial Password</label>
              <input
                type="text"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Default: TempPass@123"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Designation</label>
              <input
                type="text"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                placeholder="e.g. Operations Specialist"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Date of Joining</label>
              <input
                type="date"
                value={formData.date_of_joining}
                onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Assigned Role Tier *</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value, matrix_id: '', business_id: '', department_id: '' })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              >
                {/* Strict Role Options: Can only create lower-tier roles */}
                {currentUser?.role === 'SUPERVISOR' && (
                  <option value="EMPLOYEE">Base Employee</option>
                )}

                {['BUSINESS_ADMIN', 'DEPT_HEAD'].includes(currentUser?.role) && (
                  <>
                    <option value="EMPLOYEE">Base Employee</option>
                    <option value="SUPERVISOR">Supervisor (Matrix Incharge)</option>
                  </>
                )}

                {currentUser?.role === 'ADMIN' && (
                  <>
                    <option value="EMPLOYEE">Base Employee</option>
                    <option value="SUPERVISOR">Supervisor (Matrix Incharge)</option>
                    <option value="BUSINESS_ADMIN">Business Admin</option>
                    <option value="DEPT_HEAD">Department Head</option>
                  </>
                )}

                {currentUser?.role === 'SUPER_ADMIN' && (
                  <>
                    <option value="EMPLOYEE">Base Employee</option>
                    <option value="SUPERVISOR">Supervisor (Matrix Incharge)</option>
                    <option value="BUSINESS_ADMIN">Business Admin</option>
                    <option value="DEPT_HEAD">Department Head</option>
                    <option value="ADMIN">System Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* DYNAMIC ROLE SCOPING INPUTS */}
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-3">
            {(formData.role === 'EMPLOYEE' || formData.role === 'SUPERVISOR') && (
              <div>
                <label className="font-bold text-slate-800 block mb-1 flex items-center justify-between">
                  <span>Operational Matrix Branch {formData.role === 'SUPERVISOR' ? '(To Lead as Incharge)' : '*'}</span>
                  {selectedMatrix && (
                    <span className="text-[10px] text-blue-600 font-medium">Auto-populates relationships</span>
                  )}
                </label>
                <select
                  value={formData.matrix_id}
                  onChange={(e) => setFormData({ ...formData, matrix_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white font-medium"
                >
                  <option value="">No Matrix (Unassigned)</option>
                  {formOptions.matrices.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>

                {selectedMatrix ? (
                  <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="bg-white border border-slate-200 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 block font-medium">Business Scope</span>
                      <strong className="text-slate-800 text-[11px] truncate block">{selectedMatrix.business_name}</strong>
                    </div>
                    <div className="bg-white border border-slate-200 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 block font-medium">Department</span>
                      <strong className="text-slate-800 text-[11px] truncate block">{selectedMatrix.department_name}</strong>
                    </div>
                    <div className="bg-white border border-slate-200 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 block font-medium">
                        {formData.role === 'SUPERVISOR' ? 'Dual Lead Scope' : 'Direct Supervisor'}
                      </span>
                      <strong className="text-blue-700 text-[11px] truncate block">
                        {formData.role === 'SUPERVISOR' ? 'Biz Admin + Dept Admin' : selectedMatrix.supervisor_name}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-1 italic">
                    Selecting "No Matrix" leaves business, department, and direct reporting manager unassigned.
                  </p>
                )}
              </div>
            )}

            {/* CASE 2: BUSINESS ADMIN */}
            {formData.role === 'BUSINESS_ADMIN' && (
              <div>
                <label className="font-bold text-slate-800 block mb-1">Direct Business Jurisdiction</label>
                <select
                  value={formData.business_id}
                  onChange={(e) => setFormData({ ...formData, business_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white font-medium"
                >
                  <option value="">No Business (Unassigned - Assign Later)</option>
                  {availableBusinesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* CASE 3: DEPT HEAD */}
            {formData.role === 'DEPT_HEAD' && (
              <div>
                <label className="font-bold text-slate-800 block mb-1">Functional Department Scope</label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white font-medium"
                >
                  <option value="">No Department (Unassigned - Assign Later)</option>
                  {availableDepartments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {['ADMIN', 'SUPER_ADMIN'].includes(formData.role) && (
              <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-blue-900 text-[11px] font-medium flex items-center gap-2">
                <Shield size={16} className="text-blue-600 shrink-0" />
                <span>Admins have global, unrestricted visibility across all businesses, departments, and matrix branches.</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Shift Start Time</label>
              <input
                type="time"
                value={formData.shift_start_time}
                onChange={(e) => setFormData({ ...formData, shift_start_time: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Shift End Time</label>
              <input
                type="time"
                value={formData.shift_end_time}
                onChange={(e) => setFormData({ ...formData, shift_end_time: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 -mx-5 -mb-5 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Provisioning...' : 'Confirm & Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// EDIT USER MODAL (RETAINS EXISTING JOINING DATE & ENFORCES LOWER TIER)
// ==========================================
function EditUserModal({ isOpen, user, onClose, formOptions, currentUser, onSuccess }) {
  const existingDateStr = user?.date_of_joining ? String(user.date_of_joining).split('T')[0] : '';

  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    designation: user?.designation || '',
    phone: user?.phone || '',
    date_of_joining: existingDateStr,
    role: user?.role || 'EMPLOYEE',
    matrix_id: user?.matrix_id ? String(user.matrix_id) : '',
    business_id: user?.business_id ? String(user.business_id) : '',
    department_id: user?.department_id ? String(user.department_id) : '',
    shift_start_time: user?.shift_start_time?.substring(0, 5) || '09:00',
    shift_end_time: user?.shift_end_time?.substring(0, 5) || '18:00',
    self_idle_timer_start: user?.self_idle_timer_start?.substring(0, 5) || '10:00',
    is_active: user?.is_active ?? true
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const selectedMatrix = formOptions.matrices.find(
    (m) => String(m.id) === String(formData.matrix_id)
  );

  const availableBusinesses = formOptions.businesses.filter(
    (b) => !b.has_incharge || String(b.id) === String(user?.business_id)
  );

  const availableDepartments = formOptions.departments.filter(
    (d) => !d.has_incharge || String(d.id) === String(user?.department_id)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        ...formData,
        matrix_id: formData.matrix_id ? parseInt(formData.matrix_id, 10) : null,
        business_id: formData.business_id ? parseInt(formData.business_id, 10) : null,
        department_id: formData.department_id ? parseInt(formData.department_id, 10) : null,
        date_of_joining: formData.date_of_joining || null
      };

      if (payload.role === 'EMPLOYEE' || payload.role === 'SUPERVISOR') {
        payload.business_id = null;
        payload.department_id = null;
      } else if (payload.role === 'BUSINESS_ADMIN') {
        payload.matrix_id = null;
        payload.department_id = null;
      } else if (payload.role === 'DEPT_HEAD') {
        payload.matrix_id = null;
        payload.business_id = null;
      } else {
        payload.matrix_id = null;
        payload.business_id = null;
        payload.department_id = null;
      }

      await api.patch(`/auth/employees/manage/${user.id}/`, payload);
      onSuccess();
    } catch (err) {
      const detail = err.response?.data;
      if (typeof detail === 'object' && detail !== null) {
        const firstKey = Object.keys(detail)[0];
        const val = detail[firstKey];
        setErrorMsg(`${firstKey}: ${Array.isArray(val) ? val[0] : val}`);
      } else {
        setErrorMsg(detail?.detail || 'Failed to update user profile.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full my-6 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Edit2 size={16} className="text-blue-600" />
              Edit User Profile: {user.full_name || user.username}
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">Employee Code: {user.employee_code || `EID${user.id}`}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="m-4 mb-0 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Corporate Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value.trim() })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Full Name</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Designation</label>
              <input
                type="text"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Date of Joining</label>
              <input
                type="date"
                value={formData.date_of_joining}
                onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Role Tier</label>
              <select
                disabled={currentUser?.role === 'SUPERVISOR'}
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value, matrix_id: '', business_id: '', department_id: '' })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium disabled:bg-slate-100"
              >
                {/* Strict lower-tier editing options */}
                {currentUser?.role === 'SUPERVISOR' && (
                  <option value="EMPLOYEE">Base Employee</option>
                )}

                {['BUSINESS_ADMIN', 'DEPT_HEAD'].includes(currentUser?.role) && (
                  <>
                    <option value="EMPLOYEE">Base Employee</option>
                    <option value="SUPERVISOR">Supervisor (Matrix Incharge)</option>
                  </>
                )}

                {currentUser?.role === 'ADMIN' && (
                  <>
                    <option value="EMPLOYEE">Base Employee</option>
                    <option value="SUPERVISOR">Supervisor (Matrix Incharge)</option>
                    <option value="BUSINESS_ADMIN">Business Admin</option>
                    <option value="DEPT_HEAD">Department Head</option>
                  </>
                )}

                {currentUser?.role === 'SUPER_ADMIN' && (
                  <>
                    <option value="EMPLOYEE">Base Employee</option>
                    <option value="SUPERVISOR">Supervisor (Matrix Incharge)</option>
                    <option value="BUSINESS_ADMIN">Business Admin</option>
                    <option value="DEPT_HEAD">Department Head</option>
                    <option value="ADMIN">System Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-3">
            {(formData.role === 'EMPLOYEE' || formData.role === 'SUPERVISOR') && (
              <div>
                <label className="font-bold text-slate-800 block mb-1 flex items-center justify-between">
                  <span>Operational Matrix Branch {formData.role === 'SUPERVISOR' ? '(Leading as Incharge)' : ''}</span>
                  {selectedMatrix && (
                    <span className="text-[10px] text-blue-600 font-medium">Cascades to members</span>
                  )}
                </label>
                <select
                  disabled={currentUser?.role === 'SUPERVISOR'}
                  value={formData.matrix_id}
                  onChange={(e) => setFormData({ ...formData, matrix_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white font-medium disabled:bg-slate-100"
                >
                  <option value="">No Matrix (Unassigned)</option>
                  {formOptions.matrices.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>

                {selectedMatrix && (
                  <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="bg-white border border-slate-200 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 block font-medium">Business</span>
                      <strong className="text-slate-800 text-[11px] truncate block">{selectedMatrix.business_name}</strong>
                    </div>
                    <div className="bg-white border border-slate-200 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 block font-medium">Department</span>
                      <strong className="text-slate-800 text-[11px] truncate block">{selectedMatrix.department_name}</strong>
                    </div>
                    <div className="bg-white border border-slate-200 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 block font-medium">Direct Lead</span>
                      <strong className="text-blue-700 text-[11px] truncate block">
                        {formData.role === 'SUPERVISOR' ? 'Dual Lead Scope' : selectedMatrix.supervisor_name}
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            {formData.role === 'BUSINESS_ADMIN' && (
              <div>
                <label className="font-bold text-slate-800 block mb-1">Direct Business Jurisdiction</label>
                <select
                  value={formData.business_id}
                  onChange={(e) => setFormData({ ...formData, business_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white font-medium"
                >
                  <option value="">No Business (Unassigned)</option>
                  {availableBusinesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.role === 'DEPT_HEAD' && (
              <div>
                <label className="font-bold text-slate-800 block mb-1">Functional Department Scope</label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white font-medium"
                >
                  <option value="">No Department (Unassigned)</option>
                  {availableDepartments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            <div>
              <span className="font-semibold text-slate-800 block">Account Access Status</span>
              <p className="text-[11px] text-slate-400">Disabled accounts cannot authenticate or access workspaces.</p>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                formData.is_active
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
              }`}
            >
              {formData.is_active ? 'Active' : 'Disabled'}
            </button>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 -mx-5 -mb-5 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}