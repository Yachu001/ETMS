import  { useState, useEffect } from 'react';
import { X, PlusCircle, AlertCircle } from 'lucide-react';
import api from '../api/axios';

export default function CreateTaskModal({ isOpen, onClose, onTaskCreated, currentUser }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    assigned_to: '',
    due_date: '',
    requires_verification: false
  });

  const [assigneeOptions, setAssigneeOptions] = useState([]);
  const [loadingAssignees, setLoadingAssignees] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isEmployee = currentUser?.role === 'EMPLOYEE';

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setFormData({
        title: '',
        description: '',
        priority: 'MEDIUM',
        assigned_to: isEmployee ? currentUser.id : '',
        due_date: '',
        requires_verification: false
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
  }, [isOpen, currentUser, isEmployee]);

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-slate-100 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <PlusCircle size={18} className="text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">Create New Task</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
            <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Prepare monthly financial reconciliation report"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-hidden bg-slate-50/40"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Description & Specific Instructions
            </label>
            <textarea
              rows="3"
              placeholder="Include specs, deliverables, or reference links..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-hidden bg-slate-50/40"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Priority Tier</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-hidden font-medium"
              >
                <option value="LOW">Low Priority</option>
                <option value="MEDIUM">Medium Priority</option>
                <option value="HIGH">High Priority</option>
                <option value="URGENT">Urgent (Top Priority)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Due Date (Deadline)</label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Assignee <span className="text-rose-500">*</span>
            </label>
            {isEmployee ? (
              <div className="p-2.5 bg-slate-100 rounded-lg text-slate-600 font-medium">
                {currentUser.full_name || currentUser.username} (Self Assignment)
              </div>
            ) : (
              <select
                required
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-hidden font-medium"
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

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="verification-checkbox"
              checked={formData.requires_verification}
              onChange={(e) => setFormData({ ...formData, requires_verification: e.target.checked })}
              className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="verification-checkbox" className="cursor-pointer text-slate-700 font-medium">
              Require Management Verification on Completion
              <span className="block text-[11px] text-slate-400 font-normal mt-0.5">
                When checked, reaching 100% moves the task to <strong>AWAITING_VERIFICATION</strong> for review before closing.
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}