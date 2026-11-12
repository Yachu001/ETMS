// frontend/src/components/CreateTaskModal.jsx

import { useState, useEffect } from 'react';
import { X, PlusCircle, AlertCircle, ShieldCheck, User } from 'lucide-react';
import api from '../api/axios';

export default function CreateTaskModal({ 
  isOpen, 
  onClose, 
  onTaskCreated, 
  currentUser,
  defaultAssignedToUserId = null 
}) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    assigned_to: '',
    due_date: '',
    requires_verification: true
  });

  const [assigneeOptions, setAssigneeOptions] = useState([]);
  const [loadingAssignees, setLoadingAssignees] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isEmployee = currentUser?.role === 'EMPLOYEE';

  useEffect(() => {
    if (isOpen) {
      setError(null);
      
      const initialAssignee = isEmployee 
        ? currentUser.id 
        : (defaultAssignedToUserId ? String(defaultAssignedToUserId) : '');

      setFormData({
        title: '',
        description: '',
        priority: 'MEDIUM',
        assigned_to: initialAssignee,
        due_date: '',
        requires_verification: true
      });

      // Load permitted assignees based on role scope
      if (!isEmployee) {
        setLoadingAssignees(true);
        api.get('/auth/employees/manage/')
          .then((res) => {
            const list = res.data || [];
            const exists = list.some(u => u.id === currentUser.id);
            if (!exists) {
              list.unshift({
                id: currentUser.id,
                username: currentUser.username,
                full_name: currentUser.full_name || currentUser.username,
                role: currentUser.role
              });
            }
            setAssigneeOptions(list);
          })
          .catch((err) => {
            console.error('Failed to load assignees:', err);
            setAssigneeOptions([{
              id: currentUser.id,
              username: currentUser.username,
              full_name: currentUser.full_name || currentUser.username,
              role: currentUser.role
            }]);
          })
          .finally(() => setLoadingAssignees(false));
      }
    }
  }, [isOpen, currentUser, isEmployee, defaultAssignedToUserId]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      priority: formData.priority,
      assigned_to: isEmployee ? currentUser.id : Number(formData.assigned_to),
      due_date: formData.due_date || null,
      requires_verification: Boolean(formData.requires_verification)
    };

    if (!payload.assigned_to) {
      setError('Please select an assignee.');
      setSubmitting(false);
      return;
    }

    try {
      await api.post('/tasks/', payload);
      if (onTaskCreated) onTaskCreated();
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail 
        || JSON.stringify(err.response?.data) 
        || 'Failed to create task.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4 transition-all">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-[0_24px_50px_rgba(15,23,42,0.16)] border border-slate-200/90 max-h-[92vh] overflow-y-auto text-slate-800 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-3.5 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-600 flex items-center justify-center shadow-2xs">
              <PlusCircle size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-wide">Create New Task</h3>
              <p className="text-[11px] text-slate-500 font-medium">Assign operational task or daily assignment</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1.5 text-[11px] uppercase tracking-wider">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Prepare monthly financial reconciliation report"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none bg-slate-50/70 focus:bg-white text-slate-900 placeholder-slate-400 transition"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1.5 text-[11px] uppercase tracking-wider">
              Description & Specific Instructions
            </label>
            <textarea
              rows="3"
              placeholder="Include specs, deliverables, or reference links..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none bg-slate-50/70 focus:bg-white text-slate-900 placeholder-slate-400 transition leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5 text-[11px] uppercase tracking-wider">
                Priority Tier
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none bg-slate-50/70 focus:bg-white text-slate-800 font-semibold cursor-pointer"
              >
                <option value="LOW">Low Priority</option>
                <option value="MEDIUM">Medium Priority</option>
                <option value="HIGH">High Priority</option>
                <option value="URGENT">Urgent (Top Priority)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5 text-[11px] uppercase tracking-wider">
                Due Date (Deadline)
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none bg-slate-50/70 focus:bg-white text-slate-800 font-mono cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1.5 text-[11px] uppercase tracking-wider">
              Assignee <span className="text-rose-500">*</span>
            </label>
            {isEmployee ? (
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 font-semibold flex items-center gap-2">
                <User size={14} className="text-blue-600" />
                <span>{currentUser.full_name || currentUser.username}</span>
                <span className="text-[10px] text-blue-700 font-mono font-bold uppercase bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 ml-auto">
                  Self Assignment
                </span>
              </div>
            ) : (
              <select
                required
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none bg-slate-50/70 focus:bg-white text-slate-800 font-semibold cursor-pointer"
              >
                <option value="">
                  {loadingAssignees ? '-- Loading team members... --' : '-- Choose Team Member --'}
                </option>
                {assigneeOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.username} ({u.role || 'Staff'}) {u.id === currentUser.id ? '— Self' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="p-3.5 bg-blue-50/50 rounded-2xl border border-blue-200/80 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="verification-checkbox"
              checked={formData.requires_verification}
              onChange={(e) => setFormData({ ...formData, requires_verification: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded accent-blue-600 cursor-pointer"
            />
            <label htmlFor="verification-checkbox" className="cursor-pointer text-slate-700 font-semibold">
              <span className="flex items-center gap-1.5 text-slate-900">
                <ShieldCheck size={14} className="text-blue-600" />
                Require Management Verification on Completion
              </span>
              <span className="block text-[11px] text-slate-500 font-normal mt-0.5 leading-relaxed">
                When checked, reaching 100% moves the task to <strong className="text-blue-700">AWAITING_VERIFICATION</strong> for review before closing.
              </span>
            </label>
          </div>

          {/* Action Footer */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold rounded-xl text-xs transition shadow-[0_4px_14px_rgba(37,99,235,0.28)] hover:shadow-[0_6px_18px_rgba(37,99,235,0.38)] disabled:opacity-50 cursor-pointer text-center"
            >
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}