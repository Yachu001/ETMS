import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  FolderTree, 
  Layers, 
  Plus, 
  ToggleLeft, 
  ToggleRight, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  X,
  Users,
  UserPlus,
  UserMinus,
  Edit2,
  Shield
} from 'lucide-react';
import api from '../api/axios';

export default function BusinessDeptMatrixView({ currentUser, userRole, onClose }) {
  const [activeTab, setActiveTab] = useState('matrix');
  const [businesses, setBusinesses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [matrixList, setMatrixList] = useState([]);
  
  // Incharge Candidate Lists
  const [matrixCandidateIncharges, setMatrixCandidateIncharges] = useState([]);
  const [bizCandidateIncharges, setBizCandidateIncharges] = useState([]);
  const [deptCandidateIncharges, setDeptCandidateIncharges] = useState([]);

  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals state
  const [showBizModal, setShowBizModal] = useState(false);
  const [editingBiz, setEditingBiz] = useState(null);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [editingMatrix, setEditingMatrix] = useState(null);
  const [assigningMatrix, setAssigningMatrix] = useState(null);
  const [memberManagingMatrix, setMemberManagingMatrix] = useState(null);
  const [availableCandidates, setAvailableCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  // Form states
  const [bizForm, setBizForm] = useState({ name: '', code: '', description: '', incharge: '' });
  const [deptForm, setDeptForm] = useState({ name: '', code: '', parent: '', incharge: '' });
  const [matrixForm, setMatrixForm] = useState({ business: '', department: '', supervisor: '' });

  // Role permissions
  const isAdminOrSuper = ['SUPER_ADMIN', 'ADMIN'].includes(userRole);
  const isBusinessAdmin = userRole === 'BUSINESS_ADMIN';
  const isDeptHead = userRole === 'DEPT_HEAD';
  const isSupervisor = userRole === 'SUPERVISOR';
  
  const canCreateMatrix = isAdminOrSuper || isBusinessAdmin || isDeptHead;
  const canViewBizDeptTabs = isAdminOrSuper || isBusinessAdmin || isDeptHead;

  const triggerSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4500);
  };

  const fetchData = async () => {
    setLoading(true);
    setActionError('');
    try {
      const calls = [
        api.get('/auth/business-departments/'),
        api.get('/auth/business-departments/candidate-incharges/')
      ];

      if (canViewBizDeptTabs) {
        calls.push(api.get('/auth/businesses/'));
        calls.push(api.get('/auth/departments/matrix/'));
        calls.push(api.get('/auth/businesses/candidate-incharges/'));
        calls.push(api.get('/auth/departments/matrix/candidate-incharges/'));
      }

      const results = await Promise.all(calls);
      setMatrixList(results[0].data || []);
      setMatrixCandidateIncharges(results[1].data || []);

      if (canViewBizDeptTabs) {
        setBusinesses(results[2]?.data || []);
        setDepartments(results[3]?.data || []);
        setBizCandidateIncharges(results[4]?.data || []);
        setDeptCandidateIncharges(results[5]?.data || []);
      }
    } catch (err) {
      console.error('Failed to load matrix records:', err);
      setActionError(err.response?.data?.detail || 'Failed to load organization records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userRole]);

  // ==========================================
  // MATRIX ACTIONS
  // ==========================================
  const handleOpenCreateMatrix = () => {
    setEditingMatrix(null);
    let initialBiz = '';
    let initialDept = '';

    if (isBusinessAdmin && currentUser?.business_id) {
      initialBiz = currentUser.business_id;
    }
    if (isDeptHead && currentUser?.department_id) {
      initialDept = currentUser.department_id;
    }

    setMatrixForm({
      business: initialBiz,
      department: initialDept,
      supervisor: ''
    });
    setShowMatrixModal(true);
  };

  const handleOpenEditMatrix = (matrix) => {
    setEditingMatrix(matrix);
    setMatrixForm({
      business: matrix.business || '',
      department: matrix.department || '',
      supervisor: matrix.supervisor || ''
    });
    setShowMatrixModal(true);
  };

  const handleSaveMatrix = async (e) => {
    e.preventDefault();
    setActionError('');
    try {
      const payload = {
        business: isBusinessAdmin && currentUser?.business_id ? currentUser.business_id : matrixForm.business,
        department: isDeptHead && currentUser?.department_id ? currentUser.department_id : matrixForm.department,
      };
      if (matrixForm.supervisor) {
        payload.supervisor = matrixForm.supervisor;
      }

      if (editingMatrix) {
        await api.patch(`/auth/business-departments/${editingMatrix.id}/`, payload);
        triggerSuccess('Matrix branch updated successfully.');
      } else {
        await api.post('/auth/business-departments/', payload);
        triggerSuccess('Matrix branch created successfully.');
      }

      setShowMatrixModal(false);
      setEditingMatrix(null);
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || err.response?.data?.non_field_errors?.[0] || 'Error saving matrix.');
    }
  };

  const handleToggleMatrix = async (matrix) => {
    setActionError('');
    if (matrix.is_active && (matrix.assigned_members_count > 0 || (matrix.members && matrix.members.length > 0))) {
      setActionError(`Cannot disable Matrix branch "${matrix.business_code} - ${matrix.department_name}". Remove active members first.`);
      return;
    }

    try {
      const res = await api.post(`/auth/business-departments/${matrix.id}/toggle-active/`);
      triggerSuccess(res.data.message || 'Matrix status toggled.');
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Failed to toggle matrix branch status.');
    }
  };

  const handleDeleteMatrix = async (matrix) => {
    setActionError('');
    if (matrix.assigned_members_count > 0 || (matrix.members && matrix.members.length > 0)) {
      setActionError(`Cannot delete Matrix branch "${matrix.business_code} - ${matrix.department_name}". Remove active members first.`);
      return;
    }

    const confirmPrompt = `Are you sure you want to permanently delete Matrix branch "${matrix.business_code} - ${matrix.department_name}"?`;
    if (!window.confirm(confirmPrompt)) return;

    try {
      await api.delete(`/auth/business-departments/${matrix.id}/`);
      triggerSuccess('Matrix branch deleted successfully.');
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Cannot delete matrix branch.');
    }
  };

  const handleAssignSupervisor = async (matrixId, supervisorId) => {
    setActionError('');
    try {
      await api.post(`/auth/business-departments/${matrixId}/assign-supervisor/`, {
        supervisor_id: supervisorId || null
      });
      triggerSuccess('Matrix incharge supervisor updated.');
      setAssigningMatrix(null);
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Failed to assign supervisor.');
    }
  };

  const handleOpenMembersModal = async (matrix) => {
    setMemberManagingMatrix(matrix);
    setLoadingCandidates(true);
    try {
      const res = await api.get(`/auth/business-departments/${matrix.id}/available-candidates/`);
      setAvailableCandidates(res.data || []);
    } catch (err) {
      console.error('Failed to load candidate employees', err);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleAddMember = async (userId) => {
    setActionError('');
    try {
      await api.post(`/auth/business-departments/${memberManagingMatrix.id}/add-member/`, { user_id: userId });
      triggerSuccess('Staff member added to matrix.');
      fetchData();
      handleOpenMembersModal(memberManagingMatrix);
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Failed to add member to matrix.');
    }
  };

  const handleRemoveMember = async (userId) => {
    setActionError('');
    try {
      await api.post(`/auth/business-departments/${memberManagingMatrix.id}/remove-member/`, { user_id: userId });
      triggerSuccess('Staff member unassigned from matrix.');
      fetchData();
      handleOpenMembersModal(memberManagingMatrix);
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Failed to remove member from matrix.');
    }
  };

  // ==========================================
  // BUSINESS ACTIONS (WITH INCHARGE)
  // ==========================================
  const handleOpenCreateBiz = () => {
    setEditingBiz(null);
    setBizForm({ name: '', code: '', description: '', incharge: '' });
    setShowBizModal(true);
  };

  const handleOpenEditBiz = (biz) => {
    setEditingBiz(biz);
    setBizForm({ 
      name: biz.name, 
      code: biz.code, 
      description: biz.description || '', 
      incharge: biz.incharge || '' 
    });
    setShowBizModal(true);
  };

  const handleSaveBiz = async (e) => {
    e.preventDefault();
    setActionError('');
    try {
      const payload = { ...bizForm };
      if (!payload.incharge) delete payload.incharge;

      if (editingBiz) {
        await api.patch(`/auth/businesses/${editingBiz.id}/`, payload);
        triggerSuccess('Business updated successfully.');
      } else {
        await api.post('/auth/businesses/', payload);
        triggerSuccess('Business created successfully.');
      }
      setShowBizModal(false);
      setEditingBiz(null);
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Error saving business.');
    }
  };

  const handleToggleBiz = async (biz) => {
    setActionError('');
    if (biz.is_active) {
      if (biz.total_members > 0) {
        setActionError(`Cannot disable Business "${biz.name}". Reassign its ${biz.total_members} active users first.`);
        return;
      }
      if (biz.active_departments_count > 0) {
        setActionError(`Cannot disable Business "${biz.name}". Disable or remove its active matrix branches first.`);
        return;
      }
    }

    try {
      const res = await api.post(`/auth/businesses/${biz.id}/toggle-active/`);
      triggerSuccess(res.data.message || 'Business status toggled.');
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Failed to toggle status.');
    }
  };

  const handleDeleteBiz = async (biz) => {
    setActionError('');
    if (biz.total_members > 0) {
      setActionError(`Cannot delete Business "${biz.name}". Reassign its ${biz.total_members} active users first.`);
      return;
    }
    if (biz.active_departments_count > 0) {
      setActionError(`Cannot delete Business "${biz.name}". Remove its active matrix branches first.`);
      return;
    }

    const confirmPrompt = `Are you sure you want to permanently delete Business "${biz.name}"?`;
    if (!window.confirm(confirmPrompt)) return;

    try {
      await api.delete(`/auth/businesses/${biz.id}/`);
      triggerSuccess('Business deleted successfully.');
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Failed to delete business.');
    }
  };

  // ==========================================
  // DEPARTMENT ACTIONS (WITH INCHARGE)
  // ==========================================
  const handleOpenCreateDept = () => {
    setEditingDept(null);
    setDeptForm({ name: '', code: '', parent: '', incharge: '' });
    setShowDeptModal(true);
  };

  const handleOpenEditDept = (dept) => {
    setEditingDept(dept);
    setDeptForm({ 
      name: dept.name, 
      code: dept.code || '', 
      parent: dept.parent || '', 
      incharge: dept.incharge || '' 
    });
    setShowDeptModal(true);
  };

  const handleSaveDept = async (e) => {
    e.preventDefault();
    setActionError('');
    try {
      const payload = { ...deptForm };
      if (!payload.parent) delete payload.parent;
      if (!payload.incharge) delete payload.incharge;

      if (editingDept) {
        await api.patch(`/auth/departments/matrix/${editingDept.id}/`, payload);
        triggerSuccess('Department updated successfully.');
      } else {
        await api.post('/auth/departments/matrix/', payload);
        triggerSuccess('Department created successfully.');
      }
      setShowDeptModal(false);
      setEditingDept(null);
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Error saving department.');
    }
  };

  const handleToggleDept = async (dept) => {
    setActionError('');
    if (dept.is_active && dept.total_members > 0) {
      setActionError(`Cannot disable Department "${dept.name}". Reassign its ${dept.total_members} active members first.`);
      return;
    }

    try {
      const res = await api.post(`/auth/departments/matrix/${dept.id}/toggle-active/`);
      triggerSuccess(res.data.message || 'Department status toggled.');
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Failed to toggle status.');
    }
  };

  const handleDeleteDept = async (dept) => {
    setActionError('');
    if (dept.total_members > 0) {
      setActionError(`Cannot delete Department "${dept.name}". Reassign its ${dept.total_members} active members first.`);
      return;
    }

    const confirmPrompt = `Are you sure you want to permanently delete Department "${dept.name}"?`;
    if (!window.confirm(confirmPrompt)) return;

    try {
      await api.delete(`/auth/departments/matrix/${dept.id}/`);
      triggerSuccess('Department deleted successfully.');
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Failed to delete department.');
    }
  };

  const canManageInchargeForMatrix = (matrix) => {
    if (isAdminOrSuper) return true;
    if (isBusinessAdmin && currentUser?.business_id && matrix.business === currentUser.business_id) return true;
    if (isDeptHead && currentUser?.department_id && matrix.department === currentUser.department_id) return true;
    return false;
  };

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            Organization & Matrix Management
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isSupervisor
              ? 'Manage assigned matrix branch members and inspect team allocations.'
              : 'Configure Businesses, Departments, and cross-matrix pairings with designated Incharges.'}
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="self-end sm:self-auto p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {actionError && (
        <div className="m-4 sm:m-6 p-3 sm:p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3 text-rose-700 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
          <div className="flex-1 font-medium">{actionError}</div>
          <button onClick={() => setActionError('')} className="text-rose-400 hover:text-rose-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="m-4 sm:m-6 p-3 sm:p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3 text-emerald-700 text-xs sm:text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" />
          <div className="flex-1 font-medium">{successMsg}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 sm:px-6 pt-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
              activeTab === 'matrix' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            Matrix Branches ({matrixList.length})
          </button>

          {canViewBizDeptTabs && (
            <>
              <button
                onClick={() => setActiveTab('businesses')}
                className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
                  activeTab === 'businesses' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Building2 className="w-4 h-4" />
                Businesses ({businesses.length})
              </button>
              <button
                onClick={() => setActiveTab('departments')}
                className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
                  activeTab === 'departments' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <FolderTree className="w-4 h-4" />
                Departments ({departments.length})
              </button>
            </>
          )}
        </div>

        {/* Action Button */}
        <div className="pb-3 md:pb-0">
          {activeTab === 'matrix' && canCreateMatrix && (
            <button
              onClick={handleOpenCreateMatrix}
              className="w-full sm:w-auto px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Matrix Branch
            </button>
          )}
          {activeTab === 'businesses' && isAdminOrSuper && (
            <button
              onClick={handleOpenCreateBiz}
              className="w-full sm:w-auto px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Business
            </button>
          )}
          {activeTab === 'departments' && isAdminOrSuper && (
            <button
              onClick={handleOpenCreateDept}
              className="w-full sm:w-auto px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Department
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Panels */}
      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Loading organizational records...</div>
        ) : (
          <>
            {/* TAB 1: MATRIX BRANCHES */}
            {activeTab === 'matrix' && (
              <div>
                {matrixList.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                    No Matrix branches available in your authorized scope.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Matrix Branch</th>
                          <th className="py-3 px-4">Operating Business</th>
                          <th className="py-3 px-4">Functional Department</th>
                          <th className="py-3 px-4">Appointed Incharge</th>
                          <th className="py-3 px-4">Members</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {matrixList.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50/70">
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {m.business_code} - {m.department_name}
                            </td>
                            <td className="py-3 px-4 text-slate-800">{m.business_name}</td>
                            <td className="py-3 px-4 text-slate-800">{m.department_name}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className={`font-semibold ${m.supervisor ? 'text-indigo-700' : 'text-slate-400 italic'}`}>
                                  {m.supervisor_name || 'Unassigned Lead'}
                                </span>
                                {canManageInchargeForMatrix(m) && (
                                  <button
                                    onClick={() => setAssigningMatrix(m)}
                                    className="text-[10px] text-blue-600 hover:underline font-semibold cursor-pointer"
                                  >
                                    Change
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <button
                                onClick={() => handleOpenMembersModal(m)}
                                className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-full cursor-pointer transition"
                              >
                                <Users className="w-3.5 h-3.5 text-indigo-600" />
                                {m.assigned_members_count} members &bull; Manage
                              </button>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${
                                m.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {m.is_active ? 'Active' : 'Disabled'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {canCreateMatrix && (
                                  <button
                                    onClick={() => handleOpenEditMatrix(m)}
                                    className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                                    title="Edit Matrix Branch"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {isAdminOrSuper && (
                                  <>
                                    <button
                                      onClick={() => handleToggleMatrix(m)}
                                      className="p-1 text-slate-500 hover:text-indigo-600 rounded transition cursor-pointer"
                                      title={m.is_active ? 'Disable Branch (Must have 0 members)' : 'Enable Branch'}
                                    >
                                      {m.is_active ? (
                                        <ToggleRight className="w-5 h-5 text-emerald-600" />
                                      ) : (
                                        <ToggleLeft className="w-5 h-5 text-slate-400" />
                                      )}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteMatrix(m)}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                                      title="Delete Matrix Branch (Must have 0 members)"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: BUSINESSES */}
            {activeTab === 'businesses' && canViewBizDeptTabs && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {businesses.map((biz) => (
                  <div key={biz.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:shadow-xs transition">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                          {biz.code}
                        </span>
                        <h3 className="font-bold text-slate-900 text-sm mt-2">{biz.name}</h3>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        biz.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {biz.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </div>

                    <div className="mt-3 py-1.5 px-2.5 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">Business Incharge:</span>
                      <span className="text-[11px] font-bold text-indigo-700">
                        {biz.incharge_name || 'Unassigned'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                      {biz.description || 'No description provided.'}
                    </p>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                      <span>{biz.total_members} Staff &bull; {biz.active_departments_count} Branches</span>
                      {isAdminOrSuper && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditBiz(biz)}
                            className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                            title="Edit Business"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleBiz(biz)}
                            className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                            title={biz.is_active ? 'Disable Business' : 'Enable Business'}
                          >
                            {biz.is_active ? (
                              <ToggleRight className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <ToggleLeft className="w-5 h-5 text-slate-400" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteBiz(biz)}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="Delete Business"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 3: DEPARTMENTS */}
            {activeTab === 'departments' && canViewBizDeptTabs && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {departments.map((dept) => (
                  <div key={dept.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:shadow-xs transition">
                    <div className="flex items-start justify-between">
                      <div>
                        {dept.code && (
                          <span className="text-[10px] font-bold uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                            {dept.code}
                          </span>
                        )}
                        <h3 className="font-bold text-slate-900 text-sm mt-1">{dept.name}</h3>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        dept.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {dept.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </div>

                    <div className="mt-3 py-1.5 px-2.5 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">Dept Incharge:</span>
                      <span className="text-[11px] font-bold text-indigo-700">
                        {dept.incharge_name || 'Unassigned'}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" /> {dept.total_members} Members
                      </span>
                      {isAdminOrSuper && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditDept(dept)}
                            className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                            title="Edit Department"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleDept(dept)}
                            className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                            title={dept.is_active ? 'Disable Department' : 'Enable Department'}
                          >
                            {dept.is_active ? (
                              <ToggleRight className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <ToggleLeft className="w-5 h-5 text-slate-400" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteDept(dept)}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="Delete Department"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL: ASSIGN INCHARGE (SUPERVISOR) */}
      {assigningMatrix && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Assign Matrix Incharge</h3>
              <button onClick={() => setAssigningMatrix(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Select supervisor to lead <strong>{assigningMatrix.business_code} - {assigningMatrix.department_name}</strong>. Base members in this branch will automatically report to this person.
            </p>

            <select
              defaultValue={assigningMatrix.supervisor || ''}
              id="supervisor-incharge-select"
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 font-medium outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- No Incharge (Unassigned) --</option>
              {matrixCandidateIncharges.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
              ))}
            </select>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAssigningMatrix(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const val = document.getElementById('supervisor-incharge-select').value;
                  handleAssignSupervisor(assigningMatrix.id, val);
                }}
                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer"
              >
                Save Incharge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / REMOVE MEMBERS */}
      {memberManagingMatrix && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Manage Branch Members</h3>
                <p className="text-[11px] text-slate-500">
                  {memberManagingMatrix.business_code} - {memberManagingMatrix.department_name} &bull; Lead: {memberManagingMatrix.supervisor_name || 'Unassigned'}
                </p>
              </div>
              <button onClick={() => setMemberManagingMatrix(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              <div className="space-y-2">
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  Current Members ({memberManagingMatrix.members?.length || memberManagingMatrix.assigned_members_count || 0})
                </h4>
                {memberManagingMatrix.members && memberManagingMatrix.members.length > 0 ? (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {memberManagingMatrix.members.map((u) => (
                      <div key={u.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <div className="font-semibold text-slate-900">{u.full_name || u.username}</div>
                          <div className="text-[10px] text-slate-400">{u.designation || 'Staff'}</div>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(u.id)}
                          className="flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-800 font-medium px-2 py-1 rounded-lg hover:bg-rose-50 cursor-pointer"
                        >
                          <UserMinus size={13} /> Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic p-3 border border-dashed rounded-xl text-center">
                    No base members mapped to this matrix.
                  </p>
                )}
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-100">
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  Add Unassigned Employees to Branch
                </h4>
                {loadingCandidates ? (
                  <p className="text-slate-400 text-center py-4">Loading candidate employees...</p>
                ) : availableCandidates.length === 0 ? (
                  <p className="text-slate-400 italic p-3 border border-dashed rounded-xl text-center">
                    No unassigned employees available.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {availableCandidates.map((u) => (
                      <div key={u.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <div className="font-semibold text-slate-900">{u.name}</div>
                          <div className="text-[10px] text-slate-400">{u.designation} &bull; @{u.username}</div>
                        </div>
                        <button
                          onClick={() => handleAddMember(u.id)}
                          className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 rounded-lg hover:bg-indigo-50 cursor-pointer"
                        >
                          <UserPlus size={13} /> Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setMemberManagingMatrix(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs rounded-xl font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT MATRIX BRANCH */}
      {showMatrixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">
                {editingMatrix ? 'Edit Matrix Branch' : 'Create New Matrix Branch'}
              </h3>
              <button onClick={() => setShowMatrixModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveMatrix} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Business</label>
                {isBusinessAdmin ? (
                  <div className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-100 rounded-lg font-bold text-slate-700">
                    {currentUser?.business_name || 'My Business'} (Locked)
                  </div>
                ) : (
                  <select
                    required
                    value={matrixForm.business}
                    onChange={(e) => setMatrixForm({ ...matrixForm, business: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
                  >
                    <option value="">-- Choose Business --</option>
                    {businesses.filter((b) => b.is_active).map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Department</label>
                {isDeptHead ? (
                  <div className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-100 rounded-lg font-bold text-slate-700">
                    {currentUser?.department_name || 'My Department'} (Locked)
                  </div>
                ) : (
                  <select
                    required
                    value={matrixForm.department}
                    onChange={(e) => setMatrixForm({ ...matrixForm, department: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
                  >
                    <option value="">-- Choose Department --</option>
                    {departments.filter((d) => d.is_active).map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Appoint Incharge Supervisor (Optional)</label>
                <select
                  value={matrixForm.supervisor}
                  onChange={(e) => setMatrixForm({ ...matrixForm, supervisor: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
                >
                  <option value="">-- Unassigned (Assign Later) --</option>
                  {matrixCandidateIncharges.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMatrixModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer"
                >
                  {editingMatrix ? 'Save Changes' : 'Create Matrix Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT BUSINESS (WITH INCHARGE) */}
      {showBizModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">
                {editingBiz ? 'Edit Business Details' : 'Add New Business'}
              </h3>
              <button onClick={() => setShowBizModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveBiz} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Business Name</label>
                <input
                  type="text"
                  required
                  value={bizForm.name}
                  onChange={(e) => setBizForm({ ...bizForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Business Code</label>
                <input
                  type="text"
                  required
                  value={bizForm.code}
                  onChange={(e) => setBizForm({ ...bizForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono uppercase"
                />
              </div>

              {/* Business Incharge Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Business Admin / Incharge (Optional)
                </label>
                <select
                  value={bizForm.incharge}
                  onChange={(e) => setBizForm({ ...bizForm, incharge: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="">-- Default to Creator ({currentUser?.username}) --</option>
                  {bizCandidateIncharges.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Only Business Admins and above can be appointed.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={bizForm.description}
                  onChange={(e) => setBizForm({ ...bizForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowBizModal(false)} className="px-3 py-1.5 text-xs text-slate-600 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg cursor-pointer">
                  {editingBiz ? 'Update Business' : 'Save Business'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT DEPARTMENT (WITH INCHARGE) */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">
                {editingDept ? 'Edit Department Details' : 'Add New Department'}
              </h3>
              <button onClick={() => setShowDeptModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveDept} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department Name</label>
                <input
                  type="text"
                  required
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department Code</label>
                <input
                  type="text"
                  required
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono uppercase"
                />
              </div>

              {/* Department Incharge Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Department Head / Incharge (Optional)
                </label>
                <select
                  value={deptForm.incharge}
                  onChange={(e) => setDeptForm({ ...deptForm, incharge: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="">-- Default to Creator ({currentUser?.username}) --</option>
                  {deptCandidateIncharges.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Only Department Admins and above can be appointed.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowDeptModal(false)} className="px-3 py-1.5 text-xs text-slate-600 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg cursor-pointer">
                  {editingDept ? 'Update Department' : 'Save Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}