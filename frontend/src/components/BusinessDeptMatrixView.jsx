// frontend/src/components/BusinessDeptMatrixView.jsx

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
  RefreshCw,
  Search
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

  // Search & Filter state for Matrix branches
  const [matrixSearch, setMatrixSearch] = useState('');
  const [matrixBizFilter, setMatrixBizFilter] = useState('ALL');
  const [matrixDeptFilter, setMatrixDeptFilter] = useState('ALL');
  const [matrixStatusFilter, setMatrixStatusFilter] = useState('ALL');

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
  const [bizForm, setBizForm] = useState({ name: '', code: '', description: '', incharge_id: '' });
  const [deptForm, setDeptForm] = useState({ name: '', code: '', parent: '', incharge_id: '' });
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
        calls.push(api.get('/auth/departments/'));
        calls.push(api.get('/auth/businesses/candidate-incharges/'));
        calls.push(api.get('/auth/departments/candidate-incharges/'));
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

  // Dynamic candidate fetcher scoped by selected business and department
  const fetchMatrixCandidates = async (bizId, deptId, matrixId = null) => {
    try {
      const params = new URLSearchParams();
      if (bizId) params.append('business_id', bizId);
      if (deptId) params.append('department_id', deptId);
      if (matrixId) params.append('matrix_id', matrixId);

      const res = await api.get(`/auth/business-departments/candidate-incharges/?${params.toString()}`);
      setMatrixCandidateIncharges(res.data || []);
    } catch (err) {
      console.error('Error fetching scoped matrix candidates:', err);
    }
  };

  // ==========================================
  // MATRIX ACTIONS
  // ==========================================
  const handleOpenCreateMatrix = async () => {
    setEditingMatrix(null);
    let initialBiz = '';
    let initialDept = '';

    if (isBusinessAdmin && currentUser?.business_id) {
      initialBiz = String(currentUser.business_id);
    }
    if (isDeptHead && currentUser?.department_id) {
      initialDept = String(currentUser.department_id);
    }

    setMatrixForm({
      business: initialBiz,
      department: initialDept,
      supervisor: ''
    });

    await fetchMatrixCandidates(initialBiz, initialDept);
    setShowMatrixModal(true);
  };

  const handleOpenEditMatrix = async (matrix) => {
    setEditingMatrix(matrix);
    const initialBiz = matrix.business ? String(matrix.business) : '';
    const initialDept = matrix.department ? String(matrix.department) : '';
    const initialSup = matrix.supervisor ? String(matrix.supervisor) : '';

    setMatrixForm({
      business: initialBiz,
      department: initialDept,
      supervisor: initialSup
    });

    await fetchMatrixCandidates(initialBiz, initialDept, matrix.id);
    setShowMatrixModal(true);
  };

  const handleMatrixBusinessChange = (bizId) => {
    setMatrixForm((prev) => ({ ...prev, business: bizId }));
    fetchMatrixCandidates(bizId, matrixForm.department, editingMatrix?.id);
  };

  const handleMatrixDepartmentChange = (deptId) => {
    setMatrixForm((prev) => ({ ...prev, department: deptId }));
    fetchMatrixCandidates(matrixForm.business, deptId, editingMatrix?.id);
  };

  const handleSaveMatrix = async (e) => {
    e.preventDefault();
    setActionError('');
    try {
      const payload = {
        business: isBusinessAdmin && currentUser?.business_id ? currentUser.business_id : parseInt(matrixForm.business, 10),
        department: isDeptHead && currentUser?.department_id ? currentUser.department_id : parseInt(matrixForm.department, 10),
      };
      payload.supervisor = matrixForm.supervisor ? parseInt(matrixForm.supervisor, 10) : null;

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

  const handleOpenAssignSupervisor = async (matrix) => {
    setAssigningMatrix(matrix);
    await fetchMatrixCandidates(matrix.business, matrix.department, matrix.id);
  };

  const handleAssignSupervisor = async (matrixId, supervisorId) => {
    setActionError('');
    try {
      await api.post(`/auth/business-departments/${matrixId}/assign-supervisor/`, {
        supervisor_id: supervisorId ? parseInt(supervisorId, 10) : null
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
  // BUSINESS ACTIONS (ADMIN & SUPER ADMIN ONLY)
  // ==========================================
  const handleOpenCreateBiz = async () => {
    if (!isAdminOrSuper) return;
    setEditingBiz(null);
    setBizForm({ name: '', code: '', description: '', incharge_id: '' });
    try {
      const res = await api.get('/auth/businesses/candidate-incharges/');
      setBizCandidateIncharges(res.data || []);
    } catch (err) {
      console.error(err);
    }
    setShowBizModal(true);
  };

  const handleOpenEditBiz = async (biz) => {
    if (!isAdminOrSuper) return;
    setEditingBiz(biz);
    setBizForm({ 
      name: biz.name, 
      code: biz.code, 
      description: biz.description || '', 
      incharge_id: biz.incharge ? String(biz.incharge) : (biz.incharge_id ? String(biz.incharge_id) : '')
    });
    try {
      const res = await api.get(`/auth/businesses/candidate-incharges/?business_id=${biz.id}`);
      setBizCandidateIncharges(res.data || []);
    } catch (err) {
      console.error(err);
    }
    setShowBizModal(true);
  };

  const handleSaveBiz = async (e) => {
    e.preventDefault();
    if (!isAdminOrSuper) return;
    setActionError('');
    try {
      const payload = {
        name: bizForm.name.trim(),
        description: bizForm.description || '',
        incharge_id: bizForm.incharge_id ? parseInt(bizForm.incharge_id, 10) : null
      };

      if (!editingBiz) {
        payload.code = bizForm.code.trim().toUpperCase();
        await api.post('/auth/businesses/', payload);
        triggerSuccess('Business created successfully.');
      } else {
        await api.patch(`/auth/businesses/${editingBiz.id}/`, payload);
        triggerSuccess('Business updated successfully.');
      }
      setShowBizModal(false);
      setEditingBiz(null);
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || err.response?.data?.name?.[0] || 'Error saving business.');
    }
  };

  const handleToggleBiz = async (biz) => {
    if (!isAdminOrSuper) return;
    setActionError('');
    if (biz.is_active) {
      if (biz.active_users_count > 0) {
        setActionError(`Cannot disable Business "${biz.name}". Reassign its ${biz.active_users_count} active users first.`);
        return;
      }
      if (biz.active_matrices_count > 0) {
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
    if (!isAdminOrSuper) return;
    setActionError('');
    if (biz.active_users_count > 0) {
      setActionError(`Cannot delete Business "${biz.name}". Reassign its ${biz.active_users_count} active users first.`);
      return;
    }
    if (biz.active_matrices_count > 0) {
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
  // DEPARTMENT ACTIONS (ADMIN & SUPER ADMIN ONLY)
  // ==========================================
  const handleOpenCreateDept = async () => {
    if (!isAdminOrSuper) return;
    setEditingDept(null);
    setDeptForm({ name: '', code: '', parent: '', incharge_id: '' });
    try {
      const res = await api.get('/auth/departments/candidate-incharges/');
      setDeptCandidateIncharges(res.data || []);
    } catch (err) {
      console.error(err);
    }
    setShowDeptModal(true);
  };

  const handleOpenEditDept = async (dept) => {
    if (!isAdminOrSuper) return;
    setEditingDept(dept);
    setDeptForm({ 
      name: dept.name, 
      code: dept.code || '', 
      parent: dept.parent ? String(dept.parent) : '', 
      incharge_id: dept.incharge ? String(dept.incharge) : (dept.incharge_id ? String(dept.incharge_id) : '')
    });
    try {
      const res = await api.get(`/auth/departments/candidate-incharges/?department_id=${dept.id}`);
      setDeptCandidateIncharges(res.data || []);
    } catch (err) {
      console.error(err);
    }
    setShowDeptModal(true);
  };

  const handleSaveDept = async (e) => {
    e.preventDefault();
    if (!isAdminOrSuper) return;
    setActionError('');
    try {
      const payload = {
        name: deptForm.name.trim(),
        parent: deptForm.parent ? parseInt(deptForm.parent, 10) : null,
        incharge_id: deptForm.incharge_id ? parseInt(deptForm.incharge_id, 10) : null
      };

      if (!editingDept) {
        payload.code = deptForm.code.trim().toUpperCase();
        await api.post('/auth/departments/', payload);
        triggerSuccess('Department created successfully.');
      } else {
        await api.patch(`/auth/departments/${editingDept.id}/`, payload);
        triggerSuccess('Department updated successfully.');
      }
      setShowDeptModal(false);
      setEditingDept(null);
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || err.response?.data?.name?.[0] || 'Error saving department.');
    }
  };

  const handleToggleDept = async (dept) => {
    if (!isAdminOrSuper) return;
    setActionError('');
    if (dept.is_active && dept.active_users_count > 0) {
      setActionError(`Cannot disable Department "${dept.name}". Reassign its ${dept.active_users_count} active members first.`);
      return;
    }

    try {
      const res = await api.post(`/auth/departments/${dept.id}/toggle-active/`);
      triggerSuccess(res.data.message || 'Department status toggled.');
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Failed to toggle status.');
    }
  };

  const handleDeleteDept = async (dept) => {
    if (!isAdminOrSuper) return;
    setActionError('');
    if (dept.active_users_count > 0) {
      setActionError(`Cannot delete Department "${dept.name}". Reassign its ${dept.active_users_count} active members first.`);
      return;
    }

    const confirmPrompt = `Are you sure you want to permanently delete Department "${dept.name}"?`;
    if (!window.confirm(confirmPrompt)) return;

    try {
      await api.delete(`/auth/departments/${dept.id}/`);
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

  // Filtered Matrix List based on Toolbar Search & Scopes
  const filteredMatrixList = matrixList.filter((m) => {
    if (matrixBizFilter !== 'ALL' && String(m.business) !== String(matrixBizFilter)) return false;
    if (matrixDeptFilter !== 'ALL' && String(m.department) !== String(matrixDeptFilter)) return false;
    if (matrixStatusFilter !== 'ALL') {
      const isAct = matrixStatusFilter === 'ACTIVE';
      if (m.is_active !== isAct) return false;
    }
    if (matrixSearch.trim()) {
      const q = matrixSearch.toLowerCase().trim();
      const matchTitle = m.title?.toLowerCase().includes(q);
      const matchBiz = m.business_name?.toLowerCase().includes(q);
      const matchDept = m.department_name?.toLowerCase().includes(q);
      const matchSup = m.supervisor_name?.toLowerCase().includes(q);
      return matchTitle || matchBiz || matchDept || matchSup;
    }
    return true;
  });

  return (
    <div className="bg-[#0b0c0e] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_20px_rgba(245,158,11,0.12)] border border-amber-400/50 overflow-hidden max-w-7xl mx-auto text-neutral-200">
      {/* Header Banner */}
      <div className="p-4 sm:p-6 border-b border-amber-500/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10">
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5 tracking-wide">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1c1917] via-[#161412] to-[#0a0a0a] text-amber-300 border border-amber-400/40 flex items-center justify-center shadow-xs">
              <Building2 size={16} className="text-amber-400" />
            </div>
            Organization & Matrix Management
          </h2>
          <p className="text-xs text-amber-200/50 mt-1 max-w-2xl leading-relaxed">
            {isSupervisor
              ? 'Manage assigned matrix branch members and inspect team allocations.'
              : isBusinessAdmin
              ? `Configure and oversee cross-department matrix branches for ${currentUser?.business_name || 'your business'}.`
              : isDeptHead
              ? `Configure and oversee cross-business matrix branches for ${currentUser?.department_name || 'your department'}.`
              : 'Configure Businesses, Departments, and cross-matrix pairings with designated Incharges.'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto relative z-10">
          <button
            type="button"
            onClick={fetchData}
            className="p-2.5 text-amber-300 hover:text-white bg-[#141518] hover:bg-amber-500/15 rounded-xl border border-amber-500/30 transition cursor-pointer shadow-xs"
            title="Refresh Directory"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
          {onClose && (
            <button 
              onClick={onClose} 
              className="p-2.5 text-neutral-400 hover:text-amber-300 rounded-xl hover:bg-amber-500/10 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="m-4 sm:m-6 p-3.5 bg-rose-950/30 border border-rose-500/30 rounded-2xl flex items-start gap-3 text-rose-300 text-xs font-medium shadow-md">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          <div className="flex-1 leading-relaxed">{actionError}</div>
          <button onClick={() => setActionError('')} className="text-rose-400 hover:text-rose-200 cursor-pointer">
            <X size={15} />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="m-4 sm:m-6 p-3.5 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl flex items-start gap-3 text-emerald-300 text-xs font-medium shadow-md">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
          <div className="flex-1">{successMsg}</div>
        </div>
      )}

      {/* Tabs & Header Controls */}
      <div className="px-4 sm:px-6 pt-4 border-b border-amber-500/15 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 whitespace-nowrap transition cursor-pointer tracking-wide ${
              activeTab === 'matrix' 
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black border border-amber-400 shadow-[0_0_15px_rgba(212,175,55,0.25)]' 
                : 'text-neutral-400 hover:text-amber-200 hover:bg-[#141518]'
            }`}
          >
            <Layers size={14} className={activeTab === 'matrix' ? 'text-black' : 'text-amber-400/80'} />
            Matrix Branches ({matrixList.length})
          </button>

          {canViewBizDeptTabs && (
            <>
              <button
                onClick={() => setActiveTab('businesses')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 whitespace-nowrap transition cursor-pointer tracking-wide ${
                  activeTab === 'businesses' 
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black border border-amber-400 shadow-[0_0_15px_rgba(212,175,55,0.25)]' 
                    : 'text-neutral-400 hover:text-amber-200 hover:bg-[#141518]'
                }`}
              >
                <Building2 size={14} className={activeTab === 'businesses' ? 'text-black' : 'text-amber-400/80'} />
                Businesses ({businesses.length})
              </button>
              <button
                onClick={() => setActiveTab('departments')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 whitespace-nowrap transition cursor-pointer tracking-wide ${
                  activeTab === 'departments' 
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black border border-amber-400 shadow-[0_0_15px_rgba(212,175,55,0.25)]' 
                    : 'text-neutral-400 hover:text-amber-200 hover:bg-[#141518]'
                }`}
              >
                <FolderTree size={14} className={activeTab === 'departments' ? 'text-black' : 'text-amber-400/80'} />
                Departments ({departments.length})
              </button>
            </>
          )}
        </div>

        {/* Action Button: Entity creation */}
        <div className="pb-3 md:pb-3">
          {activeTab === 'matrix' && canCreateMatrix && (
            <button
              onClick={handleOpenCreateMatrix}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(212,175,55,0.25)] transition cursor-pointer"
            >
              <Plus size={15} />
              Add Matrix Branch
            </button>
          )}
          {activeTab === 'businesses' && isAdminOrSuper && (
            <button
              onClick={handleOpenCreateBiz}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(212,175,55,0.25)] transition cursor-pointer"
            >
              <Plus size={15} />
              Add Business
            </button>
          )}
          {activeTab === 'departments' && isAdminOrSuper && (
            <button
              onClick={handleOpenCreateDept}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(212,175,55,0.25)] transition cursor-pointer"
            >
              <Plus size={15} />
              Add Department
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Panels */}
      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="py-14 text-center text-amber-200/50 text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw size={22} className="animate-spin text-amber-400" />
            <span>Loading organizational records...</span>
          </div>
        ) : (
          <>
            {/* TAB 1: MATRIX BRANCHES */}
            {activeTab === 'matrix' && (
              <div className="space-y-4">
                {/* Search & Filter Toolbar */}
                <div className="bg-[#141518] p-3.5 rounded-2xl border border-amber-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2.5 flex-1">
                    <div className="relative min-w-[200px] flex-1 sm:flex-none">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400/60" />
                      <input
                        type="text"
                        placeholder="Search matrix, business, supervisor..."
                        value={matrixSearch}
                        onChange={(e) => setMatrixSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#0b0c0e] border border-amber-500/30 rounded-xl focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-white placeholder:text-neutral-600 outline-none transition"
                      />
                    </div>

                    <select
                      value={matrixBizFilter}
                      onChange={(e) => setMatrixBizFilter(e.target.value)}
                      className="border border-amber-500/30 rounded-xl px-2.5 py-1.5 bg-[#0b0c0e] font-medium text-amber-200 outline-none cursor-pointer"
                    >
                      <option value="ALL" className="bg-[#0b0c0e] text-neutral-200">All Businesses</option>
                      {businesses.map((b) => (
                        <option key={b.id} value={b.id} className="bg-[#0b0c0e] text-neutral-200">{b.name} ({b.code})</option>
                      ))}
                    </select>

                    <select
                      value={matrixDeptFilter}
                      onChange={(e) => setMatrixDeptFilter(e.target.value)}
                      className="border border-amber-500/30 rounded-xl px-2.5 py-1.5 bg-[#0b0c0e] font-medium text-amber-200 outline-none cursor-pointer"
                    >
                      <option value="ALL" className="bg-[#0b0c0e] text-neutral-200">All Departments</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id} className="bg-[#0b0c0e] text-neutral-200">{d.name}</option>
                      ))}
                    </select>

                    <select
                      value={matrixStatusFilter}
                      onChange={(e) => setMatrixStatusFilter(e.target.value)}
                      className="border border-amber-500/30 rounded-xl px-2.5 py-1.5 bg-[#0b0c0e] font-medium text-amber-200 outline-none cursor-pointer"
                    >
                      <option value="ALL" className="bg-[#0b0c0e] text-neutral-200">All Statuses</option>
                      <option value="ACTIVE" className="bg-[#0b0c0e] text-neutral-200">Active Only</option>
                      <option value="DISABLED" className="bg-[#0b0c0e] text-neutral-200">Disabled Only</option>
                    </select>

                    {(matrixSearch || matrixBizFilter !== 'ALL' || matrixDeptFilter !== 'ALL' || matrixStatusFilter !== 'ALL') && (
                      <button
                        onClick={() => {
                          setMatrixSearch('');
                          setMatrixBizFilter('ALL');
                          setMatrixDeptFilter('ALL');
                          setMatrixStatusFilter('ALL');
                        }}
                        className="text-xs text-amber-400 hover:text-white px-2 py-1 font-semibold cursor-pointer transition"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  <span className="text-amber-200/50 font-mono text-[11px]">
                    Showing {filteredMatrixList.length} of {matrixList.length} branches
                  </span>
                </div>

                {filteredMatrixList.length === 0 ? (
                  <div className="py-12 text-center text-neutral-500 text-xs border border-dashed border-amber-500/20 rounded-2xl">
                    No Matrix branches match the selected filters.
                  </div>
                ) : (
                  <>
                    {/* Desktop View Table */}
                    <div className="hidden md:block overflow-x-auto rounded-2xl border border-amber-500/20 shadow-xl">
                      <table className="w-full text-left text-xs text-neutral-300">
                        <thead className="bg-[#141518] text-amber-400/80 font-semibold border-b border-amber-500/15 text-[10px] uppercase tracking-wider">
                          <tr>
                            <th className="py-3.5 px-4">Matrix Branch</th>
                            <th className="py-3.5 px-4">Operating Business</th>
                            <th className="py-3.5 px-4">Functional Department</th>
                            <th className="py-3.5 px-4">Appointed Incharge</th>
                            <th className="py-3.5 px-4">Members</th>
                            <th className="py-3.5 px-4 text-center">Status</th>
                            <th className="py-3.5 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-medium">
                          {filteredMatrixList.map((m) => (
                            <tr key={m.id} className="hover:bg-amber-500/[0.03] transition duration-150">
                              <td className="py-3.5 px-4 font-bold text-white tracking-wide">
                                {m.title || `${m.business_code} - ${m.department_name}`}
                              </td>
                              <td className="py-3.5 px-4 text-neutral-200">{m.business_name}</td>
                              <td className="py-3.5 px-4 text-neutral-200">{m.department_name}</td>
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2">
                                  <span className={`font-semibold ${m.supervisor ? 'text-amber-300' : 'text-neutral-500 italic'}`}>
                                    {m.supervisor_name || 'Unassigned Lead'}
                                  </span>
                                  {canManageInchargeForMatrix(m) && (
                                    <button
                                      onClick={() => handleOpenAssignSupervisor(m)}
                                      className="text-[10px] text-amber-400 hover:text-white underline font-semibold cursor-pointer"
                                    >
                                      Change
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                <button
                                  onClick={() => handleOpenMembersModal(m)}
                                  className="inline-flex items-center gap-1.5 font-semibold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 px-3 py-1 rounded-full cursor-pointer transition border border-amber-500/35 shadow-[0_0_10px_rgba(245,158,11,0.1)]"
                                >
                                  <Users size={12} className="text-amber-400" />
                                  {m.assigned_members_count} members &bull; Manage
                                </button>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border tracking-wider uppercase ${
                                  m.is_active 
                                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.1)]' 
                                    : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                                }`}>
                                  {m.is_active ? 'Active' : 'Disabled'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {canCreateMatrix && (
                                    <button
                                      onClick={() => handleOpenEditMatrix(m)}
                                      className="p-1.5 text-neutral-400 hover:text-amber-300 hover:bg-amber-500/15 rounded-xl transition cursor-pointer"
                                      title="Edit Matrix Branch"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                  )}
                                  {isAdminOrSuper && (
                                    <>
                                      <button
                                        onClick={() => handleToggleMatrix(m)}
                                        className="p-1.5 text-neutral-400 hover:text-amber-300 hover:bg-amber-500/15 rounded-xl transition cursor-pointer"
                                        title={m.is_active ? 'Disable Branch (Must have 0 members)' : 'Enable Branch'}
                                      >
                                        {m.is_active ? (
                                          <ToggleRight size={20} className="text-amber-400" />
                                        ) : (
                                          <ToggleLeft size={20} className="text-neutral-500" />
                                        )}
                                      </button>
                                      <button
                                        onClick={() => handleDeleteMatrix(m)}
                                        className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
                                        title="Delete Matrix Branch (Must have 0 members)"
                                      >
                                        <Trash2 size={14} />
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

                    {/* Mobile Touch Card Stack (< md) */}
                    <div className="md:hidden space-y-3">
                      {filteredMatrixList.map((m) => (
                        <div key={m.id} className="p-4 rounded-2xl border border-amber-500/20 bg-[#141518] shadow-lg space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-white text-sm">{m.title || `${m.business_code} - ${m.department_name}`}</h4>
                              <p className="text-[11px] text-amber-200/50 mt-0.5">
                                {m.business_name} &bull; {m.department_name}
                              </p>
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border tracking-wider uppercase shrink-0 ${
                              m.is_active 
                                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30' 
                                : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                            }`}>
                              {m.is_active ? 'Active' : 'Disabled'}
                            </span>
                          </div>

                          <div className="bg-[#0b0c0e] p-3 rounded-xl border border-amber-500/15 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-400">Appointed Incharge:</span>
                              <div className="flex items-center gap-1.5">
                                <span className={`font-semibold ${m.supervisor ? 'text-amber-300' : 'text-neutral-500 italic'}`}>
                                  {m.supervisor_name || 'Unassigned'}
                                </span>
                                {canManageInchargeForMatrix(m) && (
                                  <button
                                    onClick={() => handleOpenAssignSupervisor(m)}
                                    className="text-[10px] text-amber-400 underline"
                                  >
                                    Edit
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <span className="text-neutral-400">Team Roster:</span>
                              <button
                                onClick={() => handleOpenMembersModal(m)}
                                className="inline-flex items-center gap-1 font-semibold text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded-lg border border-amber-400/30"
                              >
                                <Users size={11} className="text-amber-400" />
                                {m.assigned_members_count} members
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
                            {canCreateMatrix && (
                              <button
                                onClick={() => handleOpenEditMatrix(m)}
                                className="flex-1 py-1.5 bg-[#0b0c0e] border border-amber-500/30 text-amber-300 rounded-xl text-xs font-medium flex items-center justify-center gap-1"
                              >
                                <Edit2 size={12} /> Edit
                              </button>
                            )}
                            {isAdminOrSuper && (
                              <>
                                <button
                                  onClick={() => handleToggleMatrix(m)}
                                  className="flex-1 py-1.5 bg-[#0b0c0e] border border-amber-500/30 text-neutral-300 rounded-xl text-xs font-medium flex items-center justify-center gap-1"
                                >
                                  {m.is_active ? 'Disable' : 'Enable'}
                                </button>
                                <button
                                  onClick={() => handleDeleteMatrix(m)}
                                  className="p-1.5 bg-rose-950/30 border border-rose-500/40 text-rose-400 rounded-xl"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB 2: BUSINESSES */}
            {activeTab === 'businesses' && canViewBizDeptTabs && (
              <div className="space-y-4">
                {!isAdminOrSuper && (
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-amber-200 text-xs font-medium flex items-center gap-2">
                    <Building2 size={15} className="text-amber-400 shrink-0" />
                    <span>Business directory is in read-only mode. New businesses can only be added or modified by System Admins.</span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {businesses.map((biz) => (
                    <div key={biz.id} className="p-4 sm:p-5 rounded-2xl border border-amber-500/20 bg-[#141518] shadow-lg hover:border-amber-400/40 transition">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-amber-300 bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 rounded-full tracking-wider">
                            {biz.code}
                          </span>
                          <h3 className="font-bold text-white text-sm mt-2">{biz.name}</h3>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                          biz.is_active 
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30' 
                            : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                        }`}>
                          {biz.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </div>

                      <div className="mt-3 py-1.5 px-3 bg-[#0b0c0e] border border-amber-500/15 rounded-xl flex items-center justify-between">
                        <span className="text-[11px] text-neutral-400 font-medium">Business Incharge:</span>
                        <span className="text-[11px] font-bold text-amber-300">
                          {biz.incharge_name || 'Unassigned Lead'}
                        </span>
                      </div>

                      <p className="text-xs text-neutral-400 mt-2 line-clamp-2 leading-relaxed">
                        {biz.description || 'No description provided.'}
                      </p>

                      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-neutral-400">
                        <span className="font-mono">{biz.active_users_count || 0} Staff &bull; {biz.active_matrices_count || 0} Branches</span>
                        {isAdminOrSuper && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditBiz(biz)}
                              className="p-1.5 text-neutral-400 hover:text-amber-300 hover:bg-amber-500/15 rounded-lg cursor-pointer transition"
                              title="Edit Business"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleToggleBiz(biz)}
                              className="p-1.5 text-neutral-400 hover:text-amber-300 hover:bg-amber-500/15 rounded-lg cursor-pointer transition"
                              title={biz.is_active ? 'Disable Business' : 'Enable Business'}
                            >
                              {biz.is_active ? (
                                <ToggleRight size={18} className="text-amber-400" />
                              ) : (
                                <ToggleLeft size={18} className="text-neutral-500" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteBiz(biz)}
                              className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg cursor-pointer transition"
                              title="Delete Business"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: DEPARTMENTS */}
            {activeTab === 'departments' && canViewBizDeptTabs && (
              <div className="space-y-4">
                {!isAdminOrSuper && (
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-amber-200 text-xs font-medium flex items-center gap-2">
                    <FolderTree size={15} className="text-amber-400 shrink-0" />
                    <span>Department directory is in read-only mode. New departments can only be added or modified by System Admins.</span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {departments.map((dept) => (
                    <div key={dept.id} className="p-4 sm:p-5 rounded-2xl border border-amber-500/20 bg-[#141518] shadow-lg hover:border-amber-400/40 transition">
                      <div className="flex items-start justify-between">
                        <div>
                          {dept.code && (
                            <span className="text-[10px] font-bold uppercase text-amber-300 bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 rounded-full tracking-wider">
                              {dept.code}
                            </span>
                          )}
                          <h3 className="font-bold text-white text-sm mt-1">{dept.name}</h3>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                          dept.is_active 
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30' 
                            : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                        }`}>
                          {dept.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </div>

                      <div className="mt-3 py-1.5 px-3 bg-[#0b0c0e] border border-amber-500/15 rounded-xl flex items-center justify-between">
                        <span className="text-[11px] text-neutral-400 font-medium">Dept Incharge:</span>
                        <span className="text-[11px] font-bold text-amber-300">
                          {dept.incharge_name || 'Unassigned Lead'}
                        </span>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-neutral-400">
                        <span className="flex items-center gap-1 font-mono">
                          <Users size={12} className="text-amber-400/70" /> {dept.active_users_count || 0} Staff &bull; {dept.active_matrices_count || 0} Branches
                        </span>
                        {isAdminOrSuper && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditDept(dept)}
                              className="p-1.5 text-neutral-400 hover:text-amber-300 hover:bg-amber-500/15 rounded-lg cursor-pointer transition"
                              title="Edit Department"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleToggleDept(dept)}
                              className="p-1.5 text-neutral-400 hover:text-amber-300 hover:bg-amber-500/15 rounded-lg cursor-pointer transition"
                              title={dept.is_active ? 'Disable Department' : 'Enable Department'}
                            >
                              {dept.is_active ? (
                                <ToggleRight size={18} className="text-amber-400" />
                              ) : (
                                <ToggleLeft size={18} className="text-neutral-500" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteDept(dept)}
                              className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg cursor-pointer transition"
                              title="Delete Department"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL: ASSIGN INCHARGE (SUPERVISOR) */}
      {assigningMatrix && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#0b0c0e] rounded-t-3xl sm:rounded-3xl border border-amber-400/50 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
              <h3 className="font-bold text-white text-sm">Assign Matrix Incharge</h3>
              <button onClick={() => setAssigningMatrix(null)} className="text-neutral-400 hover:text-amber-300 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Select incharge for <strong className="text-amber-300">{assigningMatrix.business_code} - {assigningMatrix.department_name}</strong>. Candidate list is strictly filtered according to your role boundaries.
            </p>

            <select
              defaultValue={assigningMatrix.supervisor ? String(assigningMatrix.supervisor) : ''}
              id="supervisor-incharge-select"
              className="w-full text-xs bg-[#141518] border border-amber-500/30 rounded-xl p-2.5 font-medium text-amber-200 outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="" className="bg-[#0b0c0e] text-neutral-400">-- No Incharge (Unassigned) --</option>
              {matrixCandidateIncharges.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#0b0c0e] text-neutral-200">{c.name} ({c.role})</option>
              ))}
            </select>

            <div className="flex justify-end gap-2 pt-3 border-t border-amber-500/20">
              <button
                type="button"
                onClick={() => setAssigningMatrix(null)}
                className="px-3.5 py-1.5 text-xs text-neutral-300 hover:text-white rounded-xl border border-amber-500/30 font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const val = document.getElementById('supervisor-incharge-select').value;
                  handleAssignSupervisor(assigningMatrix.id, val);
                }}
                className="px-4 py-1.5 text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-xl shadow-[0_0_12px_rgba(212,175,55,0.25)] cursor-pointer"
              >
                Save Incharge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / REMOVE MEMBERS */}
      {memberManagingMatrix && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#0b0c0e] rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-xl w-full border border-amber-400/50 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 bg-[#141518] border-b border-amber-500/20 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm">Manage Branch Members</h3>
                <p className="text-[11px] text-amber-200/50 font-mono mt-0.5">
                  {memberManagingMatrix.business_code} - {memberManagingMatrix.department_name} &bull; Lead: {memberManagingMatrix.supervisor_name || 'Unassigned'}
                </p>
              </div>
              <button onClick={() => setMemberManagingMatrix(null)} className="text-neutral-400 hover:text-amber-300 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto text-xs [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex-1">
              <div className="space-y-2">
                <h4 className="font-bold text-amber-300 uppercase tracking-wider text-[11px]">
                  Current Members ({memberManagingMatrix.members?.length || memberManagingMatrix.assigned_members_count || 0})
                </h4>
                {memberManagingMatrix.members && memberManagingMatrix.members.length > 0 ? (
                  <div className="divide-y divide-white/5 border border-amber-500/20 rounded-2xl overflow-hidden bg-[#141518]">
                    {memberManagingMatrix.members.map((u) => (
                      <div key={u.id} className="p-3 flex items-center justify-between hover:bg-white/[0.02]">
                        <div>
                          <div className="font-semibold text-white">{u.name || u.username}</div>
                          <div className="text-[10px] text-neutral-400">{u.designation || 'Staff'} &bull; {u.employee_code}</div>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(u.id)}
                          className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 font-medium px-2.5 py-1 rounded-lg bg-rose-950/30 border border-rose-500/30 cursor-pointer transition"
                        >
                          <UserMinus size={13} /> Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-neutral-500 italic p-3 border border-dashed border-amber-500/20 rounded-xl text-center">
                    No base members mapped to this matrix.
                  </p>
                )}
              </div>

              <div className="space-y-2 pt-3 border-t border-amber-500/15">
                <h4 className="font-bold text-amber-300 uppercase tracking-wider text-[11px]">
                  Add Unassigned Employees to Branch
                </h4>
                {loadingCandidates ? (
                  <p className="text-amber-200/50 text-center py-4">Loading candidate employees...</p>
                ) : availableCandidates.length === 0 ? (
                  <p className="text-neutral-500 italic p-3 border border-dashed border-amber-500/20 rounded-xl text-center">
                    No unassigned employees available.
                  </p>
                ) : (
                  <div className="divide-y divide-white/5 border border-amber-500/20 rounded-2xl overflow-hidden max-h-48 overflow-y-auto bg-[#141518]">
                    {availableCandidates.map((u) => (
                      <div key={u.id} className="p-3 flex items-center justify-between hover:bg-white/[0.02]">
                        <div>
                          <div className="font-semibold text-white">{u.name}</div>
                          <div className="text-[10px] text-neutral-400">{u.designation} &bull; @{u.username}</div>
                        </div>
                        <button
                          onClick={() => handleAddMember(u.id)}
                          className="flex items-center gap-1 text-[11px] text-amber-300 font-semibold px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/30 hover:bg-amber-500/25 cursor-pointer transition"
                        >
                          <UserPlus size={13} /> Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3.5 bg-[#141518] border-t border-amber-500/20 flex justify-end">
              <button
                onClick={() => setMemberManagingMatrix(null)}
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs rounded-xl font-semibold cursor-pointer shadow-[0_0_12px_rgba(212,175,55,0.25)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT MATRIX BRANCH */}
      {showMatrixModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#0b0c0e] rounded-t-3xl sm:rounded-3xl border border-amber-400/50 shadow-2xl max-w-md w-full p-5 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
              <h3 className="font-bold text-white text-base">
                {editingMatrix ? 'Edit Matrix Branch' : 'Create New Matrix Branch'}
              </h3>
              <button onClick={() => setShowMatrixModal(false)} className="text-neutral-400 hover:text-amber-300 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveMatrix} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-amber-300/90 mb-1">Select Business</label>
                {isBusinessAdmin ? (
                  <div className="w-full px-3 py-2 text-xs border border-amber-500/20 bg-[#141518] rounded-xl font-bold text-amber-200">
                    {currentUser?.business_name || 'My Business'} (Locked)
                  </div>
                ) : (
                  <select
                    required
                    value={matrixForm.business}
                    onChange={(e) => handleMatrixBusinessChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#141518] border border-amber-500/30 rounded-xl focus:border-amber-400 text-white font-medium outline-none cursor-pointer"
                  >
                    <option value="" className="bg-[#0b0c0e] text-neutral-400">-- Choose Business --</option>
                    {businesses.filter((b) => b.is_active).map((b) => (
                      <option key={b.id} value={b.id} className="bg-[#0b0c0e] text-neutral-200">{b.name} ({b.code})</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-300/90 mb-1">Select Department</label>
                {isDeptHead ? (
                  <div className="w-full px-3 py-2 text-xs border border-amber-500/20 bg-[#141518] rounded-xl font-bold text-amber-200">
                    {currentUser?.department_name || 'My Department'} (Locked)
                  </div>
                ) : (
                  <select
                    required
                    value={matrixForm.department}
                    onChange={(e) => handleMatrixDepartmentChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#141518] border border-amber-500/30 rounded-xl focus:border-amber-400 text-white font-medium outline-none cursor-pointer"
                  >
                    <option value="" className="bg-[#0b0c0e] text-neutral-400">-- Choose Department --</option>
                    {departments.filter((d) => d.is_active).map((d) => (
                      <option key={d.id} value={d.id} className="bg-[#0b0c0e] text-neutral-200">{d.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-300/90 mb-1">Appoint Incharge (Optional)</label>
                <select
                  value={matrixForm.supervisor}
                  onChange={(e) => setMatrixForm({ ...matrixForm, supervisor: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-[#141518] border border-amber-500/30 rounded-xl focus:border-amber-400 text-amber-200 font-medium outline-none cursor-pointer"
                >
                  <option value="" className="bg-[#0b0c0e] text-neutral-400">-- Unassigned (Assign Later) --</option>
                  {matrixCandidateIncharges.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#0b0c0e] text-neutral-200">{c.name} ({c.role})</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-amber-500/20">
                <button
                  type="button"
                  onClick={() => setShowMatrixModal(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-neutral-300 hover:text-white rounded-xl border border-amber-500/30 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-xl shadow-[0_0_12px_rgba(212,175,55,0.25)] cursor-pointer"
                >
                  {editingMatrix ? 'Save Changes' : 'Create Matrix Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT BUSINESS (ADMIN & SUPER ADMIN ONLY) */}
      {showBizModal && isAdminOrSuper && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#0b0c0e] rounded-t-3xl sm:rounded-3xl border border-amber-400/50 shadow-2xl max-w-md w-full p-5 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
              <h3 className="font-bold text-white text-base">
                {editingBiz ? 'Edit Business Details' : 'Add New Business'}
              </h3>
              <button onClick={() => setShowBizModal(false)} className="text-neutral-400 hover:text-amber-300 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveBiz} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-amber-300/90 mb-1">Business Name</label>
                <input
                  type="text"
                  required
                  value={bizForm.name}
                  onChange={(e) => setBizForm({ ...bizForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-[#141518] border border-amber-500/30 rounded-xl focus:border-amber-400 text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-amber-300/90 mb-1">
                  Business Code {editingBiz && <span className="text-[10px] text-neutral-400 font-normal">(Immutable)</span>}
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingBiz)}
                  value={bizForm.code}
                  onChange={(e) => setBizForm({ ...bizForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 text-xs bg-[#141518] border border-amber-500/30 rounded-xl font-mono uppercase text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-300/90 mb-1">
                  Business Admin Incharge (Optional)
                </label>
                <select
                  value={bizForm.incharge_id}
                  onChange={(e) => setBizForm({ ...bizForm, incharge_id: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-[#141518] border border-amber-500/30 rounded-xl focus:border-amber-400 text-amber-200 font-medium outline-none cursor-pointer"
                >
                  <option value="" className="bg-[#0b0c0e] text-neutral-400">-- Default to Creator ({currentUser?.username}) --</option>
                  {bizCandidateIncharges.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#0b0c0e] text-neutral-200">{c.name} ({c.role})</option>
                  ))}
                </select>
                <span className="text-[10px] text-amber-200/50 block mt-1">
                  1-to-1 constraint enforced: Only unassigned Business Admins and Admins appear.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-300/90 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={bizForm.description}
                  onChange={(e) => setBizForm({ ...bizForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-[#141518] border border-amber-500/30 rounded-xl focus:border-amber-400 text-white outline-none"
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-3 border-t border-amber-500/20">
                <button 
                  type="button" 
                  onClick={() => setShowBizModal(false)} 
                  className="px-3.5 py-1.5 text-xs text-neutral-300 hover:text-white rounded-xl border border-amber-500/30 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-1.5 text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-xl shadow-[0_0_12px_rgba(212,175,55,0.25)] cursor-pointer"
                >
                  {editingBiz ? 'Update Business' : 'Save Business'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT DEPARTMENT (ADMIN & SUPER ADMIN ONLY) */}
      {showDeptModal && isAdminOrSuper && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#0b0c0e] rounded-t-3xl sm:rounded-3xl border border-amber-400/50 shadow-2xl max-w-md w-full p-5 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
              <h3 className="font-bold text-white text-base">
                {editingDept ? 'Edit Department Details' : 'Add New Department'}
              </h3>
              <button onClick={() => setShowDeptModal(false)} className="text-neutral-400 hover:text-amber-300 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveDept} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-amber-300/90 mb-1">Department Name</label>
                <input
                  type="text"
                  required
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-[#141518] border border-amber-500/30 rounded-xl focus:border-amber-400 text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-amber-300/90 mb-1">
                  Department Code {editingDept && <span className="text-[10px] text-neutral-400 font-normal">(Immutable)</span>}
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingDept)}
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 text-xs bg-[#141518] border border-amber-500/30 rounded-xl font-mono uppercase text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-300/90 mb-1">
                  Department Head Incharge (Optional)
                </label>
                <select
                  value={deptForm.incharge_id}
                  onChange={(e) => setDeptForm({ ...deptForm, incharge_id: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-[#141518] border border-amber-500/30 rounded-xl focus:border-amber-400 text-amber-200 font-medium outline-none cursor-pointer"
                >
                  <option value="" className="bg-[#0b0c0e] text-neutral-400">-- Default to Creator ({currentUser?.username}) --</option>
                  {deptCandidateIncharges.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#0b0c0e] text-neutral-200">{c.name} ({c.role})</option>
                  ))}
                </select>
                <span className="text-[10px] text-amber-200/50 block mt-1">
                  1-to-1 constraint enforced: Only unassigned Department Heads and Admins appear.
                </span>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-amber-500/20">
                <button 
                  type="button" 
                  onClick={() => setShowDeptModal(false)} 
                  className="px-3.5 py-1.5 text-xs text-neutral-300 hover:text-white rounded-xl border border-amber-500/30 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-1.5 text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-xl shadow-[0_0_12px_rgba(212,175,55,0.25)] cursor-pointer"
                >
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