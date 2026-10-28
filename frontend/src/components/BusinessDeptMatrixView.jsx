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
  Users
} from 'lucide-react';
import api from '../api/axios';

export default function BusinessDeptMatrixView({ userRole, onClose }) {
  const [activeTab, setActiveTab] = useState('matrix'); // 'matrix' | 'businesses' | 'departments'
  const [businesses, setBusinesses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [matrixList, setMatrixList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals state
  const [showBizModal, setShowBizModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showMatrixModal, setShowMatrixModal] = useState(false);

  // Form states
  const [bizForm, setBizForm] = useState({ name: '', code: '', description: '' });
  const [deptForm, setDeptForm] = useState({ name: '', parent: '' });
  const [matrixForm, setMatrixForm] = useState({ business: '', department: '' });

  const isAdminOrSuper = ['SUPER_ADMIN', 'ADMIN'].includes(userRole);

  const fetchData = async () => {
    setLoading(true);
    setActionError('');
    try {
      const [bizRes, deptRes, matrixRes] = await Promise.all([
        api.get('/auth/businesses/'),
        api.get('/auth/departments/matrix/'),
        api.get('/auth/business-departments/')
      ]);
      setBusinesses(bizRes.data);
      setDepartments(deptRes.data);
      setMatrixList(matrixRes.data);
    } catch (err) {
      console.error('Failed to load matrix data:', err);
      setActionError(err.response?.data?.detail || 'Failed to load organization records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const triggerSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Toggle handlers
  const handleToggleBiz = async (id) => {
    try {
      const res = await api.post(`/auth/businesses/${id}/toggle-active/`);
      triggerSuccess(res.data.message || 'Status updated.');
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Failed to toggle business status.');
    }
  };

  const handleToggleDept = async (id) => {
    try {
      const res = await api.post(`/auth/departments/matrix/${id}/toggle-active/`);
      triggerSuccess(res.data.message || 'Status updated.');
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Failed to toggle department status.');
    }
  };

  const handleToggleMatrix = async (id) => {
    try {
      await api.post(`/auth/business-departments/${id}/toggle-active/`);
      triggerSuccess('Matrix link status updated.');
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Failed to toggle matrix link status.');
    }
  };

  // Deletion handlers with error guard display
  const handleDeleteBiz = async (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete Business "${name}"?`)) return;
    try {
      await api.delete(`/auth/businesses/${id}/`);
      triggerSuccess(`Business "${name}" removed.`);
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Cannot delete this business.');
    }
  };

  const handleDeleteDept = async (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete Department "${name}"?`)) return;
    try {
      await api.delete(`/auth/departments/matrix/${id}/`);
      triggerSuccess(`Department "${name}" removed.`);
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Cannot delete this department.');
    }
  };

  // Create handlers
  const handleCreateBiz = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/businesses/', bizForm);
      setBizForm({ name: '', code: '', description: '' });
      setShowBizModal(false);
      triggerSuccess('Business created successfully.');
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.name?.[0] || err.response?.data?.code?.[0] || 'Error creating business.');
    }
  };

  const handleCreateDept = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...deptForm };
      if (!payload.parent) delete payload.parent;
      await api.post('/auth/departments/matrix/', payload);
      setDeptForm({ name: '', parent: '' });
      setShowDeptModal(false);
      triggerSuccess('Department created successfully.');
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.name?.[0] || 'Error creating department.');
    }
  };

  const handleCreateMatrix = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/business-departments/', matrixForm);
      setMatrixForm({ business: '', department: '' });
      setShowMatrixModal(false);
      triggerSuccess('Business-Department link created.');
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.non_field_errors?.[0] || err.response?.data?.detail || 'Error linking entities.');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* View Header */}
      <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            Organization & Matrix Management
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Configure businesses, operational departments, and cross-functional matrix links.
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="self-end sm:self-auto p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Notifications */}
      {actionError && (
        <div className="m-4 sm:m-6 p-3 sm:p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3 text-rose-700 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" />
          <div className="flex-1">{actionError}</div>
          <button onClick={() => setActionError('')} className="text-rose-400 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="m-4 sm:m-6 p-3 sm:p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3 text-emerald-700 text-xs sm:text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500 mt-0.5" />
          <div className="flex-1">{successMsg}</div>
        </div>
      )}

      {/* Responsive Navigation Tabs & Action Triggers */}
      <div className="px-4 sm:px-6 pt-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap transition ${
              activeTab === 'matrix'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            Cross Matrix ({matrixList.length})
          </button>
          <button
            onClick={() => setActiveTab('businesses')}
            className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap transition ${
              activeTab === 'businesses'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Businesses ({businesses.length})
          </button>
          <button
            onClick={() => setActiveTab('departments')}
            className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap transition ${
              activeTab === 'departments'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            Departments ({departments.length})
          </button>
        </div>

        {/* Action Button based on tab */}
        {isAdminOrSuper && (
          <div className="pb-3 md:pb-0">
            {activeTab === 'matrix' && (
              <button
                onClick={() => setShowMatrixModal(true)}
                className="w-full sm:w-auto px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                Map Business to Dept
              </button>
            )}
            {activeTab === 'businesses' && (
              <button
                onClick={() => setShowBizModal(true)}
                className="w-full sm:w-auto px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                Add Business
              </button>
            )}
            {activeTab === 'departments' && (
              <button
                onClick={() => setShowDeptModal(true)}
                className="w-full sm:w-auto px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                Add Department
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Tab Panels */}
      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Loading organizational matrix...</div>
        ) : (
          <>
            {/* TAB 1: CROSS MATRIX */}
            {activeTab === 'matrix' && (
              <div>
                {matrixList.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                    No Business-Department links mapped yet.
                  </div>
                ) : (
                  <>
                    {/* Desktop View Table */}
                    <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">Business</th>
                            <th className="py-3 px-4">Department</th>
                            <th className="py-3 px-4">Assigned Members</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {matrixList.map((m) => (
                            <tr key={m.id} className="hover:bg-slate-50/70">
                              <td className="py-3 px-4 font-semibold text-slate-900">
                                {m.business_name} <span className="text-xs text-slate-400">({m.business_code})</span>
                              </td>
                              <td className="py-3 px-4 text-slate-800">{m.department_name}</td>
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                                  <Users className="w-3.5 h-3.5" />
                                  {m.assigned_members_count} active
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                  m.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {m.is_active ? 'Active' : 'Disabled'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                {isAdminOrSuper && (
                                  <button
                                    onClick={() => handleToggleMatrix(m.id)}
                                    className="p-1 text-slate-500 hover:text-indigo-600 rounded transition"
                                    title={m.is_active ? 'Disable Link' : 'Enable Link'}
                                  >
                                    {m.is_active ? (
                                      <ToggleRight className="w-6 h-6 text-emerald-600" />
                                    ) : (
                                      <ToggleLeft className="w-6 h-6 text-slate-400" />
                                    )}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card Stack */}
                    <div className="grid grid-cols-1 gap-3 md:hidden">
                      {matrixList.map((m) => (
                        <div key={m.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-bold text-slate-800 text-sm">{m.business_name}</h3>
                              <p className="text-xs text-indigo-600 font-medium">{m.department_name}</p>
                            </div>
                            <span className={`text-2xs font-bold px-2 py-0.5 rounded-full ${
                              m.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {m.is_active ? 'Active' : 'Disabled'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                            <span className="text-slate-500 flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" /> {m.assigned_members_count} members
                            </span>
                            {isAdminOrSuper && (
                              <button
                                onClick={() => handleToggleMatrix(m.id)}
                                className="font-semibold text-xs text-indigo-600"
                              >
                                {m.is_active ? 'Disable' : 'Enable'}
                              </button>
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
            {activeTab === 'businesses' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {businesses.map((biz) => (
                    <div key={biz.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:shadow-xs transition">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-2xs font-bold tracking-wider uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                            {biz.code}
                          </span>
                          <h3 className="font-bold text-slate-900 text-base mt-2">{biz.name}</h3>
                        </div>
                        <span className={`text-2xs font-bold px-2 py-0.5 rounded-full ${
                          biz.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {biz.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                        {biz.description || 'No description provided.'}
                      </p>
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                        <span>{biz.total_members} Staff</span>
                        <span>{biz.active_departments_count} Depts</span>
                        {isAdminOrSuper && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggleBiz(biz.id)}
                              className="p-1 hover:text-indigo-600"
                              title={biz.is_active ? 'Disable' : 'Enable'}
                            >
                              {biz.is_active ? (
                                <ToggleRight className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <ToggleLeft className="w-5 h-5 text-slate-400" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteBiz(biz.id, biz.name)}
                              className="p-1 text-slate-400 hover:text-rose-600"
                              title="Delete Business"
                            >
                              <Trash2 className="w-4 h-4" />
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
            {activeTab === 'departments' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {departments.map((dept) => (
                    <div key={dept.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:shadow-xs transition">
                      <div className="flex items-start justify-between">
                        <div>
                          {dept.parent_name && (
                            <span className="text-2xs text-slate-400 font-medium block">
                              Parent: {dept.parent_name}
                            </span>
                          )}
                          <h3 className="font-bold text-slate-900 text-base">{dept.name}</h3>
                        </div>
                        <span className={`text-2xs font-bold px-2 py-0.5 rounded-full ${
                          dept.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {dept.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" /> {dept.total_members} Members
                        </span>
                        {isAdminOrSuper && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggleDept(dept.id)}
                              className="p-1 hover:text-indigo-600"
                              title={dept.is_active ? 'Disable' : 'Enable'}
                            >
                              {dept.is_active ? (
                                <ToggleRight className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <ToggleLeft className="w-5 h-5 text-slate-400" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteDept(dept.id, dept.name)}
                              className="p-1 text-slate-400 hover:text-rose-600"
                              title="Delete Department"
                            >
                              <Trash2 className="w-4 h-4" />
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

      {/* MODAL 1: ADD BUSINESS */}
      {showBizModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-xs p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Add New Business Entity</h3>
              <button onClick={() => setShowBizModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateBiz} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Business Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Tech Global"
                  value={bizForm.name}
                  onChange={(e) => setBizForm({ ...bizForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Code / Prefix</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. B1, ACME"
                  value={bizForm.code}
                  onChange={(e) => setBizForm({ ...bizForm, code: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Brief note on this business unit..."
                  value={bizForm.description}
                  onChange={(e) => setBizForm({ ...bizForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBizModal(false)}
                  className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                >
                  Save Business
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD DEPARTMENT */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-xs p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Add New Department</h3>
              <button onClick={() => setShowDeptModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateDept} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Performance Marketing"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Parent Department (Optional)</label>
                <select
                  value={deptForm.parent}
                  onChange={(e) => setDeptForm({ ...deptForm, parent: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value="">None (Top-Level Department)</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                >
                  Save Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: MAP CROSS-MATRIX LINK */}
      {showMatrixModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-xs p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Map Business to Department</h3>
              <button onClick={() => setShowMatrixModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateMatrix} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Business</label>
                <select
                  required
                  value={matrixForm.business}
                  onChange={(e) => setMatrixForm({ ...matrixForm, business: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value="">-- Choose Business --</option>
                  {businesses.filter((b) => b.is_active).map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Department</label>
                <select
                  required
                  value={matrixForm.department}
                  onChange={(e) => setMatrixForm({ ...matrixForm, department: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value="">-- Choose Department --</option>
                  {departments.filter((d) => d.is_active).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMatrixModal(false)}
                  className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                >
                  Create Matrix Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}