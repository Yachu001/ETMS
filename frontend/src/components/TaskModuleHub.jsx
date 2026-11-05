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
        // Strictly fetch tasks assigned to logged-in user
        const selfRes = await api.get('/tasks/?view_mode=self');
        setSelfTasksList(selfRes.data || []);
      } else {
        // Fetch team-wide tasks list
        const teamTasksRes = await api.get('/tasks/?view_mode=team');
        setTeamTasksList(teamTasksRes.data || []);

        // Fetch hierarchy structures according to management role tier
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
      case 'ADMIN':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'BUSINESS_ADMIN':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'DEPT_HEAD':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'SUPERVISOR':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Standardized Multi-Color 3-Dot Indicator with Captions
  const renderMultiColorThreeDots = (isActive, isPresent, dailyCommitsCount) => {
    const hasCommits = (dailyCommitsCount || 0) > 0;
    const isIdle = isPresent && !hasCommits;

    return (
      <div className="flex items-start gap-3">
        {/* Dot 1: Active Status */}
        <div className="flex flex-col items-center">
          <span className={`h-2.5 w-2.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
          <span className="text-[9px] text-slate-400 font-medium mt-0.5">
            {isActive ? 'active' : 'inactive'}
          </span>
        </div>

        {/* Dot 2: Presence */}
        <div className="flex flex-col items-center">
          <span className={`h-2.5 w-2.5 rounded-full ${isPresent ? 'bg-blue-500' : 'bg-slate-300'}`}></span>
          <span className="text-[9px] text-slate-400 font-medium mt-0.5">
            {isPresent ? 'present' : 'off'}
          </span>
        </div>

        {/* Dot 3: Work / Commits Status */}
        <div className="flex flex-col items-center">
          {isIdle ? (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
          ) : (
            <span className={`h-2.5 w-2.5 rounded-full ${hasCommits ? 'bg-emerald-600' : 'bg-slate-300'}`}></span>
          )}
          <span className={`text-[9px] font-bold mt-0.5 ${
            isIdle ? 'text-rose-600' : (hasCommits ? 'text-emerald-700' : 'text-slate-400')
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
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex justify-between items-center text-xs">
            <span className="font-semibold text-blue-900">
              Inspecting Tasks: <strong className="text-blue-700">{targetUser.name || targetUser.username}</strong>
            </span>
            <span className="text-[11px] text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200 font-medium">
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

    // LEVEL 2: MATRIX ROSTER (Supervisor pinned at Row #1)
    if (currentStep.level === 'MATRIX_ROSTER' && selectedMatrix) {
      return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-blue-600" />
              <h3 className="font-bold text-xs uppercase text-slate-800 tracking-wide">
                {selectedMatrix.name} — Branch Personnel Roster
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              Row #1 is Matrix Supervisor; click any row to inspect tasks
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-center">Today Commits / Active Tasks</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedMatrix.roster?.map((mem) => {
                  const isSupervisor = Boolean(mem.is_supervisor);
                  const isPresent = Boolean(mem.is_present);
                  const activeTasks = mem.active_tasks_count || 0;
                  const dailyCommits = mem.daily_commits_count || 0;

                  return (
                    <tr 
                      key={mem.id} 
                      className={`hover:bg-slate-50 transition cursor-pointer ${
                        isSupervisor ? 'bg-amber-50/40 font-medium' : ''
                      }`}
                      onClick={() => openUserTasks(mem)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              {isSupervisor && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 uppercase">
                                  Lead
                                </span>
                              )}
                              <span>{mem.name || mem.username}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-normal">
                              {mem.designation || 'Staff'}
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${getRoleBadgeStyle(mem.role)}`}>
                            {mem.role || 'EMPLOYEE'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        {renderMultiColorThreeDots(mem.is_active, isPresent, dailyCommits)}
                      </td>

                      <td className="py-3 px-3 text-center font-mono">
                        <span className="text-blue-700 font-semibold">{dailyCommits}</span>
                        <span className="text-slate-400"> / {activeTasks}</span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
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
        </div>
      );
    }

    // LEVEL 1: ENTITY MATRICES
    if (currentStep.level === 'ENTITY_MATRICES') {
      return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-blue-600" />
              <h3 className="font-bold text-xs uppercase text-slate-800">
                {currentStep.title} ({filteredMatrices.length})
              </h3>
            </div>
            <span className="text-[11px] text-slate-500">Click a matrix to inspect its roster</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Matrix Branch</th>
                  <th className="py-3 px-3">Incharge</th>
                  <th className="py-3 px-3 text-center">Present / Active</th>
                  <th className="py-3 px-3 text-center">Daily Commits / Active Tasks</th>
                  <th className="py-3 px-3 text-center">Overdues</th>
                  <th className="py-3 px-3 text-center">Idle Users</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMatrices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No matrix branches found under this entity.
                    </td>
                  </tr>
                ) : (
                  filteredMatrices.map((m) => (
                    <tr 
                      key={m.id} 
                      onClick={() => openMatrixRoster(m)}
                      className="hover:bg-slate-50 transition cursor-pointer"
                    >
                      <td className="py-3 px-4 font-semibold text-slate-900">{m.name}</td>
                      <td className="py-3 px-3 text-slate-700 font-medium">{m.supervisor_name}</td>
                      <td className="py-3 px-3 text-center font-mono">
                        <span className="text-emerald-700 font-semibold">{m.present_count}</span>
                        <span className="text-slate-400"> / {m.total_members}</span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        <span className="text-blue-700 font-semibold">{m.daily_commits_count || 0}</span>
                        <span className="text-slate-400"> / {m.total_active_tasks || 0}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {(m.overdues_count || 0) > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                            {m.overdues_count}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {(m.idle_count || 0) > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-[10px] font-bold">
                            {m.idle_count}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button type="button" className="text-blue-600 font-semibold hover:underline cursor-pointer">
                          View Roster →
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // LEVEL 0: ROOT TABLES (Admin & Super Admin)
    if (isExecutive) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-semibold">
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
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-2xs font-bold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {adminActiveTab === 'BUSINESS' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-4">Business</th>
                      <th className="py-3 px-3 text-center">Present / Active Members</th>
                      <th className="py-3 px-3 text-center">Daily Commits / Active Tasks</th>
                      <th className="py-3 px-3 text-center">Overdues Count</th>
                      <th className="py-3 px-3 text-center">Idle User Count</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rootData.businesses?.map((b) => (
                      <tr 
                        key={b.id} 
                        onClick={() => openEntityMatrices('BUSINESS', b)}
                        className="hover:bg-slate-50 transition cursor-pointer"
                      >
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {b.name} <span className="text-[10px] text-slate-400 font-mono">({b.code})</span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700">
                          {b.present_active_members || '—'}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-semibold text-blue-700">
                          {b.daily_commits_active_tasks || '—'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {b.overdues_count > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                              {b.overdues_count}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {b.idle_user_count > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-[10px] font-bold">
                              {b.idle_user_count}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button type="button" className="text-blue-600 font-semibold hover:underline cursor-pointer">
                            View Matrices →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {adminActiveTab === 'DEPARTMENT' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-3 text-center">Present / Active Members</th>
                      <th className="py-3 px-3 text-center">Daily Commits / Active Tasks</th>
                      <th className="py-3 px-3 text-center">Overdues Count</th>
                      <th className="py-3 px-3 text-center">Idle User Count</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rootData.departments?.map((d) => (
                      <tr 
                        key={d.id} 
                        onClick={() => openEntityMatrices('DEPARTMENT', d)}
                        className="hover:bg-slate-50 transition cursor-pointer"
                      >
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {d.name} <span className="text-[10px] text-slate-400 font-mono">({d.code})</span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700">
                          {d.present_active_members || '—'}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-semibold text-blue-700">
                          {d.daily_commits_active_tasks || '—'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {d.overdues_count > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                              {d.overdues_count}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {d.idle_user_count > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-[10px] font-bold">
                              {d.idle_user_count}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button type="button" className="text-blue-600 font-semibold hover:underline cursor-pointer">
                            View Matrices →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {adminActiveTab === 'BUS_ADMINS' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-4">Name</th>
                      <th className="py-3 px-3">Business</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-center">Daily Commits / Active Tasks</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rootData.business_admins?.map((ba) => (
                      <tr key={ba.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900">{ba.name}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getRoleBadgeStyle(ba.role)}`}>
                              {ba.role}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-medium">{ba.business_name}</td>
                        <td className="py-3 px-3">
                          {renderMultiColorThreeDots(ba.is_active, ba.is_present, ba.daily_commits)}
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          <span className="text-blue-700 font-semibold">{ba.daily_commits || 0}</span>
                          <span className="text-slate-400"> / {ba.active_tasks || 0}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {ba.is_idle && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAssignModalUserId(ba.id);
                                  setIsCreateTaskOpen(true);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded-lg transition"
                              >
                                <PlusCircle size={12} /> Assign Task
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openUserTasks(ba)}
                              className="text-xs text-blue-600 font-semibold hover:underline"
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
            </div>
          )}

          {adminActiveTab === 'DEPT_ADMINS' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-4">Name</th>
                      <th className="py-3 px-3">Department</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-center">Daily Commits / Active Tasks</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rootData.dept_admins?.map((da) => (
                      <tr key={da.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900">{da.name}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getRoleBadgeStyle(da.role)}`}>
                              {da.role}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-medium">{da.department_name}</td>
                        <td className="py-3 px-3">
                          {renderMultiColorThreeDots(da.is_active, da.is_present, da.daily_commits)}
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          <span className="text-blue-700 font-semibold">{da.daily_commits || 0}</span>
                          <span className="text-slate-400"> / {da.active_tasks || 0}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {da.is_idle && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAssignModalUserId(da.id);
                                  setIsCreateTaskOpen(true);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded-lg transition"
                              >
                                <PlusCircle size={12} /> Assign Task
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openUserTasks(da)}
                              className="text-xs text-blue-600 font-semibold hover:underline"
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
            </div>
          )}
        </div>
      );
    }

    // Business Admin & Department Admin
    if (role === 'BUSINESS_ADMIN' || role === 'DEPT_HEAD') {
      return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-blue-600" />
              <h3 className="font-bold text-xs uppercase text-slate-800">
                {role === 'BUSINESS_ADMIN' ? 'Business Matrix Branches' : 'Department Matrix Branches'}
              </h3>
            </div>
            <span className="text-[11px] text-slate-500">
              Click any branch to inspect personnel roster (Supervisor pinned at Row #1)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Matrix Name</th>
                  <th className="py-3 px-3">Incharge</th>
                  <th className="py-3 px-3 text-center">Present / Active Users</th>
                  <th className="py-3 px-3 text-center">Daily Commits / Total Active</th>
                  <th className="py-3 px-3 text-center">Overdues Count</th>
                  <th className="py-3 px-3 text-center">Idle Users Count</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matrices.map((m) => (
                  <tr 
                    key={m.id} 
                    onClick={() => openMatrixRoster(m)}
                    className="hover:bg-slate-50 transition cursor-pointer"
                  >
                    <td className="py-3 px-4 font-semibold text-slate-900">{m.name}</td>
                    <td className="py-3 px-3 text-slate-700 font-medium">{m.supervisor_name}</td>
                    <td className="py-3 px-3 text-center font-mono">
                      <span className="text-emerald-700 font-semibold">{m.present_count}</span>
                      <span className="text-slate-400"> / {m.total_members}</span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      <span className="text-blue-700 font-semibold">{m.daily_commits_count || 0}</span>
                      <span className="text-slate-400"> / {m.total_active_tasks || 0}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {(m.overdues_count || 0) > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                          {m.overdues_count}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">0</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {(m.idle_count || 0) > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-[10px] font-bold">
                          {m.idle_count}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button type="button" className="text-blue-600 font-semibold hover:underline cursor-pointer">
                        View Roster →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // Supervisor (Team Roster Table)
    if (role === 'SUPERVISOR') {
      return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-blue-600" />
              <h3 className="font-bold text-xs uppercase text-slate-800">My Team Members Roster</h3>
            </div>
            <span className="text-[11px] text-slate-500">
              Active • Present • Work Commits status indicators
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-center">Today's Commits / Active Tasks</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {supervisorTeam.map((emp) => {
                  const isPresent = Boolean(emp.is_present);
                  const isIdle = Boolean(emp.is_idle);
                  const activeTasks = emp.active_tasks_count || emp.active_daily_tasks || 0;
                  const dailyCommits = emp.active_daily_tasks || 0;

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-bold text-slate-900">{emp.name || emp.username}</div>
                            <div className="text-[10px] text-slate-400 font-normal">
                              {emp.designation || 'Staff'}
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${getRoleBadgeStyle(emp.role)}`}>
                            {emp.role || 'EMPLOYEE'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {renderMultiColorThreeDots(true, isPresent, dailyCommits)}
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        <span className="text-blue-700 font-semibold">{dailyCommits}</span>
                        <span className="text-slate-400"> / {activeTasks}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isIdle && (
                            <button
                              type="button"
                              onClick={() => {
                                setAssignModalUserId(emp.id);
                                setIsCreateTaskOpen(true);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-lg transition"
                            >
                              <PlusCircle size={12} /> Assign Task
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openUserTasks(emp)}
                            className="text-xs text-blue-600 font-semibold hover:underline"
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
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-4">
      {/* ===================== 1. TOP STATISTICAL KPI BANNER ===================== */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Card 1: Aggregate Summary Card */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                Tasks & Commits Summary
              </span>
              <CalendarClock size={16} className="text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {stats.totalCount} <span className="text-xs font-medium text-slate-400">Total Tasks</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block">Active Tasks</span>
              <span className="font-bold text-blue-700 font-mono text-sm">{stats.activeTasksCount}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Today Commits</span>
              <span className="font-bold text-emerald-600 font-mono text-sm">{stats.dailyCommitsCount}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Status Breakdown Grid (Span 3 Columns) */}
        <div className="md:col-span-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Task Status Breakdown
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {viewMode === 'self' ? 'Personal Scope' : 'Operational Team Scope'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
            {/* 1. Pending Acceptance */}
            <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200">
              <span className="text-[10px] font-bold text-amber-800 block truncate">Pending Accept</span>
              <span className="text-base font-bold text-amber-900 font-mono">
                {stats.statusCounts.REQUEST_PENDING}
              </span>
            </div>

            {/* 2. Accepted (Not Started) */}
            <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-200">
              <span className="text-[10px] font-bold text-sky-800 block truncate">Accepted</span>
              <span className="text-base font-bold text-sky-900 font-mono">
                {stats.statusCounts.ACCEPTED}
              </span>
            </div>

            {/* 3. In Progress */}
            <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200">
              <span className="text-[10px] font-bold text-blue-800 block truncate">In Progress</span>
              <span className="text-base font-bold text-blue-900 font-mono">
                {stats.statusCounts.IN_PROGRESS}
              </span>
            </div>

            {/* 4. On Hold */}
            <div className="p-2.5 rounded-xl bg-orange-50/70 border border-orange-200">
              <span className="text-[10px] font-bold text-orange-800 block truncate">On Hold</span>
              <span className="text-base font-bold text-orange-900 font-mono">
                {stats.statusCounts.ON_HOLD}
              </span>
            </div>

            {/* 5. Awaiting Verification */}
            <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200">
              <span className="text-[10px] font-bold text-purple-800 block truncate">Awaiting Verify</span>
              <span className="text-base font-bold text-purple-900 font-mono">
                {stats.statusCounts.AWAITING_VERIFICATION}
              </span>
            </div>

            {/* 6. Verified / Done */}
            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
              <span className="text-[10px] font-bold text-emerald-800 block truncate">Verified / Done</span>
              <span className="text-base font-bold text-emerald-900 font-mono">
                {stats.statusCounts.VERIFIED}
              </span>
            </div>

            {/* 7. Cancelled */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-600 block truncate">Cancelled</span>
              <span className="text-base font-bold text-slate-700 font-mono">
                {stats.statusCounts.CANCELLED}
              </span>
            </div>

            {/* 8. Rejected */}
            <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200">
              <span className="text-[10px] font-bold text-rose-800 block truncate">Rejected</span>
              <span className="text-base font-bold text-rose-900 font-mono">
                {stats.statusCounts.REJECTED}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== 2. PERSPECTIVE TOGGLE & SWITCHER ===================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        {/* Left: Self vs Team Toggle (if privileged role) */}
        {hasToggle ? (
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => {
                setViewMode('self');
                setNavStack([{ level: 'ROOT', title: 'Overview' }]);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                viewMode === 'self' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
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
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                viewMode === 'team' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Team View
            </button>
          </div>
        ) : (
          <div className="text-xs font-bold text-slate-800">
            {isBaseEmployee ? 'Personal Tasks Backlog' : 'Organization Task Hub'}
          </div>
        )}

        {/* Right: Team Mode Switcher (Task-Wise vs Org-Wise) */}
        {viewMode === 'team' && (
          <div className="inline-flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setTeamDisplayMode('ORG')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                teamDisplayMode === 'ORG' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Org Wise
            </button>
            <button
              type="button"
              onClick={() => setTeamDisplayMode('TASK')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                teamDisplayMode === 'TASK' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
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
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-slate-700 flex items-center gap-1 mr-2">
                <ListFilter size={14} className="text-slate-400" /> Filter:
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
                  className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                    taskFilterPill === pill.id
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <span className="text-[11px] text-slate-400 font-mono">
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
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                {navStack.map((step, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <ChevronRight size={14} className="text-slate-400 shrink-0" />}
                    {idx === navStack.length - 1 ? (
                      <span className="font-bold text-slate-800">{step.title}</span>
                    ) : (
                      <button
                        onClick={() => handleJumpToStep(idx)}
                        className="text-blue-600 hover:underline font-semibold cursor-pointer"
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
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg shadow-2xs transition shrink-0 ml-3 cursor-pointer"
              >
                <ArrowLeft size={14} /> Back
              </button>
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading organizational view...</div>
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