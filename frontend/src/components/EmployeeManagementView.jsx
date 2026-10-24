import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import UserProfileModal from './UserProfileModal';
import EmployeeEditModal from './EmployeeEditModal';
import { 
  Users, 
  Search, 
  Filter, 
  UserPlus, 
  Edit2, 
  CheckCircle2, 
  XCircle, 
  User,
  Building,
  Building2,
} from 'lucide-react';

export default function EmployeeManagementView({ currentUser, onOpenCreateUser }) {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedBizId, setSelectedBizId] = useState('');
  
  // Modals
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [profileModalUserId, setProfileModalUserId] = useState(null);

  const fetchCatalogs = async () => {
    try {
      const [deptRes, bizRes] = await Promise.all([
        api.get('/auth/departments/'),
        api.get('/auth/businesses/')
      ]);
      setDepartments(deptRes.data);
      setBusinesses(bizRes.data);
    } catch (err) {
      console.error('Failed to load filter catalogs', err);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      let url = '/auth/employees/manage/?';
      const params = new URLSearchParams();
      if (selectedDeptId) params.append('department_id', selectedDeptId);
      if (selectedBizId) params.append('business_id', selectedBizId);
      
      const res = await api.get(`${url}${params.toString()}`);
      setEmployees(res.data);
    } catch (err) {
      console.error('Failed to fetch employees', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogs();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [selectedDeptId, selectedBizId]);

  const handleToggleStatus = async (employee) => {
    try {
      await api.patch(`/auth/employees/manage/${employee.id}/toggle-status/`);
      fetchEmployees();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to toggle account status.');
    }
  };

  const handleEditClick = (employee) => {
    setSelectedEmployee(employee);
    setIsEditModalOpen(true);
  };

  // Client-side text & role filtering
  const filteredEmployees = employees.filter((emp) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      (emp.username && emp.username.toLowerCase().includes(q)) ||
      (emp.full_name && emp.full_name.toLowerCase().includes(q)) ||
      (emp.email && emp.email.toLowerCase().includes(q)) ||
      (emp.employee_code && emp.employee_code.toLowerCase().includes(q)) ||
      (emp.designation && emp.designation.toLowerCase().includes(q));

    const matchesRole = roleFilter === 'ALL' || emp.role === roleFilter;
    const matchesStatus = 
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && emp.is_active) ||
      (statusFilter === 'DISABLED' && !emp.is_active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const roleBadgeStyles = {
    SUPER_ADMIN: 'bg-rose-50 text-rose-700 border-rose-200',
    DEPT_HEAD: 'bg-purple-50 text-purple-700 border-purple-200',
    BUSINESS_ADMIN: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    ADMIN: 'bg-amber-50 text-amber-700 border-amber-200',
    SUPERVISOR: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    EMPLOYEE: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="text-blue-600" size={20} />
            <h2 className="text-lg font-bold text-slate-900">Workforce & Entity Console</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage company members, assign business entities, departments, and inspect personnel records.
          </p>
        </div>

        <button
          onClick={onOpenCreateUser}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3.5 py-2 rounded-xl font-medium transition shadow-xs"
        >
          <UserPlus size={14} /> + Add New Employee
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 w-full sm:w-72">
          <Search size={14} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, ID, email, title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-slate-800 outline-none w-full"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          
          {/* Department Filter (Supports "No Department") */}
          <div className="flex items-center gap-1.5">
            <Building size={14} className="text-slate-400" />
            <span className="text-slate-600 font-medium">Dept:</span>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-700"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Business Filter (Supports "No Business") */}
          <div className="flex items-center gap-1.5">
            <Building2 size={14} className="text-slate-400" />
            <span className="text-slate-600 font-medium">Business:</span>
            <select
              value={selectedBizId}
              onChange={(e) => setSelectedBizId(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-700"
            >
              <option value="">All Businesses</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          </div>

          {/* Role Filter */}
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-slate-400" />
            <span className="text-slate-600 font-medium">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-700"
            >
              <option value="ALL">All Roles</option>
              <option value="EMPLOYEE">Employee</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="BUSINESS_ADMIN">Business Admin</option>
              <option value="DEPT_HEAD">Dept Head</option>
              {currentUser.role === 'SUPER_ADMIN' && <option value="ADMIN">Admin</option>}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-700"
            >
              <option value="ALL">All</option>
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Master Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Role Tier</th>
                <th className="py-3 px-4">Business</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Reports To</th>
                <th className="py-3 px-4">Duty Schedule</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-slate-400">Loading workforce directory...</td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-slate-400">No personnel records found for this criteria.</td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{emp.full_name || emp.username}</div>
                      <div className="text-[11px] text-slate-500">{emp.email || 'No email registered'}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {emp.employee_code || 'EID-NA'} • {emp.designation || 'Staff'}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${roleBadgeStyles[emp.role] || ''}`}>
                        {emp.role}
                      </span>
                    </td>

                    {/* Business Column */}
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {emp.businesses && emp.businesses.length > 0 ? (
                          emp.businesses.map(b => (
                            <span 
                              key={b.id} 
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                b.name === 'No Business'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              }`}
                            >
                              {b.code}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </div>
                    </td>

                    {/* Department Column */}
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                        emp.primary_department === 'No Department' 
                          ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                          : 'text-slate-700'
                      }`}>
                        {emp.primary_department || 'Unassigned'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-700">
                      {emp.primary_manager ? (
                        <span className="font-medium text-slate-800">{emp.primary_manager}</span>
                      ) : (
                        <span className="text-slate-400 italic">None / Self</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                      {emp.shift_start_time || '09:00'} - {emp.shift_end_time || '18:00'}
                    </td>

                    <td className="py-3 px-4">
                      {emp.is_active ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={11} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                          <XCircle size={11} /> Disabled
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setProfileModalUserId(emp.id)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="View Employee Profile"
                        >
                          <User size={14} />
                        </button>

                        <button
                          onClick={() => handleEditClick(emp)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Edit Details"
                        >
                          <Edit2 size={14} />
                        </button>

                        {emp.id !== currentUser.id && (
                          <button
                            onClick={() => handleToggleStatus(emp)}
                            className={`px-2 py-1 rounded text-[11px] font-medium transition border ${
                              emp.is_active
                                ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                                : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {emp.is_active ? 'Disable' : 'Enable'}
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

      {/* User Profile Details Modal */}
      <UserProfileModal
        isOpen={Boolean(profileModalUserId)}
        onClose={() => setProfileModalUserId(null)}
        userId={profileModalUserId}
      />

      {/* Edit Form Modal */}
      <EmployeeEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        employee={selectedEmployee}
        currentUserRole={currentUser.role}
        onEmployeeUpdated={fetchEmployees}
      />
    </div>
  );
}