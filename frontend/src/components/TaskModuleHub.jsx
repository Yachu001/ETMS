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
  Eye, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
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
        return 'bg-amber-500/20 text-amber-300 border-amber-400/50 shadow-[0_0_8px_rgba(245,158,11,0.15)]';
      case 'ADMIN':
        return 'bg-amber-500/10 text-amber-200 border-amber-400/35';
      case 'BUSINESS_ADMIN':
        return 'bg-[#181510] text-amber-300 border-amber-500/30';
      case 'DEPT_HEAD':
        return 'bg-[#181612] text-amber-200 border-amber-500/30';
      case 'SUPERVISOR':
        return 'bg-neutral-900 text-amber-300/90 border-amber-500/25';
      default:
        return 'bg-neutral-900/80 text-neutral-300 border-neutral-800';
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
          <span className={`h-2.5 w-2.5 rounded-full ${isActive ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : 'bg-neutral-600'}`}></span>
          <span className="text-[9px] text-neutral-400 font-medium mt-0.5">
            {isActive ? 'active' : 'inactive'}
          </span>
        </div>

        {/* Dot 2: Presence */}
        <div className="flex flex-col items-center">
          <span className={`h-2.5 w-2.5 rounded-full ${isPresent ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]' : 'bg-neutral-600'}`}></span>
          <span className="text-[9px] text-neutral-400 font-medium mt-0.5">
            {isPresent ? 'present' : 'off'}
          </span>
        </div>

        {/* Dot 3: Work / Commits Status */}
        <div className="flex flex-col items-center">
          {isIdle ? (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]"></span>
            </span>
          ) : (
            <span className={`h-2.5 w-2.5 rounded-full ${hasCommits ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : 'bg-neutral-600'}`}></span>
          )}
          <span className={`text-[9px] font-bold mt-0.5 ${
            isIdle ? 'text-rose-400' : (hasCommits ? 'text-emerald-400' : 'text-neutral-500')
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
          <div className="bg-[#141518] border border-amber-500/25 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs shadow-md">
            <span className="font-semibold text-neutral-200">
              Inspecting Tasks: <strong className="text-white">{targetUser.name || targetUser.username}</strong>
            </span>
            <span className="text-[11px] text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/30 font-medium">
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
        <div className="bg-[#0b0c0e] rounded-3xl border border-amber-400/50 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_20px_rgba(245,158,11,0.12)] overflow-hidden">
          <div className="px-4 sm:px-6 py-3.5 bg-[#141518] border-b border-amber-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-amber-400" />
              <h3 className="font-bold text-xs uppercase text-white tracking-wide">
                {selectedMatrix.name} — Branch Personnel Roster
              </h3>
            </div>
            <span className="text-[11px] text-amber-200/50">
              Row #1 is Matrix Supervisor; tap row to inspect tasks
            </span>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs text-neutral-300">
              <thead>
                <tr className="bg-[#141518]/70 border-b border-amber-500/15 text-amber-400/80 font-semibold text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-center">Today Commits / Active Tasks</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {selectedMatrix.roster?.map((mem) => {
                  const isSupervisor = Boolean(mem.is_supervisor);
                  const isPresent = Boolean(mem.is_present);
                  const activeTasks = mem.active_tasks_count || 0;
                  const dailyCommits = mem.daily_commits_count || 0;

                  return (
                    <tr 
                      key={mem.id} 
                      className={`hover:bg-amber-500/[0.04] transition duration-150 cursor-pointer ${
                        isSupervisor ? 'bg-amber-500/[0.06]' : ''
                      }`}
                      onClick={() => openUserTasks(mem)}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              {isSupervisor && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 uppercase tracking-wider">
                                  Lead
                                </span>
                              )}
                              <span>{mem.name || mem.username}</span>
                            </div>
                            <div className="text-[10px] text-neutral-400 font-normal mt-0.5">
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
                        <span className="text-amber-300 font-bold">{dailyCommits}</span>
                        <span className="text-neutral-500"> / {activeTasks}</span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          className="text-xs font-semibold text-amber-400 hover:text-white transition cursor-pointer"
                        >
                          Inspect Tasks →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Touch Card Stack */}
          <div className="md:hidden divide-y divide-white/5">
            {selectedMatrix.roster?.map((mem) => {
              const isSupervisor = Boolean(mem.is_supervisor);
              const isPresent = Boolean(mem.is_present);
              const activeTasks = mem.active_tasks_count || 0;
              const dailyCommits = mem.daily_commits_count || 0;

              return (
                <div 
                  key={mem.id}
                  onClick={() => openUserTasks(mem)}
                  className={`p-4 space-y-3 cursor-pointer hover:bg-amber-500/[0.04] transition ${
                    isSupervisor ? 'bg-amber-500/[0.05]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-1.5">
                        {isSupervisor && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 uppercase">
                            Lead
                          </span>
                        )}
                        <span>{mem.name || mem.username}</span>
                      </div>
                      <p className="text-[11px] text-neutral-400">{mem.designation || 'Staff'}</p>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider shrink-0 ${getRoleBadgeStyle(mem.role)}`}>
                      {mem.role || 'EMPLOYEE'}
                    </span>
                  </div>

                  <div className="bg-[#141518] p-3 rounded-2xl border border-amber-500/15 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-neutral-400 block mb-1">State:</span>
                      {renderMultiColorThreeDots(mem.is_active, isPresent, dailyCommits)}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-neutral-400 block mb-0.5">Commits / Active:</span>
                      <span className="font-mono text-sm font-bold text-amber-300">{dailyCommits}</span>
                      <span className="text-neutral-500 text-xs font-mono"> / {activeTasks}</span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <span className="text-xs font-semibold text-amber-400 inline-flex items-center gap-1">
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
        <div className="bg-[#0b0c0e] rounded-3xl border border-amber-400/50 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_20px_rgba(245,158,11,0.12)] overflow-hidden">
          <div className="px-4 sm:px-6 py-3.5 bg-[#141518] border-b border-amber-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-amber-400" />
              <h3 className="font-bold text-xs uppercase text-white tracking-wide">
                {currentStep.title} ({filteredMatrices.length})
              </h3>
            </div>
            <span className="text-[11px] text-amber-200/50">Select a matrix to inspect its roster</span>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs text-neutral-300">
              <thead>
                <tr className="bg-[#141518]/70 border-b border-amber-500/15 text-amber-400/80 font-semibold text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-4">Matrix Branch</th>
                  <th className="py-3 px-3">Incharge</th>
                  <th className="py-3 px-3 text-center">Present / Active</th>
                  <th className="py-3 px-3 text-center">Daily Commits / Active Tasks</th>
                  <th className="py-3 px-3 text-center">Overdues</th>
                  <th className="py-3 px-3 text-center">Idle Users</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {filteredMatrices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-neutral-500">
                      No matrix branches found under this entity.
                    </td>
                  </tr>
                ) : (
                  filteredMatrices.map((m) => (
                    <tr 
                      key={m.id} 
                      onClick={() => openMatrixRoster(m)}
                      className="hover:bg-amber-500/[0.04] transition duration-150 cursor-pointer"
                    >
                      <td className="py-3.5 px-4 font-bold text-white tracking-wide">{m.name}</td>
                      <td className="py-3.5 px-3 text-neutral-200">{m.supervisor_name}</td>
                      <td className="py-3.5 px-3 text-center font-mono">
                        <span className="text-emerald-400 font-bold">{m.present_count}</span>
                        <span className="text-neutral-500"> / {m.total_members}</span>
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono">
                        <span className="text-amber-300 font-bold">{m.daily_commits_count || 0}</span>
                        <span className="text-neutral-500"> / {m.total_active_tasks || 0}</span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {(m.overdues_count || 0) > 0 ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-950/40 border border-rose-500/40 text-rose-400 text-[10px] font-bold">
                            {m.overdues_count}
                          </span>
                        ) : (
                          <span className="text-neutral-500 font-mono">0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {(m.idle_count || 0) > 0 ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold">
                            {m.idle_count}
                          </span>
                        ) : (
                          <span className="text-neutral-500 font-mono">0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button type="button" className="text-amber-400 font-semibold hover:text-white transition cursor-pointer">
                          View Roster →
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Touch Card Stack */}
          <div className="md:hidden divide-y divide-white/5">
            {filteredMatrices.length === 0 ? (
              <div className="py-10 text-center text-neutral-500 text-xs">
                No matrix branches found under this entity.
              </div>
            ) : (
              filteredMatrices.map((m) => (
                <div 
                  key={m.id}
                  onClick={() => openMatrixRoster(m)}
                  className="p-4 space-y-3 cursor-pointer hover:bg-amber-500/[0.04] transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-white text-sm">{m.name}</h4>
                      <p className="text-[11px] text-amber-200/50 mt-0.5">Lead: {m.supervisor_name}</p>
                    </div>
                    <span className="text-[10px] text-amber-400 font-semibold inline-flex items-center gap-1">
                      Roster <ChevronRight size={13} />
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-[#141518] p-2.5 rounded-xl border border-amber-500/15">
                      <span className="text-[10px] text-neutral-400 block">Present / Active:</span>
                      <span className="font-mono text-emerald-400 font-bold">{m.present_count}</span>
                      <span className="font-mono text-neutral-500 text-[11px]"> / {m.total_members}</span>
                    </div>

                    <div className="bg-[#141518] p-2.5 rounded-xl border border-amber-500/15">
                      <span className="text-[10px] text-neutral-400 block">Commits / Active:</span>
                      <span className="font-mono text-amber-300 font-bold">{m.daily_commits_count || 0}</span>
                      <span className="font-mono text-neutral-500 text-[11px]"> / {m.total_active_tasks || 0}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="flex items-center gap-2">
                      {(m.overdues_count || 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-950/40 border border-rose-500/40 text-rose-400 text-[10px] font-bold">
                          {m.overdues_count} Overdue
                        </span>
                      )}
                      {(m.idle_count || 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold">
                          {m.idle_count} Idle
                        </span>
                      )}
                    </div>
                    <span className="text-neutral-500 text-[11px]">Tap to inspect</span>
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
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap tracking-wide ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold shadow-[0_0_15px_rgba(212,175,55,0.25)] border border-amber-400'
                      : 'bg-[#141518] text-neutral-400 hover:text-white border border-transparent hover:border-amber-500/20'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-black' : 'text-amber-400'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB: BUSINESS */}
          {adminActiveTab === 'BUSINESS' && (
            <div className="bg-[#0b0c0e] rounded-3xl border border-amber-400/50 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_20px_rgba(245,158,11,0.12)] overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse text-neutral-300">
                  <thead>
                    <tr className="bg-[#141518] border-b border-amber-500/20 text-amber-400/80 font-semibold text-[10px] uppercase tracking-wider">
                      <th className="py-3.5 px-4">Business</th>
                      <th className="py-3.5 px-3 text-center">Present / Active Members</th>
                      <th className="py-3.5 px-3 text-center">Daily Commits / Active Tasks</th>
                      <th className="py-3.5 px-3 text-center">Overdues Count</th>
                      <th className="py-3.5 px-3 text-center">Idle User Count</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-medium">
                    {rootData.businesses?.map((b) => (
                      <tr 
                        key={b.id} 
                        onClick={() => openEntityMatrices('BUSINESS', b)}
                        className="hover:bg-amber-500/[0.04] transition duration-150 cursor-pointer"
                      >
                        <td className="py-3.5 px-4 font-bold text-white tracking-wide">
                          {b.name} <span className="text-[10px] text-amber-200/50 font-mono">({b.code})</span>
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono font-semibold text-neutral-200">
                          {b.present_active_members || '—'}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono font-semibold text-amber-300">
                          {b.daily_commits_active_tasks || '—'}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          {b.overdues_count > 0 ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-950/40 border border-rose-500/40 text-rose-400 text-[10px] font-bold">
                              {b.overdues_count}
                            </span>
                          ) : (
                            <span className="text-neutral-500 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          {b.idle_user_count > 0 ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold">
                              {b.idle_user_count}
                            </span>
                          ) : (
                            <span className="text-neutral-500 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button type="button" className="text-amber-400 font-semibold hover:text-white transition cursor-pointer">
                            View Matrices →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden divide-y divide-white/5">
                {rootData.businesses?.map((b) => (
                  <div 
                    key={b.id}
                    onClick={() => openEntityMatrices('BUSINESS', b)}
                    className="p-4 space-y-3 cursor-pointer hover:bg-amber-500/[0.04] transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-white text-sm">
                          {b.name} <span className="text-[10px] text-amber-200/50 font-mono">({b.code})</span>
                        </h4>
                        <p className="text-[11px] text-neutral-400 mt-0.5">Corporate Operating Entity</p>
                      </div>
                      <span className="text-[10px] text-amber-400 font-semibold inline-flex items-center gap-1">
                        Matrices <ChevronRight size={13} />
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-[#141518] p-2.5 rounded-xl border border-amber-500/15">
                        <span className="text-[10px] text-neutral-400 block">Members:</span>
                        <span className="font-mono text-white font-bold">{b.present_active_members || '—'}</span>
                      </div>
                      <div className="bg-[#141518] p-2.5 rounded-xl border border-amber-500/15">
                        <span className="text-[10px] text-neutral-400 block">Commits / Active:</span>
                        <span className="font-mono text-amber-300 font-bold">{b.daily_commits_active_tasks || '—'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: DEPARTMENT */}
          {adminActiveTab === 'DEPARTMENT' && (
            <div className="bg-[#0b0c0e] rounded-3xl border border-amber-400/50 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_20px_rgba(245,158,11,0.12)] overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse text-neutral-300">
                  <thead>
                    <tr className="bg-[#141518] border-b border-amber-500/20 text-amber-400/80 font-semibold text-[10px] uppercase tracking-wider">
                      <th className="py-3.5 px-4">Department</th>
                      <th className="py-3.5 px-3 text-center">Present / Active Members</th>
                      <th className="py-3.5 px-3 text-center">Daily Commits / Active Tasks</th>
                      <th className="py-3.5 px-3 text-center">Overdues Count</th>
                      <th className="py-3.5 px-3 text-center">Idle User Count</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-medium">
                    {rootData.departments?.map((d) => (
                      <tr 
                        key={d.id} 
                        onClick={() => openEntityMatrices('DEPARTMENT', d)}
                        className="hover:bg-amber-500/[0.04] transition duration-150 cursor-pointer"
                      >
                        <td className="py-3.5 px-4 font-bold text-white tracking-wide">
                          {d.name} <span className="text-[10px] text-amber-200/50 font-mono">({d.code})</span>
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono font-semibold text-neutral-200">
                          {d.present_active_members || '—'}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono font-semibold text-amber-300">
                          {d.daily_commits_active_tasks || '—'}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          {d.overdues_count > 0 ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-950/40 border border-rose-500/40 text-rose-400 text-[10px] font-bold">
                              {d.overdues_count}
                            </span>
                          ) : (
                            <span className="text-neutral-500 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          {d.idle_user_count > 0 ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold">
                              {d.idle_user_count}
                            </span>
                          ) : (
                            <span className="text-neutral-500 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button type="button" className="text-amber-400 font-semibold hover:text-white transition cursor-pointer">
                            View Matrices →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden divide-y divide-white/5">
                {rootData.departments?.map((d) => (
                  <div 
                    key={d.id}
                    onClick={() => openEntityMatrices('DEPARTMENT', d)}
                    className="p-4 space-y-3 cursor-pointer hover:bg-amber-500/[0.04] transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-white text-sm">
                          {d.name} <span className="text-[10px] text-amber-200/50 font-mono">({d.code})</span>
                        </h4>
                        <p className="text-[11px] text-neutral-400 mt-0.5">Functional Department</p>
                      </div>
                      <span className="text-[10px] text-amber-400 font-semibold inline-flex items-center gap-1">
                        Matrices <ChevronRight size={13} />
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-[#141518] p-2.5 rounded-xl border border-amber-500/15">
                        <span className="text-[10px] text-neutral-400 block">Members:</span>
                        <span className="font-mono text-white font-bold">{d.present_active_members || '—'}</span>
                      </div>
                      <div className="bg-[#141518] p-2.5 rounded-xl border border-amber-500/15">
                        <span className="text-[10px] text-neutral-400 block">Commits / Active:</span>
                        <span className="font-mono text-amber-300 font-bold">{d.daily_commits_active_tasks || '—'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: BUS ADMINS */}
          {adminActiveTab === 'BUS_ADMINS' && (
            <div className="bg-[#0b0c0e] rounded-3xl border border-amber-400/50 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_20px_rgba(245,158,11,0.12)] overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse text-neutral-300">
                  <thead>
                    <tr className="bg-[#141518] border-b border-amber-500/20 text-amber-400/80 font-semibold text-[10px] uppercase tracking-wider">
                      <th className="py-3.5 px-4">Name</th>
                      <th className="py-3.5 px-3">Business</th>
                      <th className="py-3.5 px-3">Status</th>
                      <th className="py-3.5 px-3 text-center">Daily Commits / Active Tasks</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-medium">
                    {rootData.business_admins?.map((ba) => (
                      <tr key={ba.id} className="hover:bg-amber-500/[0.04] transition duration-150">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-white">{ba.name}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getRoleBadgeStyle(ba.role)}`}>
                              {ba.role}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-neutral-200">{ba.business_name}</td>
                        <td className="py-3.5 px-3">
                          {renderMultiColorThreeDots(ba.is_active, ba.is_present, ba.daily_commits)}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono">
                          <span className="text-amber-300 font-bold">{ba.daily_commits || 0}</span>
                          <span className="text-neutral-500"> / {ba.active_tasks || 0}</span>
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
                                className="inline-flex items-center gap-1 text-[11px] font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black px-2.5 py-1 rounded-xl transition shadow-[0_0_10px_rgba(212,175,55,0.25)]"
                              >
                                <PlusCircle size={12} /> Assign Task
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openUserTasks(ba)}
                              className="text-xs text-amber-400 font-semibold hover:text-white transition"
                            >
                              View Tasks →
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden divide-y divide-white/5">
                {rootData.business_admins?.map((ba) => (
                  <div key={ba.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-white text-sm">{ba.name}</h4>
                        <p className="text-[11px] text-amber-200/50 mt-0.5">{ba.business_name}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getRoleBadgeStyle(ba.role)}`}>
                        {ba.role}
                      </span>
                    </div>

                    <div className="bg-[#141518] p-3 rounded-2xl border border-amber-500/15 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-neutral-400 block mb-1">Status:</span>
                        {renderMultiColorThreeDots(ba.is_active, ba.is_present, ba.daily_commits)}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-neutral-400 block mb-0.5">Commits / Active:</span>
                        <span className="font-mono text-amber-300 font-bold">{ba.daily_commits || 0}</span>
                        <span className="font-mono text-neutral-500 text-xs"> / {ba.active_tasks || 0}</span>
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
                          className="flex-1 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-black rounded-xl text-xs font-semibold flex items-center justify-center gap-1 shadow-sm"
                        >
                          <PlusCircle size={13} /> Assign
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openUserTasks(ba)}
                        className="flex-1 py-1.5 bg-[#141518] border border-amber-500/30 text-amber-300 rounded-xl text-xs font-semibold hover:bg-amber-500/15 transition text-center"
                      >
                        View Tasks →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: DEPT ADMINS */}
          {adminActiveTab === 'DEPT_ADMINS' && (
            <div className="bg-[#0b0c0e] rounded-3xl border border-amber-400/50 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_20px_rgba(245,158,11,0.12)] overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse text-neutral-300">
                  <thead>
                    <tr className="bg-[#141518] border-b border-amber-500/20 text-amber-400/80 font-semibold text-[10px] uppercase tracking-wider">
                      <th className="py-3.5 px-4">Name</th>
                      <th className="py-3.5 px-3">Department</th>
                      <th className="py-3.5 px-3">Status</th>
                      <th className="py-3.5 px-3 text-center">Daily Commits / Active Tasks</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-medium">
                    {rootData.dept_admins?.map((da) => (
                      <tr key={da.id} className="hover:bg-amber-500/[0.04] transition duration-150">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-white">{da.name}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getRoleBadgeStyle(da.role)}`}>
                              {da.role}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-neutral-200">{da.department_name}</td>
                        <td className="py-3.5 px-3">
                          {renderMultiColorThreeDots(da.is_active, da.is_present, da.daily_commits)}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono">
                          <span className="text-amber-300 font-bold">{da.daily_commits || 0}</span>
                          <span className="text-neutral-500"> / {da.active_tasks || 0}</span>
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
                                className="inline-flex items-center gap-1 text-[11px] font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black px-2.5 py-1 rounded-xl transition shadow-[0_0_10px_rgba(212,175,55,0.25)]"
                              >
                                <PlusCircle size={12} /> Assign Task
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openUserTasks(da)}
                              className="text-xs text-amber-400 font-semibold hover:text-white transition"
                            >
                              View Tasks →
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden divide-y divide-white/5">
                {rootData.dept_admins?.map((da) => (
                  <div key={da.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-white text-sm">{da.name}</h4>
                        <p className="text-[11px] text-amber-200/50 mt-0.5">{da.department_name}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getRoleBadgeStyle(da.role)}`}>
                        {da.role}
                      </span>
                    </div>

                    <div className="bg-[#141518] p-3 rounded-2xl border border-amber-500/15 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-neutral-400 block mb-1">Status:</span>
                        {renderMultiColorThreeDots(da.is_active, da.is_present, da.daily_commits)}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-neutral-400 block mb-0.5">Commits / Active:</span>
                        <span className="font-mono text-amber-300 font-bold">{da.daily_commits || 0}</span>
                        <span className="font-mono text-neutral-500 text-xs"> / {da.active_tasks || 0}</span>
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
                          className="flex-1 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-black rounded-xl text-xs font-semibold flex items-center justify-center gap-1 shadow-sm"
                        >
                          <PlusCircle size={13} /> Assign
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openUserTasks(da)}
                        className="flex-1 py-1.5 bg-[#141518] border border-amber-500/30 text-amber-300 rounded-xl text-xs font-semibold hover:bg-amber-500/15 transition text-center"
                      >
                        View Tasks →
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
        <div className="bg-[#0b0c0e] rounded-3xl border border-amber-400/50 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_20px_rgba(245,158,11,0.12)] overflow-hidden">
          <div className="px-4 sm:px-6 py-3.5 bg-[#141518] border-b border-amber-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-amber-400" />
              <h3 className="font-bold text-xs uppercase text-white tracking-wide">
                {role === 'BUSINESS_ADMIN' ? 'Business Matrix Branches' : 'Department Matrix Branches'}
              </h3>
            </div>
            <span className="text-[11px] text-amber-200/50">
              Tap branch to inspect personnel roster (Supervisor pinned at Row #1)
            </span>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs text-neutral-300">
              <thead>
                <tr className="bg-[#141518]/70 border-b border-amber-500/15 text-amber-400/80 font-semibold text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-4">Matrix Name</th>
                  <th className="py-3 px-3">Incharge</th>
                  <th className="py-3 px-3 text-center">Present / Active Users</th>
                  <th className="py-3 px-3 text-center">Daily Commits / Total Active</th>
                  <th className="py-3 px-3 text-center">Overdues Count</th>
                  <th className="py-3 px-3 text-center">Idle Users Count</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {matrices.map((m) => (
                  <tr 
                    key={m.id} 
                    onClick={() => openMatrixRoster(m)}
                    className="hover:bg-amber-500/[0.04] transition duration-150 cursor-pointer"
                  >
                    <td className="py-3.5 px-4 font-bold text-white tracking-wide">{m.name}</td>
                    <td className="py-3.5 px-3 text-neutral-200">{m.supervisor_name}</td>
                    <td className="py-3.5 px-3 text-center font-mono">
                      <span className="text-emerald-400 font-bold">{m.present_count}</span>
                      <span className="text-neutral-500"> / {m.total_members}</span>
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono">
                      <span className="text-amber-300 font-bold">{m.daily_commits_count || 0}</span>
                      <span className="text-neutral-500"> / {m.total_active_tasks || 0}</span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      {(m.overdues_count || 0) > 0 ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-950/40 border border-rose-500/40 text-rose-400 text-[10px] font-bold">
                          {m.overdues_count}
                        </span>
                      ) : (
                        <span className="text-neutral-500 font-mono">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      {(m.idle_count || 0) > 0 ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold">
                          {m.idle_count}
                        </span>
                      ) : (
                        <span className="text-neutral-500 font-mono">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button type="button" className="text-amber-400 font-semibold hover:text-white transition cursor-pointer">
                        View Roster →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="md:hidden divide-y divide-white/5">
            {matrices.map((m) => (
              <div 
                key={m.id}
                onClick={() => openMatrixRoster(m)}
                className="p-4 space-y-3 cursor-pointer hover:bg-amber-500/[0.04] transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-white text-sm">{m.name}</h4>
                    <p className="text-[11px] text-amber-200/50 mt-0.5">Lead: {m.supervisor_name}</p>
                  </div>
                  <span className="text-[10px] text-amber-400 font-semibold inline-flex items-center gap-1">
                    Roster <ChevronRight size={13} />
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-[#141518] p-2.5 rounded-xl border border-amber-500/15">
                    <span className="text-[10px] text-neutral-400 block">Members:</span>
                    <span className="font-mono text-emerald-400 font-bold">{m.present_count}</span>
                    <span className="font-mono text-neutral-500 text-[11px]"> / {m.total_members}</span>
                  </div>
                  <div className="bg-[#141518] p-2.5 rounded-xl border border-amber-500/15">
                    <span className="text-[10px] text-neutral-400 block">Commits:</span>
                    <span className="font-mono text-amber-300 font-bold">{m.daily_commits_count || 0}</span>
                    <span className="font-mono text-neutral-500 text-[11px]"> / {m.total_active_tasks || 0}</span>
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
        <div className="bg-[#0b0c0e] rounded-3xl border border-amber-400/50 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_20px_rgba(245,158,11,0.12)] overflow-hidden">
          <div className="px-4 sm:px-6 py-3.5 bg-[#141518] border-b border-amber-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-amber-400" />
              <h3 className="font-bold text-xs uppercase text-white tracking-wide">My Team Members Roster</h3>
            </div>
            <span className="text-[11px] text-amber-200/50">
              Active • Present • Work Commits indicators
            </span>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs text-neutral-300">
              <thead>
                <tr className="bg-[#141518]/70 border-b border-amber-500/15 text-amber-400/80 font-semibold text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-center">Today's Commits / Active Tasks</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {supervisorTeam.map((emp) => {
                  const isPresent = Boolean(emp.is_present);
                  const isIdle = Boolean(emp.is_idle);
                  const activeTasks = emp.active_tasks_count || emp.active_daily_tasks || 0;
                  const dailyCommits = emp.active_daily_tasks || 0;

                  return (
                    <tr key={emp.id} className="hover:bg-amber-500/[0.04] transition duration-150">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-bold text-white">{emp.name || emp.username}</div>
                            <div className="text-[10px] text-neutral-400 font-normal mt-0.5">
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
                        <span className="text-amber-300 font-bold">{dailyCommits}</span>
                        <span className="text-neutral-500"> / {activeTasks}</span>
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
                              className="inline-flex items-center gap-1 text-[11px] font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black px-2.5 py-1 rounded-xl transition shadow-[0_0_10px_rgba(212,175,55,0.25)]"
                            >
                              <PlusCircle size={12} /> Assign Task
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openUserTasks(emp)}
                            className="text-xs text-amber-400 font-semibold hover:text-white transition"
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
          <div className="md:hidden divide-y divide-white/5">
            {supervisorTeam.map((emp) => {
              const isPresent = Boolean(emp.is_present);
              const isIdle = Boolean(emp.is_idle);
              const activeTasks = emp.active_tasks_count || emp.active_daily_tasks || 0;
              const dailyCommits = emp.active_daily_tasks || 0;

              return (
                <div key={emp.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-white text-sm">{emp.name || emp.username}</h4>
                      <p className="text-[11px] text-neutral-400">{emp.designation || 'Staff'}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getRoleBadgeStyle(emp.role)}`}>
                      {emp.role || 'EMPLOYEE'}
                    </span>
                  </div>

                  <div className="bg-[#141518] p-3 rounded-2xl border border-amber-500/15 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-neutral-400 block mb-1">State:</span>
                      {renderMultiColorThreeDots(true, isPresent, dailyCommits)}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-neutral-400 block mb-0.5">Commits / Active:</span>
                      <span className="font-mono text-amber-300 font-bold">{dailyCommits}</span>
                      <span className="font-mono text-neutral-500 text-xs"> / {activeTasks}</span>
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
                        className="flex-1 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-black rounded-xl text-xs font-semibold flex items-center justify-center gap-1 shadow-sm"
                      >
                        <PlusCircle size={13} /> Assign
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openUserTasks(emp)}
                      className="flex-1 py-1.5 bg-[#141518] border border-amber-500/30 text-amber-300 rounded-xl text-xs font-semibold hover:bg-amber-500/15 transition text-center"
                    >
                      View Tasks →
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
    <div className="space-y-4 text-neutral-200">
      {/* ===================== 1. TOP STATISTICAL KPI BANNER ===================== */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
        {/* Card 1: Aggregate Summary Card */}
        <div className="bg-[#0b0c0e] p-5 rounded-3xl border border-amber-400/50 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_20px_rgba(245,158,11,0.12)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                Tasks & Commits Summary
              </span>
              <CalendarClock size={16} className="text-amber-400" />
            </div>
            <div className="text-3xl font-bold text-white font-mono mt-1">
              {stats.totalCount} <span className="text-xs font-normal text-neutral-400">Total</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-amber-500/15 text-xs">
            <div>
              <span className="text-[10px] text-neutral-400 block">Active Tasks</span>
              <span className="font-bold text-amber-300 font-mono text-base">{stats.activeTasksCount}</span>
            </div>
            <div>
              <span className="text-[10px] text-neutral-400 block">Today Commits</span>
              <span className="font-bold text-emerald-400 font-mono text-base">{stats.dailyCommitsCount}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Status Breakdown Grid */}
        <div className="md:col-span-3 bg-[#0b0c0e] p-5 rounded-3xl border border-amber-400/50 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_20px_rgba(245,158,11,0.12)]">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
              Task Status Breakdown
            </span>
            <span className="text-[10px] text-amber-200/50 font-mono">
              {viewMode === 'self' ? 'Personal Scope' : 'Operational Team Scope'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
            {/* 1. Pending Acceptance */}
            <div className="p-2.5 rounded-2xl bg-[#141518] border border-amber-500/25">
              <span className="text-[10px] font-bold text-amber-300 block truncate">Pending Accept</span>
              <span className="text-base font-bold text-amber-400 font-mono mt-0.5 block">
                {stats.statusCounts.REQUEST_PENDING}
              </span>
            </div>

            {/* 2. Accepted */}
            <div className="p-2.5 rounded-2xl bg-[#141518] border border-white/5">
              <span className="text-[10px] font-bold text-neutral-300 block truncate">Accepted</span>
              <span className="text-base font-bold text-white font-mono mt-0.5 block">
                {stats.statusCounts.ACCEPTED}
              </span>
            </div>

            {/* 3. In Progress */}
            <div className="p-2.5 rounded-2xl bg-[#141518] border border-amber-500/20">
              <span className="text-[10px] font-bold text-amber-200 block truncate">In Progress</span>
              <span className="text-base font-bold text-amber-300 font-mono mt-0.5 block">
                {stats.statusCounts.IN_PROGRESS}
              </span>
            </div>

            {/* 4. On Hold */}
            <div className="p-2.5 rounded-2xl bg-[#141518] border border-white/5">
              <span className="text-[10px] font-bold text-neutral-400 block truncate">On Hold</span>
              <span className="text-base font-bold text-neutral-300 font-mono mt-0.5 block">
                {stats.statusCounts.ON_HOLD}
              </span>
            </div>

            {/* 5. Awaiting Verification */}
            <div className="p-2.5 rounded-2xl bg-[#141518] border border-amber-500/25">
              <span className="text-[10px] font-bold text-amber-300 block truncate">Awaiting Verify</span>
              <span className="text-base font-bold text-amber-400 font-mono mt-0.5 block">
                {stats.statusCounts.AWAITING_VERIFICATION}
              </span>
            </div>

            {/* 6. Verified / Done */}
            <div className="p-2.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30">
              <span className="text-[10px] font-bold text-emerald-400 block truncate">Verified / Done</span>
              <span className="text-base font-bold text-emerald-300 font-mono mt-0.5 block">
                {stats.statusCounts.VERIFIED}
              </span>
            </div>

            {/* 7. Cancelled */}
            <div className="p-2.5 rounded-2xl bg-[#141518] border border-white/5">
              <span className="text-[10px] font-bold text-neutral-500 block truncate">Cancelled</span>
              <span className="text-base font-bold text-neutral-400 font-mono mt-0.5 block">
                {stats.statusCounts.CANCELLED}
              </span>
            </div>

            {/* 8. Rejected */}
            <div className="p-2.5 rounded-2xl bg-rose-950/20 border border-rose-500/30">
              <span className="text-[10px] font-bold text-rose-400 block truncate">Rejected</span>
              <span className="text-base font-bold text-rose-300 font-mono mt-0.5 block">
                {stats.statusCounts.REJECTED}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== 2. PERSPECTIVE TOGGLE & SWITCHER ===================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0b0c0e] p-3.5 sm:p-4 rounded-3xl border border-amber-400/50 shadow-md">
        {/* Left: Self vs Team Toggle */}
        {hasToggle ? (
          <div className="inline-flex bg-[#141518] p-1 rounded-2xl border border-amber-500/20 text-xs">
            <button
              type="button"
              onClick={() => {
                setViewMode('self');
                setNavStack([{ level: 'ROOT', title: 'Overview' }]);
              }}
              className={`px-3.5 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
                viewMode === 'self' 
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold shadow-[0_0_12px_rgba(212,175,55,0.25)]' 
                  : 'text-neutral-400 hover:text-white'
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
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold shadow-[0_0_12px_rgba(212,175,55,0.25)]' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Team View
            </button>
          </div>
        ) : (
          <div className="text-xs font-bold text-white tracking-wide">
            {isBaseEmployee ? 'Personal Tasks Backlog' : 'Organization Task Hub'}
          </div>
        )}

        {/* Right: Team Mode Switcher (Org-Wise vs Task-Wise) */}
        {viewMode === 'team' && (
          <div className="inline-flex items-center gap-1.5 bg-[#141518] p-1 rounded-2xl border border-amber-500/20 text-xs">
            <button
              type="button"
              onClick={() => setTeamDisplayMode('ORG')}
              className={`px-3.5 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
                teamDisplayMode === 'ORG' 
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold shadow-[0_0_12px_rgba(212,175,55,0.25)]' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Org Wise
            </button>
            <button
              type="button"
              onClick={() => setTeamDisplayMode('TASK')}
              className={`px-3.5 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
                teamDisplayMode === 'TASK' 
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold shadow-[0_0_12px_rgba(212,175,55,0.25)]' 
                  : 'text-neutral-400 hover:text-white'
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
          <div className="bg-[#0b0c0e] p-3.5 rounded-3xl border border-amber-400/40 shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-amber-300 flex items-center gap-1.5 mr-1">
                <ListFilter size={14} className="text-amber-400" /> Filter:
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
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-[0_0_12px_rgba(212,175,55,0.25)] border border-amber-400'
                      : 'bg-[#141518] text-neutral-400 hover:text-white border border-transparent hover:border-amber-500/20'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <span className="text-[11px] text-amber-200/50 font-mono">
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
            <div className="flex items-center justify-between bg-[#0b0c0e] border border-amber-400/40 px-4 sm:px-5 py-3 rounded-2xl text-xs shadow-md">
              <div className="flex items-center gap-1.5 flex-wrap">
                {navStack.map((step, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <ChevronRight size={13} className="text-amber-400/60 shrink-0" />}
                    {idx === navStack.length - 1 ? (
                      <span className="font-bold text-white">{step.title}</span>
                    ) : (
                      <button
                        onClick={() => handleJumpToStep(idx)}
                        className="text-amber-300 hover:text-white hover:underline font-semibold cursor-pointer transition"
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
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#141518] border border-amber-500/30 hover:border-amber-400/60 text-amber-200 hover:text-white font-semibold rounded-xl transition shrink-0 ml-3 cursor-pointer shadow-xs"
              >
                <ArrowLeft size={13} /> Back
              </button>
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center text-xs text-amber-200/50 flex flex-col items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
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