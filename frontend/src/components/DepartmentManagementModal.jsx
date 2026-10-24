import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Building, X, UserPlus, Check } from 'lucide-react';

export default function DepartmentManagementModal({ isOpen, onClose }) {
  const [departments, setDepartments] = useState([]);
  const [newDeptName, setNewDeptName] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchDepts = async () => {
    try {
      const res = await api.get('/auth/departments/manage/');
      setDepartments(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) fetchDepts();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateDept = async (e) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    setLoading(true);
    try {
      await api.post('/auth/departments/manage/', { name: newDeptName.trim() });
      setNewDeptName('');
      fetchDepts();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-5">
        
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Building className="text-blue-600" size={18} />
            <h3 className="font-bold text-slate-900 text-base">Department Management Console</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {/* Create New Dept */}
        <form onSubmit={handleCreateDept} className="flex gap-2">
          <input
            type="text"
            required
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            placeholder="New Department Name (e.g., Performance Marketing)"
            className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg font-medium shadow-xs"
          >
            {loading ? 'Creating...' : '+ Add Department'}
          </button>
        </form>

        {/* Catalog Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase">
              <tr>
                <th className="py-2.5 px-3">Department Name</th>
                <th className="py-2.5 px-3">Supervisor / Lead</th>
                <th className="py-2.5 px-3">Headcount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departments.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-900">{d.name}</td>
                  <td className="py-2.5 px-3 text-slate-600">{d.lead_name}</td>
                  <td className="py-2.5 px-3 font-semibold text-blue-600">{d.total_members} members</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="px-4 py-1.5 border border-slate-300 rounded-lg text-xs font-medium">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}