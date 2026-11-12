// frontend/src/components/UserManagementView.jsx

import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  Eye,
  Edit2,
  Trash2,
  Shield,
  Building,
  Briefcase,
  Layers,
  X,
  AlertCircle,
  UserCheck,
  RefreshCw,
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
    if (targetUser.id === currentUser.id) return false;

    const actorRank = ROLE_HIERARCHY_RANK[currentUser.role] || 99;
    const targetRank = ROLE_HIERARCHY_RANK[targetUser.role] || 99;

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
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'ADMIN':
        return 'bg-blue-100/80 text-blue-800 border-blue-300';
      case 'BUSINESS_ADMIN':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'DEPT_HEAD':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'SUPERVISOR':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-12 text-slate-800">
      {/* Top Banner & Action */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-[0_8px_30px_rgba(15,23,42,0.06)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5 tracking-wide">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center shadow-2xs">
              <Users size={16} />
            </div>
            User & Authority Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage organizational staff, matrix appointments, hierarchical reporting lines, and access permissions.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto relative z-10">
          <button
            type="button"
            onClick={() => {
              fetchUsers();
              fetchFormOptions();
            }}
            className="p-2.5 text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-xl border border-slate-200/90 hover:border-blue-200 transition cursor-pointer shadow-2xs"
            title="Refresh Directory"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-blue-600" : ""} />
          </button>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-xs px-4 py-2.5 rounded-xl font-semibold shadow-[0_4px_14px_rgba(37,99,235,0.28)] hover:shadow-[0_6px_18px_rgba(37,99,235,0.38)] transition cursor-pointer active:scale-95"
          >
            <UserPlus size={15} />
            <span>Add New User</span>
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2.5 transition shadow-2xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> : <AlertCircle size={16} className="text-rose-600 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/90 p-4 shadow-[0_8px_25px_rgba(15,23,42,0.05)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, employee code, email, designation, or branch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none bg-slate-50/70 focus:bg-white text-slate-900 placeholder:text-slate-400 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Filter size={13} className="text-blue-600" />
            <span className="font-semibold">Role:</span>
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:border-blue-500 outline-none cursor-pointer transition"
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
            className="text-xs bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:border-blue-500 outline-none cursor-pointer transition"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Accounts</option>
            <option value="DISABLED">Disabled Accounts</option>
          </select>
        </div>
      </div>

      {/* Directory Container */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2 font-medium">
            <RefreshCw size={20} className="animate-spin text-blue-600" />
            <span>Loading user directory...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1">
            <Users size={32} className="text-slate-300 stroke-[1.5]" />
            <p className="font-bold text-slate-700 mt-2">No users matching search criteria</p>
            <p className="text-[11px] text-slate-400">Try adjusting your filters or search keywords.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50/90 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4">Employee</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Matrix Branch</th>
                    <th className="py-3.5 px-4">Bus & Dept Scope</th>
                    <th className="py-3.5 px-4">Reporting To</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
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
                      <tr key={u.id} className="hover:bg-blue-50/40 transition duration-150">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 tracking-wide">{u.full_name || u.username}</div>
                          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                            <span className="text-blue-700 font-semibold">{u.employee_code || `EID${u.id.toString().padStart(3, '0')}`}</span>
                            <span>&bull;</span>
                            <span>@{u.username}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getRoleBadge(u.role)}`}>
                              {u.role.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 font-medium">{u.designation || 'Staff Member'}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          {isGlobalAdmin || isBizAdmin || isDeptHead ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-xl text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              All Matrices
                            </span>
                          ) : u.matrix_title && u.matrix_title !== 'No Matrix' ? (
                            <div className="flex items-center gap-1.5 text-blue-700 font-semibold bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-xl w-fit">
                              <Layers size={13} className="text-blue-600 shrink-0" />
                              <span>{u.matrix_title}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No Matrix</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <Briefcase size={12} className="text-blue-600 shrink-0" />
                              {isGlobalAdmin || isDeptHead ? (
                                <span className="inline-flex items-center px-2 py-0.2 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  All Businesses
                                </span>
                              ) : (
                                <span className="text-slate-800 font-semibold">{bizDisplay}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Building size={12} className="text-blue-600 shrink-0" />
                              {isGlobalAdmin || isBizAdmin ? (
                                <span className="inline-flex items-center px-2 py-0.2 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
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
                                <div key={idx} className="text-[10px] font-semibold text-slate-700 bg-slate-50 rounded-lg px-2 py-0.5 border border-slate-200/80 w-fit">
                                  <span className="text-blue-700 font-bold">{lead.type}:</span> {lead.name}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-slate-800 font-semibold">
                              {u.manager_name || 'Global Operations'}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border tracking-wider uppercase ${
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
                            <button
                              type="button"
                              onClick={() => setInspectProfileUserId(u.id)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition cursor-pointer"
                              title="View Profile Details"
                            >
                              <Eye size={15} />
                            </button>

                            {isEditable && (
                              <button
                                type="button"
                                onClick={() => setEditUserData(u)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition cursor-pointer"
                                title="Edit User Profile"
                              >
                                <Edit2 size={15} />
                              </button>
                            )}

                            {isEditable && (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(u)}
                                className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition border cursor-pointer ${
                                  u.is_active
                                    ? 'border-rose-200 text-rose-600 bg-rose-50/40 hover:bg-rose-50'
                                    : 'border-emerald-200 text-emerald-600 bg-emerald-50/40 hover:bg-emerald-50'
                                }`}
                              >
                                {u.is_active ? 'Disable' : 'Enable'}
                              </button>
                            )}

                            {canDeleteUser(u) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
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

            {/* Mobile Touch Card Stack (< md) */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredUsers.map((u) => {
                const isDeptHead = u.role === 'DEPT_HEAD';
                const isBizAdmin = u.role === 'BUSINESS_ADMIN';
                const isGlobalAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(u.role);

                const bizDisplay = isGlobalAdmin || isDeptHead ? 'All Businesses' : (u.business_name || 'No Business');
                const deptDisplay = isGlobalAdmin || isBizAdmin ? 'All Departments' : (u.department_name || 'No Department');

                const isEditable = canManageTargetUser(u);

                return (
                  <div key={u.id} className="p-4 space-y-3 hover:bg-blue-50/30 transition">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{u.full_name || u.username}</h4>
                        <p className="text-[11px] text-slate-500 font-mono">
                          <span className="text-blue-700 font-semibold">{u.employee_code || `EID${u.id.toString().padStart(3, '0')}`}</span> &bull; @{u.username}
                        </p>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider shrink-0 ${
                          u.is_active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {u.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getRoleBadge(u.role)}`}>
                        {u.role.replace('_', ' ')}
                      </span>
                      <span className="text-[11px] text-slate-600 font-medium">
                        {u.designation || 'Staff Member'}
                      </span>
                    </div>

                    {/* Scope details */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <Layers size={13} className="text-blue-600 shrink-0" />
                        <span className="text-slate-500">Matrix:</span>
                        <span className="text-slate-900 font-semibold truncate">
                          {isGlobalAdmin || isBizAdmin || isDeptHead ? 'All Matrices' : (u.matrix_title || 'No Matrix')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Briefcase size={13} className="text-blue-600 shrink-0" />
                        <span className="text-slate-500">Scope:</span>
                        <span className="text-slate-900 font-semibold truncate">
                          {bizDisplay} &bull; {deptDisplay}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserCheck size={13} className="text-blue-600 shrink-0" />
                        <span className="text-slate-500">Reports To:</span>
                        <span className="text-slate-900 font-semibold truncate">
                          {u.manager_name || 'Global Operations'}
                        </span>
                      </div>
                    </div>

                    {/* Actions row */}
                    <div className="flex items-center justify-between pt-1 gap-2">
                      <button
                        type="button"
                        onClick={() => setInspectProfileUserId(u.id)}
                        className="flex-1 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs rounded-xl font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Eye size={13} /> View
                      </button>

                      {isEditable && (
                        <button
                          type="button"
                          onClick={() => setEditUserData(u)}
                          className="flex-1 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded-xl font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                      )}

                      {isEditable && (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(u)}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                            u.is_active
                              ? 'border-rose-200 text-rose-600 bg-rose-50/50'
                              : 'border-emerald-200 text-emerald-600 bg-emerald-50/50'
                          }`}
                        >
                          {u.is_active ? 'Disable' : 'Enable'}
                        </button>
                      )}

                      {canDeleteUser(u) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u)}
                          className="p-2 text-rose-600 bg-rose-50 border border-rose-200 rounded-xl cursor-pointer"
                          title="Delete User"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
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
// CREATE USER MODAL
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200/90 shadow-[0_24px_50px_rgba(15,23,42,0.16)] max-w-xl w-full overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in fade-in duration-200 text-slate-800">
        <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                <UserPlus size={15} />
              </div>
              Provision New Staff Account
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Assign role and placement strictly within administrative scope.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="m-4 mb-0 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertCircle size={15} className="shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Username *</label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.trim() })}
                placeholder="e.g. john_doe"
                className="w-full bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none transition"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Corporate Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value.trim() })}
                placeholder="john@company.com"
                className="w-full bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Full Name</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="John Doe"
                className="w-full bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none transition"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Initial Password</label>
              <input
                type="text"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Default: TempPass@123"
                className="w-full bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Designation</label>
              <input
                type="text"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                placeholder="e.g. Operations Specialist"
                className="w-full bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none transition"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Date of Joining</label>
              <input
                type="date"
                value={formData.date_of_joining}
                onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })}
                className="w-full bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none transition"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Assigned Role Tier *</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value, matrix_id: '', business_id: '', department_id: '' })}
                className="w-full bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:border-blue-500 outline-none cursor-pointer"
              >
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
          <div className="bg-slate-50/90 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
            {(formData.role === 'EMPLOYEE' || formData.role === 'SUPERVISOR') && (
              <div>
                <label className="font-bold text-slate-800 block mb-1 flex items-center justify-between">
                  <span>Operational Matrix Branch {formData.role === 'SUPERVISOR' ? '(To Lead as Incharge)' : '*'}</span>
                  {selectedMatrix && (
                    <span className="text-[10px] text-blue-600 font-semibold">Auto-populates relationships</span>
                  )}
                </label>
                <select
                  value={formData.matrix_id}
                  onChange={(e) => setFormData({ ...formData, matrix_id: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:border-blue-500 outline-none cursor-pointer"
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
                    <div className="bg-white border border-slate-200/80 p-2.5 rounded-xl">
                      <span className="text-[10px] text-slate-500 block font-medium">Business Scope</span>
                      <strong className="text-slate-900 text-[11px] truncate block">{selectedMatrix.business_name}</strong>
                    </div>
                    <div className="bg-white border border-slate-200/80 p-2.5 rounded-xl">
                      <span className="text-[10px] text-slate-500 block font-medium">Department</span>
                      <strong className="text-slate-900 text-[11px] truncate block">{selectedMatrix.department_name}</strong>
                    </div>
                    <div className="bg-blue-50/80 border border-blue-200 p-2.5 rounded-xl">
                      <span className="text-[10px] text-blue-600 block font-semibold">
                        {formData.role === 'SUPERVISOR' ? 'Dual Lead Scope' : 'Direct Supervisor'}
                      </span>
                      <strong className="text-blue-800 text-[11px] truncate block">
                        {formData.role === 'SUPERVISOR' ? 'Biz Admin + Dept Admin' : selectedMatrix.supervisor_name}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500 mt-1 italic">
                    Selecting "No Matrix" leaves business, department, and direct reporting manager unassigned.
                  </p>
                )}
              </div>
            )}

            {/* BUSINESS ADMIN */}
            {formData.role === 'BUSINESS_ADMIN' && (
              <div>
                <label className="font-bold text-slate-800 block mb-1">Direct Business Jurisdiction</label>
                <select
                  value={formData.business_id}
                  onChange={(e) => setFormData({ ...formData, business_id: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:border-blue-500 outline-none cursor-pointer"
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

            {/* DEPT HEAD */}
            {formData.role === 'DEPT_HEAD' && (
              <div>
                <label className="font-bold text-slate-800 block mb-1">Functional Department Scope</label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:border-blue-500 outline-none cursor-pointer"
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
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-[11px] font-medium flex items-center gap-2">
                <Shield size={16} className="text-blue-600 shrink-0" />
                <span>Admins have global, unrestricted visibility across all businesses, departments, and matrix branches.</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Shift Start Time</label>
              <input
                type="time"
                value={formData.shift_start_time}
                onChange={(e) => setFormData({ ...formData, shift_start_time: e.target.value })}
                className="w-full bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Shift End Time</label>
              <input
                type="time"
                value={formData.shift_end_time}
                onChange={(e) => setFormData({ ...formData, shift_end_time: e.target.value })}
                className="w-full bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl font-semibold hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.25)] transition disabled:opacity-50 cursor-pointer"
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
// EDIT USER MODAL
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200/90 shadow-[0_24px_50px_rgba(15,23,42,0.16)] max-w-xl w-full overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in fade-in duration-200 text-slate-800">
        <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                <Edit2 size={14} />
              </div>
              Edit Profile: {user.full_name || user.username}
            </h2>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">Employee Code: <span className="text-blue-700 font-semibold">{user.employee_code || `EID${user.id}`}</span></p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="m-4 mb-0 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertCircle size={15} className="shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Corporate Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value.trim() })}
                className="w-full bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none transition"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Full Name</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Designation</label>
              <input
                type="text"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                className="w-full bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none transition"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Date of Joining</label>
              <input
                type="date"
                value={formData.date_of_joining}
                onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })}
                className="w-full bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none transition"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Role Tier</label>
              <select
                disabled={currentUser?.role === 'SUPERVISOR'}
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value, matrix_id: '', business_id: '', department_id: '' })}
                className="w-full bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:border-blue-500 outline-none cursor-pointer disabled:opacity-50"
              >
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

          <div className="bg-slate-50/90 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
            {(formData.role === 'EMPLOYEE' || formData.role === 'SUPERVISOR') && (
              <div>
                <label className="font-bold text-slate-800 block mb-1 flex items-center justify-between">
                  <span>Operational Matrix Branch {formData.role === 'SUPERVISOR' ? '(Leading as Incharge)' : ''}</span>
                  {selectedMatrix && (
                    <span className="text-[10px] text-blue-600 font-semibold">Cascades to members</span>
                  )}
                </label>
                <select
                  disabled={currentUser?.role === 'SUPERVISOR'}
                  value={formData.matrix_id}
                  onChange={(e) => setFormData({ ...formData, matrix_id: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:border-blue-500 outline-none cursor-pointer disabled:opacity-50"
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
                    <div className="bg-white border border-slate-200/80 p-2.5 rounded-xl">
                      <span className="text-[10px] text-slate-500 block font-medium">Business</span>
                      <strong className="text-slate-900 text-[11px] truncate block">{selectedMatrix.business_name}</strong>
                    </div>
                    <div className="bg-white border border-slate-200/80 p-2.5 rounded-xl">
                      <span className="text-[10px] text-slate-500 block font-medium">Department</span>
                      <strong className="text-slate-900 text-[11px] truncate block">{selectedMatrix.department_name}</strong>
                    </div>
                    <div className="bg-blue-50/80 border border-blue-200 p-2.5 rounded-xl">
                      <span className="text-[10px] text-blue-600 block font-semibold">Direct Lead</span>
                      <strong className="text-blue-800 text-[11px] truncate block">
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
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:border-blue-500 outline-none cursor-pointer"
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
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:border-blue-500 outline-none cursor-pointer"
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
              <span className="font-bold text-slate-900 block">Account Access Status</span>
              <p className="text-[11px] text-slate-500">Disabled accounts cannot authenticate or access workspaces.</p>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                formData.is_active
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {formData.is_active ? 'Active' : 'Disabled'}
            </button>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl font-semibold hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.25)] transition disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}