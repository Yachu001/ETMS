import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import TaskNoActionModal from './TaskNoActionModal';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  CalendarCheck,
  Lock,
} from 'lucide-react';

export default function TodaysCommitmentsTable({
  commitments = [],
  onOpenActionModal,
  onRefresh,
  currentUser,
}) {
  const [uncheckingId, setUncheckingId] = useState(null);

  // Sequential shift-end modal queue
  const [inactiveTaskQueue, setInactiveTaskQueue] = useState([]);
  const [currentPromptTask, setCurrentPromptTask] = useState(null);
  const [hasPromptedToday, setHasPromptedToday] = useState(false);

  const isBaseEmployee = currentUser?.role === 'EMPLOYEE';

  const formatAssignedByName = (name) => {
    if (!name) return 'Self';
    const parts = name.trim().split(/\s+/);
    return parts.slice(0, 2).join(' ');
  };

  // Shift-End -10 Min Auto-Popup Evaluation
  useEffect(() => {
    if (hasPromptedToday || !currentUser?.shift_end_time || commitments.length === 0) return;

    const checkShiftEndCutoff = () => {
      const now = new Date();
      const [shiftHour, shiftMin] = currentUser.shift_end_time.split(':').map(Number);
      const shiftDate = new Date();
      shiftDate.setHours(shiftHour, shiftMin, 0, 0);

      // Trigger condition: within 10 minutes of shift end or past shift end
      const diffMinutes = (shiftDate - now) / (1000 * 60);

      if (diffMinutes <= 10 && diffMinutes >= -120) {
        // Collect unchanged tasks
        const unchangedTasks = commitments.filter(
          (t) => !t.has_status_changed_today && !['VERIFIED', 'CANCELLED'].includes(t.status)
        );

        if (unchangedTasks.length > 0) {
          setInactiveTaskQueue(unchangedTasks);
          setCurrentPromptTask(unchangedTasks[0]);
          setHasPromptedToday(true);
        }
      }
    };

    checkShiftEndCutoff();
    const interval = setInterval(checkShiftEndCutoff, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [commitments, currentUser, hasPromptedToday]);

  const handleNoActionSuccess = () => {
    // Advance to next task in sequential queue
    const remaining = inactiveTaskQueue.slice(1);
    setInactiveTaskQueue(remaining);
    if (remaining.length > 0) {
      setCurrentPromptTask(remaining[0]);
    } else {
      setCurrentPromptTask(null);
    }
    if (onRefresh) onRefresh();
  };

  const handleUncheckCommitment = async (taskId) => {
    setUncheckingId(taskId);
    try {
      await api.delete('/tasks/daily-commitments/', { data: { task_id: taskId } });
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to remove task from today commitments.');
    } finally {
      setUncheckingId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-3.5 bg-slate-50/90 border-b border-slate-200 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <CalendarCheck size={16} className="text-emerald-600" />
          <h3 className="font-bold text-slate-800 text-xs tracking-wide uppercase">
            Today's Committed Work ({commitments.length})
          </h3>
        </div>
        <span className="text-[11px] text-slate-500">
          Must log progress or status before shift end ({currentUser?.shift_end_time || '18:00'})
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
              <th className="py-2.5 px-3 w-10 text-center">Commit</th>
              <th className="py-2.5 px-3">Task Details</th>
              <th className="py-2.5 px-3">{isBaseEmployee ? 'Assigned By' : 'Assignee'}</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Progress</th>
              <th className="py-2.5 px-3">Today's Activity</th>
              <th className="py-2.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {commitments.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-400">
                  No tasks committed for today yet. Use the Daily Plan button to add tasks.
                </td>
              </tr>
            ) : (
              commitments.map((task) => {
                const isCompleted =
                  task.progress_percentage === 100 ||
                  ['VERIFIED', 'AWAITING_VERIFICATION'].includes(task.status);
                const hasActivityToday = Boolean(task.has_status_changed_today);

                return (
                  <tr key={task.id} className="hover:bg-slate-50/70 transition">
                    {/* Commit Checkbox */}
                    <td className="py-2.5 px-3 text-center">
                      {isCompleted ? (
                        <span title="Completed tasks are locked in today's commitments" className="text-emerald-600 inline-block">
                          <Lock size={14} />
                        </span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={true}
                          disabled={uncheckingId === task.id}
                          onChange={() => handleUncheckCommitment(task.id)}
                          title="Uncheck to remove from today's plan"
                          className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                        />
                      )}
                    </td>

                    {/* Task Title */}
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{task.title}</div>
                      <div className="text-[10px] text-slate-400">Priority: {task.priority}</div>
                    </td>

                    {/* Assigned By / Assignee */}
                    <td className="py-2.5 px-3">
                      <span className="font-medium text-slate-800">
                        {isBaseEmployee
                          ? formatAssignedByName(task.created_by_name)
                          : task.assigned_to_name || `User #${task.assigned_to}`}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-slate-100 text-slate-700">
                        {task.status?.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Progress Bar */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              task.progress_percentage === 100 ? 'bg-emerald-500' : 'bg-blue-600'
                            }`}
                            style={{ width: `${task.progress_percentage}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-700">
                          {task.progress_percentage}%
                        </span>
                      </div>
                    </td>

                    {/* Today's Activity Column */}
                    <td className="py-2.5 px-3">
                      {hasActivityToday ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          <CheckCircle2 size={12} /> Activity Done
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                          <AlertTriangle size={12} /> No Action Today
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-4 text-right">
                      {isCompleted ? (
                        <span className="text-[10px] font-bold text-slate-400">Locked</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenActionModal(task)}
                          className="text-xs text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded font-medium border border-transparent hover:border-blue-200 transition"
                        >
                          Update
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Sequential Shift-End Modal */}
      <TaskNoActionModal
        isOpen={Boolean(currentPromptTask)}
        task={currentPromptTask}
        remainingCount={inactiveTaskQueue.length}
        onClose={() => setCurrentPromptTask(null)}
        onSuccess={handleNoActionSuccess}
      />
    </div>
  );
}