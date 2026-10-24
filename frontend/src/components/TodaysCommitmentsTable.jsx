import React from 'react';
import { CheckSquare, Edit3, Clock, AlertCircle, AlertTriangle } from 'lucide-react';

export default function TodaysCommitmentsTable({
  commitments,
  onUncheckTask,
  onOpenActionModal,
  isOnDuty,
  onOpenPlanner,
  currentUser
}) {
  const isBaseEmployee = currentUser?.role === 'EMPLOYEE';

  const formatAssignedDateTime = (timestamp) => {
    if (!timestamp) return 'Recent';
    const d = new Date(timestamp);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' • ' + 
           d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <CheckSquare className="text-emerald-600" size={18} />
          <h3 className="font-bold text-slate-900 text-sm">Today's Committed Work</h3>
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
            {commitments.length} Active
          </span>
        </div>

        {isOnDuty && (
          <button
            onClick={onOpenPlanner}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            + Adjust Plan / Add Tasks
          </button>
        )}
      </div>

      {!isOnDuty ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>You are marked <strong>On Leave</strong>. Mark yourself <strong>Present / On-Duty</strong> to activate today's commitments[cite: 1, 2].</span>
        </div>
      ) : commitments.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl space-y-2">
          <p className="text-xs text-slate-400">No tasks committed for today's active work schedule[cite: 1, 2].</p>
          <button
            onClick={onOpenPlanner}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition"
          >
            Select from Task Backlog
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">Uncheck</th>
                <th className="py-2.5 px-3">Committed Task</th>
                {!isBaseEmployee && <th className="py-2.5 px-3">Assigned To</th>}
                <th className="py-2.5 px-3">Assigned By</th>
                <th className="py-2.5 px-3">Progress</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Daily Activity</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {commitments.map((task) => {
                const isCompleted = task.progress_percentage === 100 || ['VERIFIED', 'AWAITING_VERIFICATION'].includes(task.status);
                const hasNoActionToday = task.has_status_changed_today === false && !isCompleted;
                const taskId = task.task_id || task.id;

                return (
                  <tr key={taskId} className="hover:bg-slate-50/70 transition">
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={true}
                        disabled={isCompleted}
                        onChange={() => onUncheckTask(taskId)}
                        title={isCompleted ? "Completed tasks cannot be unchecked today" : "Uncheck to remove from today's plan"}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </td>

                    <td className="py-2.5 px-3 font-bold text-slate-900">{task.title}</td>

                    {!isBaseEmployee && (
                      <td className="py-2.5 px-3 text-slate-700">{task.assigned_to_name}</td>
                    )}

                    <td className="py-2.5 px-3 text-slate-600">
                      <div>{task.created_by_name || 'Self'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {formatAssignedDateTime(task.created_at)}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 font-mono font-bold text-blue-600">
                      {task.progress_percentage}%
                    </td>

                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isCompleted
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {task.status}
                      </span>
                    </td>

                    <td className="py-2.5 px-3">
                      {isCompleted ? (
                        <span className="text-[10px] font-semibold text-emerald-700">Finished Today</span>
                      ) : hasNoActionToday ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          <AlertTriangle size={10} /> No Action Today
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-blue-700">Progress Logged</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isCompleted && isBaseEmployee ? (
                          <span className="text-[10px] text-purple-700 italic flex items-center gap-1">
                            <Clock size={11} /> Locked
                          </span>
                        ) : (
                          <button
                            onClick={() => onOpenActionModal(task)}
                            disabled={isCompleted && isBaseEmployee}
                            className="p-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition disabled:opacity-40"
                            title="Update Progress"
                          >
                            <Edit3 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}