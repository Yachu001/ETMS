// frontend/src/components/TaskModuleHub.jsx

import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import TaskTable from './TaskTable';
import CreateTaskModal from './CreateTaskModal';
import { 
  Building2, 
  FolderTree, 
  Users, 
  UserCheck, 
  ChevronRight, 
  ArrowLeft, 
  Layers, 
  PlusCircle, 
  CalendarClock, 
  ListFilter 
} from 'lucide-react';

export default function TaskModuleHub({ 
  currentUser, 
  onOpenActionModal, 
  onRefresh, 
  tasks = [] 
}) {
  const role = currentUser?.role || 'EMPLOYEE';
  const isBaseEmployee = role === 'EMPLOYEE';
  const hasToggle = ['SUPERVISOR', 'DEPT_HEAD', 'BUSINESS_ADMIN'].includes(role);
  const isExecutive = ['ADMIN', 'SUPER_ADMIN'].includes(role) || currentUser?.is_superuser;

  // View state: Base Employee is locked to self; Admins locked to team
  const [viewMode, setViewMode] = useState(isBaseEmployee ? 'self' : 'team');
  const [teamDisplayMode, setTeamDisplayMode] = useState('ORG'); // 'ORG' | 'TASK'
  const [taskFilterPill, setTaskFilterPill] = useState('ACTIVE'); // 'ALL' | 'ACTIVE' | 'OVERDUE' | 'COMMITTED'
  const [adminActiveTab, setAdminActiveTab] = useState('BUSINESS');

  // Navigation Stack History for Hierarchical Drill-down
  const [navStack, setNavStack] = useState([{ level: 'ROOT', title: 'Overview' }]);
  const currentStep = navStack[navStack.length - 1];

  // Data Stores
  const [rootData, setRootData] = useState({
    departments: [],
    businesses: [],
    dept_admins: [],
    business_admins: []
  });
  const [matrices, setMatrices] = useState([]);
  const [filteredMatrices, setFilteredMatrices] = useState([]);
  const [selectedMatrix, setSelectedMatrix] = useState(null);
  const [supervisorTeam, setSupervisorTeam] = useState([]);
  
  // Independent task lists
  const [selfTasksList, setSelfTasksList] = useState([]);
  const [teamTasksList, setTeamTasksList] = useState([]);

  const [targetUser, setTargetUser] = useState(null);
  const [userTasks, setUserTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal triggers
  const [assignModalUserId, setAssignModalUserId] = useState(null);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);

  // Data Fetching logic strictly decoupled between Self and Team
  const fetchModuleData = async () => {
    setLoading(true);
    try {
      if (viewMode === 'self') {
        const selfRes = await api.get('/tasks/?view_mode=self');
        setSelfTasksList(selfRes.data || []);
      } else {
        const teamTasksRes = await api.get('/tasks/?view_mode=team');
        setTeamTasksList(teamTasksRes.data || []);

        if (isExecutive) {
          const res = await api.get('/tasks/dashboard/admin-root-tables/');
          setRootData(res.data || {});
        } else if (role === 'BUSINESS_ADMIN' || role === 'DEPT_HEAD') {
          const res = await api.get('/tasks/matrix-overview/');
          setMatrices(res.data || []);
        } else if (role === 'SUPERVISOR') {
          const res = await api.get('/tasks/dashboard/team-overview/');
          setSupervisorTeam(res.data.members || []);
        }
      }
    } catch (err) {
      console.error('Failed to load task module data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModuleData();
  }, [viewMode, role, isExecutive]);

  // Active Scope Determination
  const activeTaskList = viewMode === 'self' 
    ? (selfTasksList.length > 0 ? selfTasksList : tasks.filter(t => t.assigned_to === currentUser?.id))
    : teamTasksList;

  // Derived Statistical Counters
  const stats = useMemo(() => {
    const totalCount = activeTaskList.length;
    const activeTasksCount = activeTaskList.filter(t => 
      ['REQUEST_PENDING', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD', 'AWAITING_VERIFICATION'].includes(t.status)
    ).length;
    const dailyCommitsCount = activeTaskList.filter(t => t.is_committed_today).length;

    const statusCounts = {
      REQUEST_PENDING: 0,
      ACCEPTED: 0,
      IN_PROGRESS: 0,
      ON_HOLD: 0,
      AWAITING_VERIFICATION: 0,
      VERIFIED: 0,
      CANCELLED: 0,
      REJECTED: 0,
    };

    activeTaskList.forEach(t => {
      if (statusCounts[t.status] !== undefined) {
        statusCounts[t.status] += 1;
      }
    });

    return { totalCount, activeTasksCount, dailyCommitsCount, statusCounts };
  }, [activeTaskList]);

  // Task-Wise Filter Pills Logic (For Team View)
  const filteredTeamTasks = useMemo(() => {
    return activeTaskList.filter(task => {
      if (taskFilterPill === 'ALL') return true;
      if (taskFilterPill === 'ACTIVE') {
        return ['REQUEST_PENDING', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD', 'AWAITING_VERIFICATION'].includes(task.status);
      }
      if (taskFilterPill === 'OVERDUE') {
        return Boolean(task.is_overdue) && !['VERIFIED', 'REJECTED', 'CANCELLED'].includes(task.status);
      }
      if (taskFilterPill === 'COMMITTED') {
        return Boolean(task.is_committed_today);
      }
      return true;
    });
  }, [activeTaskList, taskFilterPill]);

  // Navigation Handlers for Hierarchical Drill-down
  const handleStepBack = () => {
    if (navStack.length <= 1) return;
    const newStack = navStack.slice(0, navStack.length - 1);
    setNavStack(newStack);

    const prevStep = newStack[newStack.length - 1];
    if (prevStep.level === 'ROOT' || prevStep.level === 'ENTITY_MATRICES') {
      setSelectedMatrix(null);
      setTargetUser(null);
      setUserTasks([]);
    } else if (prevStep.level === 'MATRIX_ROSTER') {
      setTargetUser(null);
      setUserTasks([]);
      setSelectedMatrix(prevStep.data);
    }
  };

  const handleJumpToStep = (index) => {
    if (index === navStack.length - 1) return;
    const targetStep = navStack[index];
    const newStack = navStack.slice(0, index + 1);
    setNavStack(newStack);

    if (targetStep.level === 'ROOT' || targetStep.level === 'ENTITY_MATRICES') {
      setSelectedMatrix(null);
      setTargetUser(null);
      setUserTasks([]);
    } else if (targetStep.level === 'MATRIX_ROSTER') {
      setTargetUser(null);
      setUserTasks([]);
      setSelectedMatrix(targetStep.data);
    }
  };

  const openEntityMatrices = async (entityType, entityObj) => {
    setLoading(true);
    try {
      const res = await api.get('/tasks/matrix-overview/');
      const matched = entityType === 'BUSINESS'
        ? res.data.filter(m => m.business_id === entityObj.id)
        : res.data.filter(m => m.department_id === entityObj.id);

      setFilteredMatrices(matched);
      setNavStack(prev => [
        ...prev,
        { 
          level: 'ENTITY_MATRICES', 
          title: `${entityObj.name} Matrices`, 
          data: { entityType, entityObj, list: matched } 
        }
      ]);
    } catch (err) {
      console.error('Failed to load entity matrices:', err);
    } finally {
      setLoading(false);
    }
  };

  const openMatrixRoster = (matrixObj) => {
    setSelectedMatrix(matrixObj);
    setNavStack(prev => [
      ...prev,
      { level: 'MATRIX_ROSTER', title: `${matrixObj.name} Roster`, data: matrixObj }
    ]);
  };

  const openUserTasks = async (userObj) => {
    setLoading(true);
    setTargetUser(userObj);
    try {
      const res = await api.get(`/tasks/?user_id=${userObj.id}`);
      setUserTasks(res.data || []);
      setNavStack(prev => [
        ...prev,
        { 
          level: 'USER_TASKS', 
          title: `${userObj.name || userObj.username}'s Tasks`, 
          data: { user: userObj, tasks: res.data } 
        }
      ]);
    } catch (err) {
      console.error('Failed to load user tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeStyle = (userRole) => {
    switch (userRole) {
      case 'SUPER_ADMIN':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'ADMIN':
        return 'bg-blue-100/80 text-blue-800 border-blue-300';
      case 'BUSINESS_ADMIN':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'DEPT_HEAD':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'SUPERVISOR':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Standardized Multi-Color 3-Dot Indicator with Captions
  const renderMultiColorThreeDots = (isActive, isPresent, dailyCommitsCount) => {
    const hasCommits = (dailyCommitsCount || 0) > 0;
    const isIdle = isPresent && !hasCommits;

    return (
      <div className="flex items-start gap-2.5 sm:gap-3">
        {/* Dot 1: Active Status */}
        <div className="flex flex-col items-center">
          <span className={`h-2.5 w-2.5 rounded-full ${isActive ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.45)]' : 'bg-slate-300'}`}></span>
          <span className="text-[9px] text-slate-500 font-medium mt-0.5">
            {isActive ? 'active' : 'inactive'}
          </span>
        </div>

        {/* Dot 2: Presence */}
        <div className="flex flex-col items-center">
          <span className={`h-2.5 w-2.5 rounded-full ${isPresent ? 'bg-blue-600 shadow-[0_0_6px_rgba(37,99,235,0.45)]' : 'bg-slate-300'}`}></span>
          <span className="text-[9px] text-slate-500 font-medium mt-0.5">
            {isPresent ? 'present' : 'off'}
          </span>
        </div>

        {/* Dot 3: Work / Commits Status */}
        <div className="flex flex-col items-center">
          {isIdle ? (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]"></span>
            </span>
          ) : (
            <span className={`h-2.5 w-2.5 rounded-full ${hasCommits ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.45)]' : 'bg-slate-300'}`}></span>
          )}
          <span className={`text-[9px] font-bold mt-0.5 ${
            isIdle ? 'text-rose-600' : (hasCommits ? 'text-emerald-600' : 'text-slate-400')
          }`}>
            {isIdle ? '0 commits' : (hasCommits ? 'working' : 'idle')}
          </span>
        </div>
      </div>
    );
  };

  // Render Org-Wise Hierarchy Views
  const renderCurrentView = () => {
    // LEVEL 3: USER TASKS
    if (currentStep.level === 'USER_TASKS' && targetUser) {
      return (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs shadow-2xs">
            <span className="font-semibold text-slate-700">
              Inspecting Tasks: <strong className="text-slate-900">{targetUser.name || targetUser.username}</strong>
            </span>
            <span className="text-[11px] text-blue-700 bg-blue-50 px-3 py-1 rounded-xl border border-blue-200 font-bold">
              {userTasks.length} Total Tasks
            </span>
          </div>
          <TaskTable
            tasks={userTasks}
            onOpenActionModal={onOpenActionModal}
            currentUser={currentUser}
            onRefresh={() => openUserTasks(targetUser)}
            viewMode="team"
          />
        </div>
      );
    }

    // LEVEL 2: MATRIX ROSTER
    if (currentStep.level === 'MATRIX_ROSTER' && selectedMatrix) {
      return (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] overflow-hidden">
          <div className="px-4 sm:px-6 py-3.5 bg-slate-50/90 border-b border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-blue-600" />
              <h3 className="font-bold text-xs uppercase text-slate-900 tracking-wide">
                {selectedMatrix.name} — Branch Personnel Roster
              </h3>
            </div>
            <span className="text-[11px] text-slate-500">
              Row #1 is Matrix Supervisor; tap row to inspect tasks
            </span>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs text-slate-700">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200/80 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-center">Today Commits / Active Tasks</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {selectedMatrix.roster?.map((mem) => {
                  const isSupervisor = Boolean(mem.is_supervisor);
                  const isPresent = Boolean(mem.is_present);
                  const activeTasks = mem.active_tasks_count || 0;
                  const dailyCommits = mem.daily_commits_count || 0;

                  return (
                    <tr 
                      key={mem.id} 
                      className={`hover:bg-blue-50/50 transition duration-150 cursor-pointer ${
                        isSupervisor ? 'bg-blue-50/40' : ''
                      }`}
                      onClick={() => openUserTasks(mem)}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {isSupervisor && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white uppercase tracking-wider shadow-2xs">
                                  Lead
                                </span>
                              )}
                              <span>{mem.name || mem.username}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                              {mem.designation || 'Staff'}
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider shrink-0 ${getRoleBadgeStyle(mem.role)}`}>
                            {mem.role || 'EMPLOYEE'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        {renderMultiColorThreeDots(mem.is_active, isPresent, dailyCommits)}
                      </td>

                      <td className="py-3.5 px-3 text-center font-mono">
                        <span className="text-blue-700 font-bold">{dailyCommits}</span>
                        <span className="text-slate-400"> / {activeTasks}</span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline transition cursor-pointer"
                        >
                          Inspect Tasks &rarr;
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Touch Card Stack */}
          <div className="md:hidden divide-y divide-slate-100">
            {selectedMatrix.roster?.map((mem) => {
              const isSupervisor = Boolean(mem.is_supervisor);
              const isPresent = Boolean(mem.is_present);
              const activeTasks = mem.active_tasks_count || 0;
              const dailyCommits = mem.daily_commits_count || 0;

              return (
                <div 
                  key={mem.id}
                  onClick={() => openUserTasks(mem)}
                  className={`p-4 space-y-3 cursor-pointer hover:bg-blue-50/40 transition ${
                    isSupervisor ? 'bg-blue-50/30' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        {isSupervisor && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white uppercase">
                            Lead
                          </span>
                        )}
                        <span>{mem.name || mem.username}</span>
                      </div>
                      <p className="text-[11px] text-slate-500">{mem.designation || 'Staff'}</p>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider shrink-0 ${getRoleBadgeStyle(mem.role)}`}>
                      {mem.role || 'EMPLOYEE'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block mb-1">State:</span>
                      {renderMultiColorThreeDots(mem.is_active, isPresent, dailyCommits)}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block mb-0.5">Commits / Active:</span>
                      <span className="font-mono text-sm font-bold text-blue-700">{dailyCommits}</span>
                      <span className="text-slate-400 text-xs font-mono"> / {activeTasks}</span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <span className="text-xs font-semibold text-blue-600 inline-flex items-center gap-1">
                      Inspect Tasks <ChevronRight size={13} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // LEVEL 1: ENTITY MATRICES
    if (currentStep.level === 'ENTITY_MATRICES') {
      return (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] overflow-hidden">
          <div className="px-4 sm:px-6 py-3.5 bg-slate-50/90 border-b border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-blue-600" />
              <h3 className="font-bold text-xs uppercase text-slate-900 tracking-wide">
                {currentStep.title} ({filteredMatrices.length})
              </h3>
            </div>
            <span className="text-[11px] text-slate-500">Select a matrix to inspect its roster</span>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs text-slate-700">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200/80 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-4">Matrix Branch</th>
                  <th className="py-3 px-3">Incharge</th>
                  <th className="py-3 px-3 text-center">Present / Active</th>
                  <th className="py-3 px-3 text-center">Daily Commits / Active Tasks</th>
                  <th className="py-3 px-3 text-center">Overdues</th>
                  <th className="py-3 px-3 text-center">Idle Users</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredMatrices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No matrix branches found under this entity.
                    </td>
                  </tr>
                ) : (
                  filteredMatrices.map((m) => (
                    <tr 
                      key={m.id} 
                      onClick={() => openMatrixRoster(m)}
                      className="hover:bg-blue-50/40 transition duration-150 cursor-pointer"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900 tracking-wide">{m.name}</td>
                      <td className="py-3.5 px-3 text-slate-700">{m.supervisor_name}</td>
                      <td className="py-3.5 px-3 text-center font-mono">
                        <span className="text-emerald-600 font-bold">{m.present_count}</span>
                        <span className="text-slate-400"> / {m.total_members}</span>
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono">
                        <span className="text-blue-700 font-bold">{m.daily_commits_count || 0}</span>
                        <span className="text-slate-400"> / {m.total_active_tasks || 0}</span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {(m.overdues_count || 0) > 0 ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                            {m.overdues_count}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {(m.idle_count || 0) > 0 ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">
                            {m.idle_count}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button type="button" className="text-blue-600 font-semibold hover:text-blue-800 hover:underline transition cursor-pointer">
                          View Roster &rarr;
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Touch Card Stack */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredMatrices.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                No matrix branches found under this entity.
              </div>
            ) : (
              filteredMatrices.map((m) => (
                <div 
                  key={m.id}
                  onClick={() => openMatrixRoster(m)}
                  className="p-4 space-y-3 cursor-pointer hover:bg-blue-50/30 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{m.name}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Lead: {m.supervisor_name}</p>
                    </div>
                    <span className="text-[10px] text-blue-600 font-semibold inline-flex items-center gap-1">
                      Roster <ChevronRight size={13} />
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] text-slate-500 block">Present / Active:</span>
                      <span className="font-mono text-emerald-600 font-bold">{m.present_count}</span>
                      <span className="font-mono text-slate-400 text-[11px]"> / {m.total_members}</span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] text-slate-500 block">Commits / Active:</span>
                      <span className="font-mono text-blue-700 font-bold">{m.daily_commits_count || 0}</span>
                      <span className="font-mono text-slate-400 text-[11px]"> / {m.total_active_tasks || 0}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="flex items-center gap-2">
                      {(m.overdues_count || 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                          {m.overdues_count} Overdue
                        </span>
                      )}
                      {(m.idle_count || 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">
                          {m.idle_count} Idle
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400 text-[11px]">Tap to inspect</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    // LEVEL 0: ROOT TABLES (Executive Tier)
    if (isExecutive) {
      return (
        <div className="space-y-4">
          {/* Executive Sub-tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {[
              { id: 'BUSINESS', label: '1. Businesses Overview', icon: Building2 },
              { id: 'DEPARTMENT', label: '2. Departments Overview', icon: FolderTree },
              { id: 'BUS_ADMINS', label: '3. Business Admins Roster', icon: UserCheck },
              { id: 'DEPT_ADMINS', label: '4. Department Admins Roster', icon: Users },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = adminActiveTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAdminActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap tracking-wide font-semibold ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)] border border-blue-500'
                      : 'bg-white text-slate-600 hover:text-blue-700 hover:bg-blue-50/60 border border-slate-200/80'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-white' : 'text-blue-600'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB: BUSINESS */}
          {adminActiveTab === 'BUSINESS' && (
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse text-slate-700">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200/80 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                      <th className="py-3.5 px-4">Business</th>
                      <th className="py-3.5 px-3 text-center">Present / Active Members</th>
                      <th className="py-3.5 px-3 text-center">Daily Commits / Active Tasks</th>
                      <th className="py-3.5 px-3 text-center">Overdues Count</th>
                      <th className="py-3.5 px-3 text-center">Idle User Count</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {rootData.businesses?.map((b) => (
                      <tr 
                        key={b.id} 
                        onClick={() => openEntityMatrices('BUSINESS', b)}
                        className="hover:bg-blue-50/40 transition duration-150 cursor-pointer"
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-900 tracking-wide">
                          {b.name} <span className="text-[10px] text-slate-400 font-mono">({b.code})</span>
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono font-semibold text-slate-700">
                          {b.present_active_members || '—'}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono font-bold text-blue-700">
                          {b.daily_commits_active_tasks || '—'}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          {b.overdues_count > 0 ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                              {b.overdues_count}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          {b.idle_user_count > 0 ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">
                              {b.idle_user_count}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button type="button" className="text-blue-600 font-semibold hover:text-blue-800 hover:underline transition cursor-pointer">
                            View Matrices &rarr;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden divide-y divide-slate-100">
                {rootData.businesses?.map((b) => (
                  <div 
                    key={b.id}
                    onClick={() => openEntityMatrices('BUSINESS', b)}
                    className="p-4 space-y-3 cursor-pointer hover:bg-blue-50/30 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">
                          {b.name} <span className="text-[10px] text-slate-400 font-mono">({b.code})</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Corporate Operating Entity</p>
                      </div>
                      <span className="text-[10px] text-blue-600 font-semibold inline-flex items-center gap-1">
                        Matrices <ChevronRight size={13} />
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                        <span className="text-[10px] text-slate-500 block">Members:</span>
                        <span className="font-mono text-slate-900 font-bold">{b.present_active_members || '—'}</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                        <span className="text-[10px] text-slate-500 block">Commits / Active:</span>
                        <span className="font-mono text-blue-700 font-bold">{b.daily_commits_active_tasks || '—'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: DEPARTMENT */}
          {adminActiveTab === 'DEPARTMENT' && (
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse text-slate-700">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200/80 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                      <th className="py-3.5 px-4">Department</th>
                      <th className="py-3.5 px-3 text-center">Present / Active Members</th>
                      <th className="py-3.5 px-3 text-center">Daily Commits / Active Tasks</th>
                      <th className="py-3.5 px-3 text-center">Overdues Count</th>
                      <th className="py-3.5 px-3 text-center">Idle User Count</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {rootData.departments?.map((d) => (
                      <tr 
                        key={d.id} 
                        onClick={() => openEntityMatrices('DEPARTMENT', d)}
                        className="hover:bg-blue-50/40 transition duration-150 cursor-pointer"
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-900 tracking-wide">
                          {d.name} <span className="text-[10px] text-slate-400 font-mono">({d.code})</span>
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono font-semibold text-slate-700">
                          {d.present_active_members || '—'}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono font-bold text-blue-700">
                          {d.daily_commits_active_tasks || '—'}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          {d.overdues_count > 0 ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                              {d.overdues_count}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          {d.idle_user_count > 0 ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">
                              {d.idle_user_count}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button type="button" className="text-blue-600 font-semibold hover:text-blue-800 hover:underline transition cursor-pointer">
                            View Matrices &rarr;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden divide-y divide-slate-100">
                {rootData.departments?.map((d) => (
                  <div 
                    key={d.id}
                    onClick={() => openEntityMatrices('DEPARTMENT', d)}
                    className="p-4 space-y-3 cursor-pointer hover:bg-blue-50/30 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">
                          {d.name} <span className="text-[10px] text-slate-400 font-mono">({d.code})</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Functional Department</p>
                      </div>
                      <span className="text-[10px] text-blue-600 font-semibold inline-flex items-center gap-1">
                        Matrices <ChevronRight size={13} />
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                        <span className="text-[10px] text-slate-500 block">Members:</span>
                        <span className="font-mono text-slate-900 font-bold">{d.present_active_members || '—'}</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                        <span className="text-[10px] text-slate-500 block">Commits / Active:</span>
                        <span className="font-mono text-blue-700 font-bold">{d.daily_commits_active_tasks || '—'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: BUS ADMINS */}
          {adminActiveTab === 'BUS_ADMINS' && (
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse text-slate-700">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200/80 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                      <th className="py-3.5 px-4">Name</th>
                      <th className="py-3.5 px-3">Business</th>
                      <th className="py-3.5 px-3">Status</th>
                      <th className="py-3.5 px-3 text-center">Daily Commits / Active Tasks</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {rootData.business_admins?.map((ba) => (
                      <tr key={ba.id} className="hover:bg-blue-50/40 transition duration-150">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900">{ba.name}</span>
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${getRoleBadgeStyle(ba.role)}`}>
                              {ba.role}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-slate-700">{ba.business_name}</td>
                        <td className="py-3.5 px-3">
                          {renderMultiColorThreeDots(ba.is_active, ba.is_present, ba.daily_commits)}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono">
                          <span className="text-blue-700 font-bold">{ba.daily_commits || 0}</span>
                          <span className="text-slate-400"> / {ba.active_tasks || 0}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {ba.is_idle && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAssignModalUserId(ba.id);
                                  setIsCreateTaskOpen(true);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white px-3 py-1 rounded-xl transition shadow-[0_3px_10px_rgba(37,99,235,0.25)] cursor-pointer"
                              >
                                <PlusCircle size={12} /> Assign Task
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openUserTasks(ba)}
                              className="text-xs text-blue-600 font-semibold hover:text-blue-800 hover:underline transition cursor-pointer"
                            >
                              View Tasks &rarr;
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden divide-y divide-slate-100">
                {rootData.business_admins?.map((ba) => (
                  <div key={ba.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{ba.name}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">{ba.business_name}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${getRoleBadgeStyle(ba.role)}`}>
                        {ba.role}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-1">Status:</span>
                        {renderMultiColorThreeDots(ba.is_active, ba.is_present, ba.daily_commits)}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block mb-0.5">Commits / Active:</span>
                        <span className="font-mono text-blue-700 font-bold">{ba.daily_commits || 0}</span>
                        <span className="font-mono text-slate-400 text-xs"> / {ba.active_tasks || 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      {ba.is_idle && (
                        <button
                          type="button"
                          onClick={() => {
                            setAssignModalUserId(ba.id);
                            setIsCreateTaskOpen(true);
                          }}
                          className="flex-1 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 shadow-2xs"
                        >
                          <PlusCircle size={13} /> Assign
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openUserTasks(ba)}
                        className="flex-1 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-xs font-semibold hover:bg-blue-100 transition text-center"
                      >
                        View Tasks &rarr;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: DEPT ADMINS */}
          {adminActiveTab === 'DEPT_ADMINS' && (
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse text-slate-700">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200/80 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                      <th className="py-3.5 px-4">Name</th>
                      <th className="py-3.5 px-3">Department</th>
                      <th className="py-3.5 px-3">Status</th>
                      <th className="py-3.5 px-3 text-center">Daily Commits / Active Tasks</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {rootData.dept_admins?.map((da) => (
                      <tr key={da.id} className="hover:bg-blue-50/40 transition duration-150">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900">{da.name}</span>
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${getRoleBadgeStyle(da.role)}`}>
                              {da.role}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-slate-700">{da.department_name}</td>
                        <td className="py-3.5 px-3">
                          {renderMultiColorThreeDots(da.is_active, da.is_present, da.daily_commits)}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono">
                          <span className="text-blue-700 font-bold">{da.daily_commits || 0}</span>
                          <span className="text-slate-400"> / {da.active_tasks || 0}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {da.is_idle && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAssignModalUserId(da.id);
                                  setIsCreateTaskOpen(true);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white px-3 py-1 rounded-xl transition shadow-[0_3px_10px_rgba(37,99,235,0.25)] cursor-pointer"
                              >
                                <PlusCircle size={12} /> Assign Task
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openUserTasks(da)}
                              className="text-xs text-blue-600 font-semibold hover:text-blue-800 hover:underline transition cursor-pointer"
                            >
                              View Tasks &rarr;
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden divide-y divide-slate-100">
                {rootData.dept_admins?.map((da) => (
                  <div key={da.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{da.name}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">{da.department_name}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${getRoleBadgeStyle(da.role)}`}>
                        {da.role}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-1">Status:</span>
                        {renderMultiColorThreeDots(da.is_active, da.is_present, da.daily_commits)}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block mb-0.5">Commits / Active:</span>
                        <span className="font-mono text-blue-700 font-bold">{da.daily_commits || 0}</span>
                        <span className="font-mono text-slate-400 text-xs"> / {da.active_tasks || 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      {da.is_idle && (
                        <button
                          type="button"
                          onClick={() => {
                            setAssignModalUserId(da.id);
                            setIsCreateTaskOpen(true);
                          }}
                          className="flex-1 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 shadow-2xs"
                        >
                          <PlusCircle size={13} /> Assign
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openUserTasks(da)}
                        className="flex-1 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-xs font-semibold hover:bg-blue-100 transition text-center"
                      >
                        View Tasks &rarr;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Business Admin & Department Admin
    if (role === 'BUSINESS_ADMIN' || role === 'DEPT_HEAD') {
      return (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] overflow-hidden">
          <div className="px-4 sm:px-6 py-3.5 bg-slate-50/90 border-b border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-blue-600" />
              <h3 className="font-bold text-xs uppercase text-slate-900 tracking-wide">
                {role === 'BUSINESS_ADMIN' ? 'Business Matrix Branches' : 'Department Matrix Branches'}
              </h3>
            </div>
            <span className="text-[11px] text-slate-500">
              Tap branch to inspect personnel roster (Supervisor pinned at Row #1)
            </span>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs text-slate-700">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200/80 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-4">Matrix Name</th>
                  <th className="py-3 px-3">Incharge</th>
                  <th className="py-3 px-3 text-center">Present / Active Users</th>
                  <th className="py-3 px-3 text-center">Daily Commits / Total Active</th>
                  <th className="py-3 px-3 text-center">Overdues Count</th>
                  <th className="py-3 px-3 text-center">Idle Users Count</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {matrices.map((m) => (
                  <tr 
                    key={m.id} 
                    onClick={() => openMatrixRoster(m)}
                    className="hover:bg-blue-50/40 transition duration-150 cursor-pointer"
                  >
                    <td className="py-3.5 px-4 font-bold text-slate-900 tracking-wide">{m.name}</td>
                    <td className="py-3.5 px-3 text-slate-700">{m.supervisor_name}</td>
                    <td className="py-3.5 px-3 text-center font-mono">
                      <span className="text-emerald-600 font-bold">{m.present_count}</span>
                      <span className="text-slate-400"> / {m.total_members}</span>
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono">
                      <span className="text-blue-700 font-bold">{m.daily_commits_count || 0}</span>
                      <span className="text-slate-400"> / {m.total_active_tasks || 0}</span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      {(m.overdues_count || 0) > 0 ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                          {m.overdues_count}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      {(m.idle_count || 0) > 0 ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">
                          {m.idle_count}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button type="button" className="text-blue-600 font-semibold hover:text-blue-800 hover:underline transition cursor-pointer">
                        View Roster &rarr;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="md:hidden divide-y divide-slate-100">
            {matrices.map((m) => (
              <div 
                key={m.id}
                onClick={() => openMatrixRoster(m)}
                className="p-4 space-y-3 cursor-pointer hover:bg-blue-50/30 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{m.name}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Lead: {m.supervisor_name}</p>
                  </div>
                  <span className="text-[10px] text-blue-600 font-semibold inline-flex items-center gap-1">
                    Roster <ChevronRight size={13} />
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 block">Members:</span>
                    <span className="font-mono text-emerald-600 font-bold">{m.present_count}</span>
                    <span className="font-mono text-slate-400 text-[11px]"> / {m.total_members}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 block">Commits:</span>
                    <span className="font-mono text-blue-700 font-bold">{m.daily_commits_count || 0}</span>
                    <span className="font-mono text-slate-400 text-[11px]"> / {m.total_active_tasks || 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Supervisor (Team Roster Table)
    if (role === 'SUPERVISOR') {
      return (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] overflow-hidden">
          <div className="px-4 sm:px-6 py-3.5 bg-slate-50/90 border-b border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-blue-600" />
              <h3 className="font-bold text-xs uppercase text-slate-900 tracking-wide">My Team Members Roster</h3>
            </div>
            <span className="text-[11px] text-slate-500">
              Active &bull; Present &bull; Work Commits indicators
            </span>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs text-slate-700">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200/80 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-center">Today's Commits / Active Tasks</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {supervisorTeam.map((emp) => {
                  const isPresent = Boolean(emp.is_present);
                  const isIdle = Boolean(emp.is_idle);
                  const activeTasks = emp.active_tasks_count || emp.active_daily_tasks || 0;
                  const dailyCommits = emp.active_daily_tasks || 0;

                  return (
                    <tr key={emp.id} className="hover:bg-blue-50/40 transition duration-150">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-bold text-slate-900">{emp.name || emp.username}</div>
                            <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                              {emp.designation || 'Staff'}
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider shrink-0 ${getRoleBadgeStyle(emp.role)}`}>
                            {emp.role || 'EMPLOYEE'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        {renderMultiColorThreeDots(true, isPresent, dailyCommits)}
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono">
                        <span className="text-blue-700 font-bold">{dailyCommits}</span>
                        <span className="text-slate-400"> / {activeTasks}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isIdle && (
                            <button
                              type="button"
                              onClick={() => {
                                setAssignModalUserId(emp.id);
                                setIsCreateTaskOpen(true);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white px-3 py-1 rounded-xl transition shadow-[0_3px_10px_rgba(37,99,235,0.25)] cursor-pointer"
                            >
                              <PlusCircle size={12} /> Assign Task
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openUserTasks(emp)}
                            className="text-xs text-blue-600 font-semibold hover:text-blue-800 hover:underline transition cursor-pointer"
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="md:hidden divide-y divide-slate-100">
            {supervisorTeam.map((emp) => {
              const isPresent = Boolean(emp.is_present);
              const isIdle = Boolean(emp.is_idle);
              const activeTasks = emp.active_tasks_count || emp.active_daily_tasks || 0;
              const dailyCommits = emp.active_daily_tasks || 0;

              return (
                <div key={emp.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{emp.name || emp.username}</h4>
                      <p className="text-[11px] text-slate-500">{emp.designation || 'Staff'}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${getRoleBadgeStyle(emp.role)}`}>
                      {emp.role || 'EMPLOYEE'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block mb-1">State:</span>
                      {renderMultiColorThreeDots(true, isPresent, dailyCommits)}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block mb-0.5">Commits / Active:</span>
                      <span className="font-mono text-blue-700 font-bold">{dailyCommits}</span>
                      <span className="font-mono text-slate-400 text-xs"> / {activeTasks}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    {isIdle && (
                      <button
                        type="button"
                        onClick={() => {
                          setAssignModalUserId(emp.id);
                          setIsCreateTaskOpen(true);
                        }}
                        className="flex-1 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 shadow-2xs"
                      >
                        <PlusCircle size={13} /> Assign
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openUserTasks(emp)}
                      className="flex-1 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-xs font-semibold hover:bg-blue-100 transition text-center"
                    >
                      View Tasks &rarr;
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-4 text-slate-800">
      {/* ===================== 1. TOP STATISTICAL KPI BANNER ===================== */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
        {/* Card 1: Aggregate Summary Card */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                Tasks & Commits Summary
              </span>
              <CalendarClock size={16} className="text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-slate-900 font-mono mt-1">
              {stats.totalCount} <span className="text-xs font-normal text-slate-400">Total</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block">Active Tasks</span>
              <span className="font-bold text-blue-700 font-mono text-base">{stats.activeTasksCount}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Today Commits</span>
              <span className="font-bold text-emerald-600 font-mono text-base">{stats.dailyCommitsCount}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Status Breakdown Grid */}
        <div className="md:col-span-3 bg-white p-5 rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
              Task Status Breakdown
            </span>
            <span className="text-[10px] text-slate-400 font-mono font-semibold">
              {viewMode === 'self' ? 'Personal Scope' : 'Operational Team Scope'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
            {/* 1. Pending Acceptance */}
            <div className="p-2.5 rounded-2xl bg-amber-50/70 border border-amber-200/80">
              <span className="text-[10px] font-bold text-amber-800 block truncate">Pending Accept</span>
              <span className="text-base font-bold text-amber-700 font-mono mt-0.5 block">
                {stats.statusCounts.REQUEST_PENDING}
              </span>
            </div>

            {/* 2. Accepted */}
            <div className="p-2.5 rounded-2xl bg-indigo-50/60 border border-indigo-200/70">
              <span className="text-[10px] font-bold text-indigo-800 block truncate">Accepted</span>
              <span className="text-base font-bold text-indigo-700 font-mono mt-0.5 block">
                {stats.statusCounts.ACCEPTED}
              </span>
            </div>

            {/* 3. In Progress */}
            <div className="p-2.5 rounded-2xl bg-blue-50/80 border border-blue-200/80">
              <span className="text-[10px] font-bold text-blue-800 block truncate">In Progress</span>
              <span className="text-base font-bold text-blue-700 font-mono mt-0.5 block">
                {stats.statusCounts.IN_PROGRESS}
              </span>
            </div>

            {/* 4. On Hold */}
            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-600 block truncate">On Hold</span>
              <span className="text-base font-bold text-slate-800 font-mono mt-0.5 block">
                {stats.statusCounts.ON_HOLD}
              </span>
            </div>

            {/* 5. Awaiting Verification */}
            <div className="p-2.5 rounded-2xl bg-sky-50/80 border border-sky-200/80">
              <span className="text-[10px] font-bold text-sky-800 block truncate">Awaiting Verify</span>
              <span className="text-base font-bold text-sky-700 font-mono mt-0.5 block">
                {stats.statusCounts.AWAITING_VERIFICATION}
              </span>
            </div>

            {/* 6. Verified / Done */}
            <div className="p-2.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
              <span className="text-[10px] font-bold text-emerald-800 block truncate">Verified / Done</span>
              <span className="text-base font-bold text-emerald-700 font-mono mt-0.5 block">
                {stats.statusCounts.VERIFIED}
              </span>
            </div>

            {/* 7. Cancelled */}
            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-500 block truncate">Cancelled</span>
              <span className="text-base font-bold text-slate-600 font-mono mt-0.5 block">
                {stats.statusCounts.CANCELLED}
              </span>
            </div>

            {/* 8. Rejected */}
            <div className="p-2.5 rounded-2xl bg-rose-50/70 border border-rose-200/80">
              <span className="text-[10px] font-bold text-rose-800 block truncate">Rejected</span>
              <span className="text-base font-bold text-rose-700 font-mono mt-0.5 block">
                {stats.statusCounts.REJECTED}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== 2. PERSPECTIVE TOGGLE & SWITCHER ===================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/95 backdrop-blur-md p-3.5 sm:p-4 rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)]">
        {/* Left: Self vs Team Toggle */}
        {hasToggle ? (
          <div className="inline-flex bg-slate-100 p-1 rounded-2xl border border-slate-200/80 text-xs">
            <button
              type="button"
              onClick={() => {
                setViewMode('self');
                setNavStack([{ level: 'ROOT', title: 'Overview' }]);
              }}
              className={`px-3.5 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
                viewMode === 'self' 
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-[0_3px_10px_rgba(37,99,235,0.25)]' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Self View
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('team');
                setNavStack([{ level: 'ROOT', title: 'Overview' }]);
              }}
              className={`px-3.5 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
                viewMode === 'team' 
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-[0_3px_10px_rgba(37,99,235,0.25)]' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Team View
            </button>
          </div>
        ) : (
          <div className="text-xs font-bold text-slate-900 tracking-wide">
            {isBaseEmployee ? 'Personal Tasks Backlog' : 'Organization Task Hub'}
          </div>
        )}

        {/* Right: Team Mode Switcher (Org-Wise vs Task-Wise) */}
        {viewMode === 'team' && (
          <div className="inline-flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200/80 text-xs">
            <button
              type="button"
              onClick={() => setTeamDisplayMode('ORG')}
              className={`px-3.5 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
                teamDisplayMode === 'ORG' 
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-[0_3px_10px_rgba(37,99,235,0.25)]' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Org Wise
            </button>
            <button
              type="button"
              onClick={() => setTeamDisplayMode('TASK')}
              className={`px-3.5 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
                teamDisplayMode === 'TASK' 
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-[0_3px_10px_rgba(37,99,235,0.25)]' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Task Wise
            </button>
          </div>
        )}
      </div>

      {/* ===================== 3. MAIN WORKSPACE CONTENT ===================== */}
      {viewMode === 'self' ? (
        <TaskTable
          tasks={activeTaskList}
          onOpenActionModal={onOpenActionModal}
          currentUser={currentUser}
          onRefresh={fetchModuleData}
          viewMode="self"
        />
      ) : teamDisplayMode === 'TASK' ? (
        /* Task-Wise Team View with Filter Pills */
        <div className="space-y-3">
          <div className="bg-white p-3.5 rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-700 flex items-center gap-1.5 mr-1">
                <ListFilter size={14} className="text-blue-600" /> Filter:
              </span>
              {[
                { id: 'ACTIVE', label: 'Active Tasks' },
                { id: 'ALL', label: 'All Tasks' },
                { id: 'OVERDUE', label: 'Overdue Only' },
                { id: 'COMMITTED', label: 'Today Committed' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setTaskFilterPill(pill.id)}
                  className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer text-xs ${
                    taskFilterPill === pill.id
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-[0_3px_10px_rgba(37,99,235,0.25)] border border-blue-500'
                      : 'bg-slate-50 text-slate-600 hover:text-blue-700 hover:bg-blue-50/60 border border-slate-200/80'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <span className="text-[11px] text-slate-500 font-mono">
              Showing {filteredTeamTasks.length} tasks
            </span>
          </div>

          <TaskTable
            tasks={filteredTeamTasks}
            onOpenActionModal={onOpenActionModal}
            currentUser={currentUser}
            onRefresh={fetchModuleData}
            viewMode="team"
          />
        </div>
      ) : (
        /* Org-Wise Hierarchical Navigation */
        <div className="space-y-4">
          {navStack.length > 1 && (
            <div className="flex items-center justify-between bg-white border border-slate-200/90 px-4 sm:px-5 py-3 rounded-2xl text-xs shadow-2xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                {navStack.map((step, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <ChevronRight size={13} className="text-slate-400 shrink-0" />}
                    {idx === navStack.length - 1 ? (
                      <span className="font-bold text-slate-900">{step.title}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleJumpToStep(idx)}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-semibold cursor-pointer transition"
                      >
                        {step.title}
                      </button>
                    )}
                  </React.Fragment>
                ))}
              </div>

              <button
                type="button"
                onClick={handleStepBack}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-50 border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 text-slate-700 hover:text-blue-700 font-semibold rounded-xl transition shrink-0 ml-3 cursor-pointer shadow-2xs"
              >
                <ArrowLeft size={13} /> Back
              </button>
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center text-xs text-slate-500 font-medium flex flex-col items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Loading organizational view...</span>
            </div>
          ) : (
            renderCurrentView()
          )}
        </div>
      )}

      {/* Quick Task Creation Modal */}
      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        onClose={() => {
          setIsCreateTaskOpen(false);
          setAssignModalUserId(null);
        }}
        onTaskCreated={() => fetchModuleData()}
        currentUser={currentUser}
        defaultAssignedToUserId={assignModalUserId}
      />
    </div>
  );
}