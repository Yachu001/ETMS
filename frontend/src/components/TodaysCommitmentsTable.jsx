// frontend/src/components/TodaysCommitmentsTable.jsx

import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import TaskNoActionModal from './TaskNoActionModal';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  CalendarCheck,
  Lock,
  User,
  Sliders
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

  const priorityStyles = {
    LOW: 'bg-slate-100 text-slate-600 border-slate-200',
    MEDIUM: 'bg-sky-50 text-sky-700 border-sky-200',
    HIGH: 'bg-amber-50 text-amber-700 border-amber-200',
    URGENT: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  const statusStyles = {
    REQUEST_PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
    ACCEPTED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
    ON_HOLD: 'bg-slate-100 text-slate-600 border-slate-200',
    AWAITING_VERIFICATION: 'bg-purple-50 text-purple-700 border-purple-200',
    VERIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
    CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] overflow-hidden font-sans text-slate-800">
      
      {/* Table Header Banner */}
      <div className="p-4 sm:p-5 bg-slate-50/90 border-b border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-600 flex items-center justify-center shadow-2xs">
            <CalendarCheck size={16} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-xs sm:text-sm tracking-wide uppercase flex items-center gap-2">
              Today's Committed Work
              <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full font-mono font-bold">
                {commitments.length}
              </span>
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono font-medium">
          <Clock size={12} className="text-blue-600" />
          <span>Must log status before shift cutoff ({currentUser?.shift_end_time || '18:00'})</span>
        </div>
      </div>

      {/* DESKTOP TABLE VIEW (md and up) */}
      <div className="hidden md:block overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full text-left border-collapse text-xs text-slate-700">
          <thead>
            <tr className="bg-slate-50/60 border-b border-slate-200/80 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
              <th className="py-3.5 px-3 w-12 text-center">Commit</th>
              <th className="py-3.5 px-4">Task Details</th>
              <th className="py-3.5 px-3">{isBaseEmployee ? 'Assigned By' : 'Assignee'}</th>
              <th className="py-3.5 px-3">Status</th>
              <th className="py-3.5 px-3">Progress</th>
              <th className="py-3.5 px-3">Today's Activity</th>
              <th className="py-3.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {commitments.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-400 italic text-xs">
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
                  <tr key={task.id} className="hover:bg-blue-50/40 transition duration-150">
                    {/* Commit Checkbox */}
                    <td className="py-3.5 px-3 text-center">
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
                          className="rounded accent-blue-600 cursor-pointer h-4 w-4"
                        />
                      )}
                    </td>

                    {/* Task Title & Priority */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-xs">{task.title}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5">
                        <span>Priority:</span>
                        <span className={`px-2 py-0.2 rounded-md border uppercase text-[9px] font-bold ${priorityStyles[task.priority] || 'border-slate-200 text-slate-600'}`}>
                          {task.priority}
                        </span>
                      </div>
                    </td>

                    {/* Assigned By / Assignee */}
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-slate-800">
                        {isBaseEmployee
                          ? formatAssignedByName(task.created_by_name)
                          : task.assigned_to_name || `User #${task.assigned_to}`}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3">
                      <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border font-mono uppercase ${statusStyles[task.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {task.status?.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Progress Bar */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200/80">
                          <div
                            className={`h-full rounded-full transition-all ${
                              task.progress_percentage === 100 
                                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' 
                                : 'bg-gradient-to-r from-blue-600 to-blue-500'
                            }`}
                            style={{ width: `${task.progress_percentage}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono font-bold text-slate-700 min-w-[28px]">
                          {task.progress_percentage}%
                        </span>
                      </div>
                    </td>

                    {/* Today's Activity Column */}
                    <td className="py-3.5 px-3">
                      {hasActivityToday ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg font-mono">
                          <CheckCircle2 size={12} className="text-emerald-600" /> Activity Done
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-lg font-mono animate-pulse">
                          <AlertTriangle size={12} className="text-amber-600" /> No Action Today
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      {isCompleted ? (
                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg inline-block">
                          Locked
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenActionModal(task)}
                          className="text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 px-3.5 py-1.5 rounded-xl shadow-[0_3px_10px_rgba(37,99,235,0.25)] transition cursor-pointer"
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

      {/* MOBILE CARD-STACK VIEW (< md screens) */}
      <div className="block md:hidden divide-y divide-slate-100">
        {commitments.length === 0 ? (
          <div className="py-10 text-center text-slate-400 italic text-xs p-4">
            No tasks committed for today yet. Use the Daily Plan button to add tasks.
          </div>
        ) : (
          commitments.map((task) => {
            const isCompleted =
              task.progress_percentage === 100 ||
              ['VERIFIED', 'AWAITING_VERIFICATION'].includes(task.status);
            const hasActivityToday = Boolean(task.has_status_changed_today);

            return (
              <div key={task.id} className="p-4 space-y-3 hover:bg-blue-50/30 transition">
                {/* Header: Checkbox + Title */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div className="pt-0.5">
                      {isCompleted ? (
                        <span title="Completed tasks are locked in today's commitments" className="text-emerald-600 inline-block">
                          <Lock size={15} />
                        </span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={true}
                          disabled={uncheckingId === task.id}
                          onChange={() => handleUncheckCommitment(task.id)}
                          title="Uncheck to remove from today's plan"
                          className="rounded accent-blue-600 cursor-pointer h-4 w-4"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-slate-900 text-sm leading-snug break-words">
                        {task.title}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <User size={12} className="text-blue-600 shrink-0" />
                        <span className="text-[11px] text-slate-600 font-medium truncate">
                          {isBaseEmployee
                            ? `By: ${formatAssignedByName(task.created_by_name)}`
                            : `To: ${task.assigned_to_name || `User #${task.assigned_to}`}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border font-mono uppercase shrink-0 ${statusStyles[task.status] || 'bg-slate-100 text-slate-600'}`}>
                    {task.status?.replace('_', ' ')}
                  </span>
                </div>

                {/* Status, Priority & Activity Badges */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border font-mono uppercase ${priorityStyles[task.priority] || 'border-slate-200 text-slate-600'}`}>
                    {task.priority}
                  </span>
                  {hasActivityToday ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-mono">
                      <CheckCircle2 size={11} className="text-emerald-600" /> Done Today
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-mono animate-pulse">
                      <AlertTriangle size={11} className="text-amber-600" /> No Action
                    </span>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                    <span className="flex items-center gap-1">
                      <Sliders size={11} className="text-blue-600" /> Progress
                    </span>
                    <span className="text-blue-700 font-bold">{task.progress_percentage}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        task.progress_percentage === 100 
                          ? 'bg-emerald-500' 
                          : 'bg-blue-600'
                      }`}
                      style={{ width: `${task.progress_percentage}%` }}
                    />
                  </div>
                </div>

                {/* Action Button */}
                <div className="pt-1">
                  {isCompleted ? (
                    <div className="w-full py-1.5 bg-slate-100 border border-slate-200 text-slate-400 text-[11px] font-mono font-bold text-center rounded-xl">
                      Task Locked (Completed)
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenActionModal(task)}
                      className="w-full py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold text-xs rounded-xl text-center shadow-[0_3px_10px_rgba(37,99,235,0.25)] transition cursor-pointer"
                    >
                      Update Progress
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
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