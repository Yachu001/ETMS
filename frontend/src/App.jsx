import React, { useState, useEffect } from 'react';
import api from './api/axios';
import Login from './pages/Login';

// Modals
import CreateUserModal from './components/CreateUserModal';
import OrgTreeViewer from './components/OrgTreeViewer';
import CreateTaskModal from './components/CreateTaskModal';
import TaskActionModal from './components/TaskActionModal';
import TaskTable from './components/TaskTable';
import AuditLogViewer from './components/AuditLogViewer';
import MorningPlannerModal from './components/MorningPlannerModal';
import AttendanceToggle from './components/AttendanceToggle';
import DepartmentManagementModal from './components/DepartmentManagementModal';

// Views & Sub-components
import TodaysCommitmentsTable from './components/TodaysCommitmentsTable';
import SupervisorTeamView from './components/SupervisorTeamView';
import AdminDepartmentsView from './components/AdminDepartmentsView';
import UserDetailView from './components/UserDetailView';
import PersonalProfileView from './components/PersonalProfileView';
import BusinessDeptMatrixView from './components/BusinessDeptMatrixView';
import UserManagementView from './components/UserManagementView';

import {
  LayoutDashboard,
  CheckSquare,
  Network,
  User,
  PlusCircle,
  UserPlus,
  LogOut,
  Building,
  Building2,
  History,
  Calendar,
  Users,
  AlertCircle,
  Clock,
  ListTodo,
  ChevronRight,
  UserCog,
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [activeTab, setActiveTab] = useState('landing'); // 'landing' | 'tasks' | 'users' | 'tree' | 'matrix' | 'profile' | 'audit'
  const [tasks, setTasks] = useState([]);
  const [todaysCommitments, setTodaysCommitments] = useState([]);
  const [isOnDuty, setIsOnDuty] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Management perspective toggle: 'team' vs 'self' (default 'team' for non-employees)
  const [perspectiveMode, setPerspectiveMode] = useState('team');

  // Modals
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [selectedTaskForAction, setSelectedTaskForAction] = useState(null);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);

  // Drilldown state (User Cockpit inspection)
  const [drilldownUserId, setDrilldownUserId] = useState(null);

  // Load User & Profile
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      setPerspectiveMode(user.role === 'EMPLOYEE' ? 'self' : 'team');
      fetchProfile();
    }
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/auth/me/');
      setProfileData(res.data);
    } catch (err) {
      console.error('Failed to load profile details', err);
    }
  };

  const fetchDailyCommitments = async () => {
    try {
      const res = await api.get('/tasks/daily-commitments/');
      setTodaysCommitments(res.data.selected_tasks || []);
      setIsOnDuty(res.data.is_on_duty);
    } catch (err) {
      console.error('Failed to load daily commitments', err);
    }
  };

  const fetchTasks = async () => {
    setLoadingTasks(true);
    try {
      const res = await api.get('/tasks/');
      setTasks(res.data);
      await fetchDailyCommitments();
    } catch (err) {
      console.error('Failed to load tasks', err);
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchTasks();
    }
  }, [currentUser]);

  const handleLogout = () => {
    localStorage.clear();
    setCurrentUser(null);
    setProfileData(null);
    setDrilldownUserId(null);
  };

  const handleUncheckCommitment = async (taskId) => {
    try {
      await api.delete('/tasks/daily-commitments/', { data: { task_id: taskId } });
      fetchDailyCommitments();
      fetchTasks();
    } catch (err) {
      alert('Failed to remove commitment.');
    }
  };

  if (!currentUser) {
    return (
      <Login
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setPerspectiveMode(user.role === 'EMPLOYEE' ? 'self' : 'team');
          fetchProfile();
        }}
      />
    );
  }

  const isPrivileged = ['SUPERVISOR', 'ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD', 'BUSINESS_ADMIN'].includes(currentUser.role);
  const isAdminTier = ['ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD', 'BUSINESS_ADMIN'].includes(currentUser.role);
  const canManageMatrix = ['SUPER_ADMIN', 'ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD'].includes(currentUser.role);

  // Helper: Capitalize Words for Full Name fallback to Username
  const getCapitalizedDisplayName = () => {
    const raw = (currentUser.full_name && currentUser.full_name.trim().length > 0)
      ? currentUser.full_name
      : (currentUser.username || 'User');
    return raw
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  // Top Bar Display Name (Max 2 Words)
  const getShortName = () => {
    const full = getCapitalizedDisplayName();
    return full.split(' ').slice(0, 2).join(' ');
  };

  const roleBadgeStyles = {
    SUPER_ADMIN: 'bg-rose-50 text-rose-700 border-rose-200',
    DEPT_HEAD: 'bg-purple-50 text-purple-700 border-purple-200',
    BUSINESS_ADMIN: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    ADMIN: 'bg-amber-50 text-amber-700 border-amber-200',
    SUPERVISOR: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    EMPLOYEE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  // KPI Metrics Calculation
  const pendingTasks = tasks.filter((t) => t.status === 'REQUEST_PENDING');
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS');

  return (
    <div className="h-screen overflow-hidden bg-slate-50 flex font-sans text-slate-800">
      
      {/* ===================== SIDEBAR ===================== */}
      <aside className="w-64 h-full overflow-hidden bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800">
        <div className="h-16 flex items-center px-6 border-b border-slate-800/80 gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-base shadow-sm">
            T
          </div>
          <span className="text-lg font-bold tracking-tight text-white">TeamPulse</span>
        </div>

        <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-sm">
            {(currentUser.username || 'U').substring(0, 2).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <h4 className="text-xs font-semibold text-white truncate">{getShortName()}</h4>
            <p className="text-[11px] text-slate-400 truncate">{currentUser.designation || 'Staff Member'}</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1 text-xs font-medium">
          <button
            onClick={() => {
              setActiveTab('landing');
              setDrilldownUserId(null);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
              activeTab === 'landing'
                ? 'bg-blue-600 text-white font-semibold'
                : 'hover:bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <LayoutDashboard size={16} /> Overview Landing
          </button>

          <button
            onClick={() => {
              setActiveTab('tasks');
              setDrilldownUserId(null);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition ${
              activeTab === 'tasks'
                ? 'bg-blue-600 text-white font-semibold'
                : 'hover:bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <CheckSquare size={16} /> Tasks & Work Log
            </div>
            {pendingTasks.length > 0 && (
              <span className="bg-amber-500 text-slate-950 font-bold px-1.5 py-0.2 rounded-full text-[10px]">
                {pendingTasks.length}
              </span>
            )}
          </button>

          {/* USER MANAGEMENT CONSOLE LINK */}
          {isPrivileged && (
            <button
              onClick={() => {
                setActiveTab('users');
                setDrilldownUserId(null);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                activeTab === 'users'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <UserCog size={16} /> User Management
            </button>
          )}

          {isPrivileged && (
            <button
              onClick={() => {
                setActiveTab('tree');
                setDrilldownUserId(null);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                activeTab === 'tree'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Network size={16} /> Organization Tree
            </button>
          )}

          {/* Business & Department Matrix */}
          {canManageMatrix && (
            <button
              onClick={() => {
                setActiveTab('matrix');
                setDrilldownUserId(null);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                activeTab === 'matrix'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Building2 size={16} /> Business & Matrix
            </button>
          )}

          {isAdminTier && (
            <button
              onClick={() => setIsDeptModalOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <Building size={16} /> Manage Departments
            </button>
          )}

          <button
            onClick={() => {
              setActiveTab('profile');
              setDrilldownUserId(null);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
              activeTab === 'profile'
                ? 'bg-blue-600 text-white font-semibold'
                : 'hover:bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <User size={16} /> Personal Details
          </button>

          <button
            onClick={() => {
              setActiveTab('audit');
              setDrilldownUserId(null);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
              activeTab === 'audit'
                ? 'bg-blue-600 text-white font-semibold'
                : 'hover:bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <History size={16} /> Audit Trail & History
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2 shrink-0">
          {isPrivileged && (
            <button
              onClick={() => setIsCreateUserOpen(true)}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2 rounded-lg font-medium transition"
            >
              <UserPlus size={14} /> + New User
            </button>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white text-xs py-2 rounded-lg transition"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ===================== MAIN CONTENT WRAPPER ===================== */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* FIXED TOP NAVBAR */}
        <header className="h-20 py-4 bg-white border-b border-slate-200 px-8 flex justify-between items-center sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              {getShortName()}
            </h1>
            <span
              className={`text-[10px] font-mono px-2.5 py-0.5 rounded border uppercase font-bold ${
                roleBadgeStyles[currentUser.role] || 'bg-slate-100 text-slate-700'
              }`}
            >
              {currentUser.role}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <AttendanceToggle onStatusChange={() => fetchTasks()} />

            <button
              onClick={() => setIsPlannerOpen(true)}
              disabled={!isOnDuty}
              title={!isOnDuty ? "You must mark On-Duty / Present to access your daily planner." : "Open Daily Work Planner"}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition shadow-2xs ${
                isOnDuty
                  ? 'bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 cursor-pointer'
                  : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
              }`}
            >
              <Calendar size={14} className={isOnDuty ? "text-blue-600" : "text-slate-400"} /> Daily Plan
            </button>

            <button
              onClick={() => setIsCreateTaskOpen(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3.5 py-2 rounded-lg font-medium transition shadow-xs"
            >
              <PlusCircle size={15} /> + Create Task
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="p-8 max-w-7xl w-full mx-auto space-y-6 flex-1">
          
          {/* TAB 1: LANDING PAGE */}
          {activeTab === 'landing' && (
            <div className="space-y-6">
              
              {/* Drilldown Inspection View */}
              {drilldownUserId ? (
                <UserDetailView
                  userId={drilldownUserId}
                  onBack={() => setDrilldownUserId(null)}
                  currentUser={currentUser}
                  onOpenTaskAction={(t) => setSelectedTaskForAction(t)}
                />
              ) : (
                <>
                  {/* Perspective Mode Switcher for Non-Employee Tiers */}
                  {currentUser.role !== 'EMPLOYEE' && (
                    <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="text-xs font-semibold text-slate-700">Workspace Perspective</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPerspectiveMode('team')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                            perspectiveMode === 'team'
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <Users size={13} /> Team Oversight
                        </button>
                        <button
                          onClick={() => setPerspectiveMode('self')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                            perspectiveMode === 'self'
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <User size={13} /> My Personal Tasks
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 1. TEAM OVERSIGHT VIEW */}
                  {currentUser.role !== 'EMPLOYEE' && perspectiveMode === 'team' && (
                    <div className="space-y-6">
                      {isAdminTier ? (
                        <AdminDepartmentsView onSelectUser={(id) => setDrilldownUserId(id)} />
                      ) : (
                        <SupervisorTeamView onSelectUser={(id) => setDrilldownUserId(id)} />
                      )}
                    </div>
                  )}

                  {/* 2. SELF / EMPLOYEE VIEW */}
                  {(currentUser.role === 'EMPLOYEE' || perspectiveMode === 'self') && (
                    <div className="space-y-6">
                      
                      {/* KPI ROW */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                          <div>
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                              Pending Approvals
                            </span>
                            <div className="text-2xl font-bold text-amber-600 mt-1">{pendingTasks.length}</div>
                            <p className="text-[11px] text-slate-400 mt-1">Assignments waiting for review</p>
                          </div>
                          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                            <AlertCircle size={20} />
                          </div>
                        </div>

                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                          <div>
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                              In-Progress Tasks
                            </span>
                            <div className="text-2xl font-bold text-blue-600 mt-1">{inProgressTasks.length}</div>
                            <p className="text-[11px] text-slate-400 mt-1">Actively tracked items</p>
                          </div>
                          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Clock size={20} />
                          </div>
                        </div>

                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                          <div>
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                              Today's Commitments
                            </span>
                            <div className="text-2xl font-bold text-emerald-600 mt-1">{todaysCommitments.length}</div>
                            <p className="text-[11px] text-slate-400 mt-1">Items planned for active work</p>
                          </div>
                          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <ListTodo size={20} />
                          </div>
                        </div>
                      </div>

                      {/* IDLE NOTICE */}
                      {isOnDuty && todaysCommitments.length === 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <AlertCircle size={18} className="text-amber-600 shrink-0" />
                            <span>
                              <strong>Capacity Notice:</strong> You currently have <strong>0 tasks committed</strong> for today[cite: 1, 3]. Commit to items using the Daily Plan or accept incoming requests.
                            </span>
                          </div>
                          <button
                            onClick={() => setIsPlannerOpen(true)}
                            className="text-xs font-bold bg-amber-200 hover:bg-amber-300 px-3 py-1 rounded-lg text-amber-900 transition shrink-0"
                          >
                            Open Planner
                          </button>
                        </div>
                      )}

                      {/* TODAY'S COMMITMENTS TABLE */}
                      <TodaysCommitmentsTable
                        commitments={todaysCommitments}
                        onUncheckTask={handleUncheckCommitment}
                        onOpenActionModal={(t) => setSelectedTaskForAction(t)}
                        isOnDuty={isOnDuty}
                        onOpenPlanner={() => setIsPlannerOpen(true)}
                        currentUser={currentUser}
                      />

                      {/* TASK BACKLOG (TOP 5 ITEMS) */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">Task Backlog</h3>
                            <p className="text-[11px] text-slate-500">Top 5 items in your queue</p>
                          </div>
                          <button
                            onClick={() => setActiveTab('tasks')}
                            className="text-xs text-blue-600 hover:underline font-medium"
                          >
                            View All Backlog ({tasks.length})
                          </button>
                        </div>
                        <TaskTable
                          tasks={tasks.slice(0, 5)}
                          onOpenActionModal={(t) => setSelectedTaskForAction(t)}
                          onRefresh={() => fetchTasks()}
                          currentUser={currentUser}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 2: TASKS BACKLOG TABLE */}
          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Tasks & Work Management</h3>
                  <p className="text-xs text-slate-500">Filter, update progress %, or inspect activity logs</p>
                </div>
              </div>
              {loadingTasks ? (
                <div className="text-center py-12 text-slate-400 text-xs">Loading task items...</div>
              ) : (
                <TaskTable
                  tasks={tasks}
                  onOpenActionModal={(t) => setSelectedTaskForAction(t)}
                  onRefresh={() => fetchTasks()}
                  currentUser={currentUser}
                />
              )}
            </div>
          )}

          {/* TAB 3: USER MANAGEMENT CONSOLE & DRILLDOWN */}
          {activeTab === 'users' && isPrivileged && (
            <UserManagementView currentUser={currentUser} />
          )}

          {/* TAB 4: HIERARCHY TREE */}
          {activeTab === 'tree' && isPrivileged && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Reporting Hierarchy Tree</h3>
                <p className="text-xs text-slate-500">Downstream supervisor reporting structures</p>
              </div>
              <OrgTreeViewer />
            </div>
          )}

          {/* TAB 5: BUSINESS & ORG MATRIX */}
          {activeTab === 'matrix' && canManageMatrix && (
            <div className="space-y-4">
              <BusinessDeptMatrixView 
                userRole={currentUser.role}
                onClose={() => setActiveTab('landing')}
              />
            </div>
          )}

          {/* TAB 6: PERSONAL DETAILS */}
          {activeTab === 'profile' && (
            <PersonalProfileView
              currentUser={currentUser}
              onProfileUpdated={(updated) => setProfileData(updated)}
            />
          )}

          {/* TAB 7: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <AuditLogViewer currentUser={currentUser} />
          )}
        </main>
      </div>

      {/* ===================== MODALS ===================== */}
      <CreateUserModal
        isOpen={isCreateUserOpen}
        onClose={() => {
          setIsCreateUserOpen(false);
          fetchTasks();
        }}
        currentUserRole={currentUser.role}
      />

      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
        onTaskCreated={() => fetchTasks()}
        currentUser={currentUser}
      />

      <TaskActionModal
        isOpen={Boolean(selectedTaskForAction)}
        onClose={() => setSelectedTaskForAction(null)}
        task={selectedTaskForAction}
        onActionSuccess={() => fetchTasks()}
        currentUser={currentUser}
      />

      <MorningPlannerModal
        isOpen={isPlannerOpen}
        onClose={() => setIsPlannerOpen(false)}
        onCommitmentsUpdated={() => fetchTasks()}
      />

      <DepartmentManagementModal
        isOpen={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
      />
    </div>
  );
}