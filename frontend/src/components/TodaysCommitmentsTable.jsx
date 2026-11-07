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
    LOW: 'bg-neutral-800 text-neutral-300 border-neutral-700/60',
    MEDIUM: 'bg-amber-950/40 text-amber-300 border-amber-500/30',
    HIGH: 'bg-amber-500/15 text-amber-300 border-amber-400/50',
    URGENT: 'bg-rose-950/50 text-rose-300 border-rose-500/40',
  };

  const statusStyles = {
    REQUEST_PENDING: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    ACCEPTED: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
    IN_PROGRESS: 'bg-amber-400/10 text-amber-200 border-amber-400/30',
    ON_HOLD: 'bg-neutral-800/80 text-neutral-400 border-neutral-700',
    AWAITING_VERIFICATION: 'bg-purple-900/30 text-purple-300 border-purple-500/30',
    VERIFIED: 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30',
    REJECTED: 'bg-rose-950/40 text-rose-400 border-rose-500/30',
    CANCELLED: 'bg-neutral-900 text-neutral-500 border-neutral-800',
  };

  return (
    <div className="bg-[#141518] rounded-2xl border border-amber-500/25 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_20px_rgba(245,158,11,0.06)] overflow-hidden font-sans text-neutral-200">
      
      {/* Table Header Banner */}
      <div className="p-3.5 sm:p-4 bg-[#0b0c0e]/90 border-b border-amber-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
            <CalendarCheck size={16} className="text-amber-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-xs sm:text-sm tracking-wide uppercase font-mono flex items-center gap-2">
              Today's Committed Work
              <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.2 rounded-full font-bold">
                {commitments.length}
              </span>
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-amber-300/80 font-mono">
          <Clock size={12} className="text-amber-400" />
          <span>Must log status before shift cutoff ({currentUser?.shift_end_time || '18:00'})</span>
        </div>
      </div>

      {/* DESKTOP TABLE VIEW (md and up) */}
      <div className="hidden md:block overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#0b0c0e] border-b border-amber-500/20 text-amber-400 font-semibold text-[11px] uppercase tracking-wider font-mono">
              <th className="py-3 px-3 w-12 text-center">Commit</th>
              <th className="py-3 px-4">Task Details</th>
              <th className="py-3 px-3">{isBaseEmployee ? 'Assigned By' : 'Assignee'}</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Progress</th>
              <th className="py-3 px-3">Today's Activity</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-500/10">
            {commitments.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-neutral-400 italic font-mono text-xs">
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
                  <tr key={task.id} className="hover:bg-[#1a1c22]/80 transition">
                    {/* Commit Checkbox */}
                    <td className="py-3 px-3 text-center">
                      {isCompleted ? (
                        <span title="Completed tasks are locked in today's commitments" className="text-emerald-400 inline-block">
                          <Lock size={14} />
                        </span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={true}
                          disabled={uncheckingId === task.id}
                          onChange={() => handleUncheckCommitment(task.id)}
                          title="Uncheck to remove from today's plan"
                          className="rounded accent-amber-500 cursor-pointer h-4 w-4"
                        />
                      )}
                    </td>

                    {/* Task Title & Priority */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white text-xs">{task.title}</div>
                      <div className="text-[10px] text-amber-400/80 font-mono mt-0.5 flex items-center gap-1.5">
                        <span>Priority:</span>
                        <span className={`px-1.5 py-0.2 rounded border uppercase text-[9px] font-bold ${priorityStyles[task.priority] || 'border-neutral-700 text-neutral-400'}`}>
                          {task.priority}
                        </span>
                      </div>
                    </td>

                    {/* Assigned By / Assignee */}
                    <td className="py-3 px-3">
                      <div className="font-medium text-white">
                        {isBaseEmployee
                          ? formatAssignedByName(task.created_by_name)
                          : task.assigned_to_name || `User #${task.assigned_to}`}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border font-mono uppercase ${statusStyles[task.status] || 'bg-neutral-800 text-neutral-300 border-neutral-700'}`}>
                        {task.status?.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Progress Bar */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-[#0b0c0e] rounded-full h-1.5 overflow-hidden border border-amber-500/20">
                          <div
                            className={`h-full rounded-full transition-all ${
                              task.progress_percentage === 100 
                                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' 
                                : 'bg-gradient-to-r from-amber-500 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                            }`}
                            style={{ width: `${task.progress_percentage}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono font-bold text-white min-w-[28px]">
                          {task.progress_percentage}%
                        </span>
                      </div>
                    </td>

                    {/* Today's Activity Column */}
                    <td className="py-3 px-3">
                      {hasActivityToday ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 rounded-md font-mono shadow-[0_0_8px_rgba(16,185,129,0.15)]">
                          <CheckCircle2 size={12} className="text-emerald-400" /> Activity Done
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-md font-mono animate-pulse">
                          <AlertTriangle size={12} className="text-amber-400" /> No Action Today
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      {isCompleted ? (
                        <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase px-2 py-1 bg-neutral-900 border border-neutral-800 rounded-lg inline-block">
                          Locked
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenActionModal(task)}
                          className="text-xs font-semibold text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 px-3 py-1.5 rounded-xl shadow-[0_0_12px_rgba(245,158,11,0.25)] transition cursor-pointer"
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
      <div className="block md:hidden divide-y divide-amber-500/10">
        {commitments.length === 0 ? (
          <div className="py-10 text-center text-neutral-400 italic font-mono text-xs p-4">
            No tasks committed for today yet. Use the Daily Plan button to add tasks.
          </div>
        ) : (
          commitments.map((task) => {
            const isCompleted =
              task.progress_percentage === 100 ||
              ['VERIFIED', 'AWAITING_VERIFICATION'].includes(task.status);
            const hasActivityToday = Boolean(task.has_status_changed_today);

            return (
              <div key={task.id} className="p-4 space-y-3 bg-[#0b0c0e]/30 hover:bg-[#1a1c22]/50 transition">
                {/* Header: Checkbox + Title */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div className="pt-0.5">
                      {isCompleted ? (
                        <span title="Completed tasks are locked in today's commitments" className="text-emerald-400 inline-block">
                          <Lock size={15} />
                        </span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={true}
                          disabled={uncheckingId === task.id}
                          onChange={() => handleUncheckCommitment(task.id)}
                          title="Uncheck to remove from today's plan"
                          className="rounded accent-amber-500 cursor-pointer h-4 w-4"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-white text-sm leading-snug break-words">
                        {task.title}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <User size={12} className="text-amber-400 shrink-0" />
                        <span className="text-[11px] text-neutral-300 truncate">
                          {isBaseEmployee
                            ? `By: ${formatAssignedByName(task.created_by_name)}`
                            : `To: ${task.assigned_to_name || `User #${task.assigned_to}`}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border font-mono uppercase shrink-0 ${statusStyles[task.status] || 'bg-neutral-800 text-neutral-300'}`}>
                    {task.status?.replace('_', ' ')}
                  </span>
                </div>

                {/* Status, Priority & Activity Badges */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border font-mono uppercase ${priorityStyles[task.priority] || 'border-neutral-700 text-neutral-400'}`}>
                    {task.priority}
                  </span>
                  {hasActivityToday ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-300 bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 rounded-md font-mono">
                      <CheckCircle2 size={11} className="text-emerald-400" /> Done Today
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-300 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-md font-mono animate-pulse">
                      <AlertTriangle size={11} className="text-amber-400" /> No Action
                    </span>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="space-y-1 bg-[#0b0c0e] p-2 rounded-xl border border-amber-500/15">
                  <div className="flex justify-between items-center text-[10px] text-neutral-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Sliders size={11} className="text-amber-400" /> Progress
                    </span>
                    <span className="text-amber-300 font-bold">{task.progress_percentage}%</span>
                  </div>
                  <div className="w-full bg-[#141518] rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        task.progress_percentage === 100 
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' 
                          : 'bg-gradient-to-r from-amber-500 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                      }`}
                      style={{ width: `${task.progress_percentage}%` }}
                    />
                  </div>
                </div>

                {/* Action Button */}
                <div className="pt-1">
                  {isCompleted ? (
                    <div className="w-full py-1.5 bg-neutral-900 border border-neutral-800 text-neutral-500 text-[11px] font-mono font-semibold text-center rounded-xl">
                      Task Locked (Completed)
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenActionModal(task)}
                      className="w-full py-2 bg-gradient-to-r from-amber-400 to-amber-500 text-black font-bold text-xs rounded-xl text-center shadow-[0_0_12px_rgba(245,158,11,0.25)] transition"
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