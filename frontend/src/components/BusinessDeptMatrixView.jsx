import  { useState, useEffect } from 'react';
import { 
  Building2, 
  FolderTree, 
  Layers, 
  Plus, 
  ToggleLeft, 
  ToggleRight,  
  AlertCircle, 
  CheckCircle2, 
  X,
  Users,
} from 'lucide-react';
import api from '../api/axios';

export default function BusinessDeptMatrixView({ userRole, onClose }) {
  const [activeTab, setActiveTab] = useState('matrix');
  const [businesses, setBusinesses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [matrixList, setMatrixList] = useState([]);
  const [candidateSupervisors, setCandidateSupervisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals state
  const [showBizModal, setShowBizModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [assigningMatrix, setAssigningMatrix] = useState(null);

  // Form states
  const [bizForm, setBizForm] = useState({ name: '', code: '', description: '' });
  const [deptForm, setDeptForm] = useState({ name: '', parent: '' });
  const [matrixForm, setMatrixForm] = useState({ business: '', department: '', supervisor: '' });

  const isAdminOrSuper = ['SUPER_ADMIN', 'ADMIN'].includes(userRole);

  const fetchData = async () => {
    setLoading(true);
    setActionError('');
    try {
      const [bizRes, deptRes, matrixRes, supRes] = await Promise.all([
        api.get('/auth/businesses/'),
        api.get('/auth/departments/matrix/'), // <-- Add /matrix/
        api.get('/auth/business-departments/'),
        api.get('/auth/business-departments/candidate-supervisors/')
      ]);
      
      setBusinesses(bizRes.data);
      setDepartments(deptRes.data);
      setMatrixList(matrixRes.data);
      setCandidateSupervisors(supRes.data);
    } catch (err) {
      console.error('Failed to load matrix records:', err);
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

  const handleToggleMatrix = async (id) => {
    try {
      await api.patch(`/auth/business-departments/${id}/`, { is_active: !matrixList.find(m => m.id === id)?.is_active });
      triggerSuccess('Matrix branch status updated.');
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Failed to toggle matrix branch status.');
    }
  };

  const handleAssignSupervisor = async (matrixId, supervisorId) => {
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

  const handleCreateMatrix = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...matrixForm };
      if (!payload.supervisor) delete payload.supervisor;
      await api.post('/auth/business-departments/', payload);
      setMatrixForm({ business: '', department: '', supervisor: '' });
      setShowMatrixModal(false);
      triggerSuccess('Business-Department Matrix branch created.');
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.non_field_errors?.[0] || err.response?.data?.detail || 'Error linking entities.');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            Organization & Matrix Management
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Configure cross-matrix branches (Business + Department) and appoint designated Incharges.
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

      {/* Tabs */}
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
            Matrix Branches ({matrixList.length})
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

        {isAdminOrSuper && (
          <div className="pb-3 md:pb-0">
            {activeTab === 'matrix' && (
              <button
                onClick={() => setShowMatrixModal(true)}
                className="w-full sm:w-auto px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Matrix Branch
              </button>
            )}
            {activeTab === 'businesses' && (
              <button
                onClick={() => setShowBizModal(true)}
                className="w-full sm:w-auto px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Business
              </button>
            )}
            {activeTab === 'departments' && (
              <button
                onClick={() => setShowDeptModal(true)}
                className="w-full sm:w-auto px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
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
          <div className="py-12 text-center text-slate-400 text-sm">Loading organizational records...</div>
        ) : (
          <>
            {activeTab === 'matrix' && (
              <div>
                {matrixList.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                    No Matrix branches created yet.
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
                                {isAdminOrSuper && (
                                  <button
                                    onClick={() => setAssigningMatrix(m)}
                                    className="text-[10px] text-blue-600 hover:underline font-semibold"
                                  >
                                    Change
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                                <Users className="w-3.5 h-3.5" />
                                {m.assigned_members_count} members
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${
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
                                  title={m.is_active ? 'Disable Branch' : 'Enable Branch'}
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
                )}
              </div>
            )}

            {/* TAB 2: BUSINESSES */}
            {activeTab === 'businesses' && (
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
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                      {biz.description || 'No description provided.'}
                    </p>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                      <span>{biz.total_members} Staff</span>
                      <span>{biz.active_departments_count} Branches</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 3: DEPARTMENTS */}
            {activeTab === 'departments' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {departments.map((dept) => (
                  <div key={dept.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:shadow-xs transition">
                    <div className="flex items-start justify-between">
                      <div>
                        {dept.parent_name && (
                          <span className="text-[10px] text-slate-400 font-medium block">
                            Parent: {dept.parent_name}
                          </span>
                        )}
                        <h3 className="font-bold text-slate-900 text-sm">{dept.name}</h3>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        dept.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {dept.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" /> {dept.total_members} Members
                      </span>
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
              <button onClick={() => setAssigningMatrix(null)} className="text-slate-400 hover:text-slate-600">
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
              {candidateSupervisors.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
              ))}
            </select>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAssigningMatrix(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const val = document.getElementById('supervisor-incharge-select').value;
                  handleAssignSupervisor(assigningMatrix.id, val);
                }}
                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              >
                Save Incharge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD MATRIX BRANCH */}
      {showMatrixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Create New Matrix Branch</h3>
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
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
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
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
                >
                  <option value="">-- Choose Department --</option>
                  {departments.filter((d) => d.is_active).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Appoint Incharge Supervisor (Optional)</label>
                <select
                  value={matrixForm.supervisor}
                  onChange={(e) => setMatrixForm({ ...matrixForm, supervisor: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
                >
                  <option value="">-- Unassigned (Assign Later) --</option>
                  {candidateSupervisors.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMatrixModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer"
                >
                  Create Matrix Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}