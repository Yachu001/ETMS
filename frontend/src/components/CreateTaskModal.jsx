import React, { useState } from 'react';
import api from '../api/axios';
import SubordinateSelect from './SubordinateSelect';
import { X } from 'lucide-react';

export default function CreateTaskModal({ isOpen, onClose, onTaskCreated, currentUser }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [assignedTo, setAssignedTo] = useState(currentUser?.id || '');
  const [dueDate, setDueDate] = useState('');
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const isPrivileged = currentUser?.role === 'SUPERVISOR' || currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload = {
      title,
      description,
      priority,
      assigned_to: assignedTo || currentUser.id,
      due_date: dueDate || null,
      requires_verification: requiresVerification
    };

    try {
      const res = await api.post('/tasks/', payload);
      onTaskCreated(res.data);
      onClose();
      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setDueDate('');
    } catch (err) {
      const errData = err.response?.data;
      setError(
        errData?.assigned_to?.[0] ||
        errData?.detail ||
        'Failed to create task.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">Create New Task</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Task Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Audit Google Analytics 4 Events"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 bg-white"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800"
              />
            </div>
          </div>

          {isPrivileged && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Assignee</label>
              <SubordinateSelect
                value={assignedTo}
                onChange={(val) => setAssignedTo(val)}
                placeholder="Assign to myself or select reportee..."
              />
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description / Notes</label>
            <textarea
              rows="3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scope, key deliverables, and context..."
              className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="reqVerify"
              checked={requiresVerification}
              onChange={(e) => setRequiresVerification(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-0"
            />
            <label htmlFor="reqVerify" className="text-slate-700 font-medium cursor-pointer">
              Requires managerial sign-off & verification on completion
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-xs transition disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}