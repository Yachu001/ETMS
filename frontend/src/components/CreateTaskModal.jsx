// frontend/src/components/CreateTaskModal.jsx

import { useState, useEffect } from 'react';
import { X, PlusCircle, AlertCircle, Calendar, ShieldCheck, User } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 transition-all">
      <div className="bg-[#141518] rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_25px_rgba(245,158,11,0.12)] border border-amber-500/25 max-h-[92vh] overflow-y-auto text-neutral-200">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-3.5 border-b border-amber-500/20 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
              <PlusCircle size={18} className="text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">Create New Task</h3>
              <p className="text-[10px] text-amber-400/70 font-mono">Assign operational task or daily assignment</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-amber-300 rounded-lg transition border border-transparent hover:border-amber-500/20 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-4 p-3 bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-start gap-2 shadow-[0_0_10px_rgba(244,63,94,0.1)]">
            <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-amber-300 mb-1.5 text-[11px] uppercase tracking-wider font-mono">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Prepare monthly financial reconciliation report"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full text-xs border border-amber-500/20 rounded-xl p-2.5 focus:border-amber-400 outline-none bg-[#0b0c0e] text-white placeholder-neutral-500 transition"
            />
          </div>

          <div>
            <label className="block font-medium text-amber-300 mb-1.5 text-[11px] uppercase tracking-wider font-mono">
              Description & Specific Instructions
            </label>
            <textarea
              rows="3"
              placeholder="Include specs, deliverables, or reference links..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full text-xs border border-amber-500/20 rounded-xl p-2.5 focus:border-amber-400 outline-none bg-[#0b0c0e] text-white placeholder-neutral-500 transition leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-medium text-amber-300 mb-1.5 text-[11px] uppercase tracking-wider font-mono">
                Priority Tier
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full text-xs border border-amber-500/20 rounded-xl p-2.5 focus:border-amber-400 outline-none bg-[#0b0c0e] text-white font-medium cursor-pointer"
              >
                <option value="LOW" className="bg-[#141518] text-neutral-300">Low Priority</option>
                <option value="MEDIUM" className="bg-[#141518] text-amber-300">Medium Priority</option>
                <option value="HIGH" className="bg-[#141518] text-amber-400 font-semibold">High Priority</option>
                <option value="URGENT" className="bg-[#141518] text-rose-400 font-bold">Urgent (Top Priority)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-amber-300 mb-1.5 text-[11px] uppercase tracking-wider font-mono">
                Due Date (Deadline)
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full text-xs border border-amber-500/20 rounded-xl p-2.5 focus:border-amber-400 outline-none bg-[#0b0c0e] text-white font-mono cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-medium text-amber-300 mb-1.5 text-[11px] uppercase tracking-wider font-mono">
              Assignee <span className="text-rose-500">*</span>
            </label>
            {isEmployee ? (
              <div className="p-2.5 bg-[#0b0c0e] rounded-xl border border-amber-500/20 text-neutral-300 font-medium flex items-center gap-2">
                <User size={14} className="text-amber-400" />
                <span>{currentUser.full_name || currentUser.username}</span>
                <span className="text-[10px] text-amber-400/80 font-mono uppercase bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 ml-auto">
                  Self Assignment
                </span>
              </div>
            ) : (
              <select
                required
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                className="w-full text-xs border border-amber-500/20 rounded-xl p-2.5 focus:border-amber-400 outline-none bg-[#0b0c0e] text-white font-medium cursor-pointer"
              >
                <option value="" className="bg-[#141518] text-neutral-400">
                  {loadingAssignees ? '-- Loading team members... --' : '-- Choose Team Member --'}
                </option>
                {assigneeOptions.map((u) => (
                  <option key={u.id} value={u.id} className="bg-[#141518] text-white">
                    {u.full_name || u.username} ({u.role || 'Staff'}) {u.id === currentUser.id ? '— Self' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="p-3 bg-[#0b0c0e] rounded-xl border border-amber-500/20 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="verification-checkbox"
              checked={formData.requires_verification}
              onChange={(e) => setFormData({ ...formData, requires_verification: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded accent-amber-500 cursor-pointer"
            />
            <label htmlFor="verification-checkbox" className="cursor-pointer text-neutral-200 font-medium">
              <span className="flex items-center gap-1.5 text-white">
                <ShieldCheck size={14} className="text-amber-400" />
                Require Management Verification on Completion
              </span>
              <span className="block text-[11px] text-neutral-400 font-normal mt-0.5 leading-relaxed">
                When checked, reaching 100% moves the task to <strong className="text-amber-300">AWAITING_VERIFICATION</strong> for review before closing.
              </span>
            </label>
          </div>

          {/* Action Footer */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-amber-500/15">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 border border-amber-500/20 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-bold rounded-xl text-xs transition shadow-[0_0_15px_rgba(245,158,11,0.25)] disabled:opacity-50 cursor-pointer text-center"
            >
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}