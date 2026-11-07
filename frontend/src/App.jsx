// frontend/src/App.jsx

import React, { useState, useEffect, useCallback } from 'react';
import api from './api/axios';
import Login from './pages/Login';

// Layout & Navigation Components
import TopNavbar from './components/common/TopNavbar';
import Sidebar from './components/common/Sidebar';

// Feature Views & Components
import TaskModuleHub from './components/TaskModuleHub';
import TaskTable from './components/TaskTable';
import TodaysCommitmentsTable from './components/TodaysCommitmentsTable';
import SupervisorTeamView from './components/SupervisorTeamView';
import UserManagementView from './components/UserManagementView';
import UserDetailView from './components/UserDetailView';
import BusinessDeptMatrixView from './components/BusinessDeptMatrixView';
import ReasonReviewsView from './components/ReasonReviewsView';
import OrgTreeViewer from './components/OrgTreeViewer';
import PersonalProfileView from './components/PersonalProfileView';
import AuditLogViewer from './components/AuditLogViewer';

// Modals
import CreateTaskModal from './components/CreateTaskModal';
import TaskActionModal from './components/TaskActionModal';
import MorningPlannerModal from './components/MorningPlannerModal';

import {
  User,
  Clock,
  AlertCircle,
  ChevronRight,
  Users,
  Inbox,
  CalendarClock
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'landing';
  });

  const [tasks, setTasks] = useState([]);
  const [todaysCommitments, setTodaysCommitments] = useState([]);
  const [isOnDuty, setIsOnDuty] = useState(true);
  const [drilldownUserId, setDrilldownUserId] = useState(null);

  // Desktop sidebar collapse state (default expanded)
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);

  // Mobile drawer state (default closed on small screens)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Sync activeTab changes to localStorage
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // Modals state
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [selectedTaskForAction, setSelectedTaskForAction] = useState(null);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);

  // Role booleans
  const role = currentUser?.role || 'EMPLOYEE';
  const isBaseEmployee = role === 'EMPLOYEE';
  const isAdminTier = ['ADMIN', 'SUPER_ADMIN'].includes(role) || currentUser?.is_superuser;
  const isMidTierManager = ['SUPERVISOR', 'BUSINESS_ADMIN', 'DEPT_HEAD'].includes(role);
  const isPrivileged = isMidTierManager || isAdminTier;
  const canManageMatrix = ['SUPER_ADMIN', 'ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD', 'SUPERVISOR'].includes(role);

  // Perspective Mode
  const [viewMode, setViewMode] = useState(isBaseEmployee ? 'self' : 'team');

  // Enforce role perspective rules
  useEffect(() => {
    if (isAdminTier && viewMode !== 'team') {
      setViewMode('team');
    } else if (isBaseEmployee && viewMode !== 'self') {
      setViewMode('self');
    }
  }, [role, isAdminTier, isBaseEmployee, viewMode]);

  // Load User Profile & Attendance
  const fetchProfile = async () => {
    try {
      const res = await api.get('/auth/me/');
      if (res.data) {
        setCurrentUser(res.data);
        localStorage.setItem('user', JSON.stringify(res.data));
      }
    } catch (err) {
      console.error('Failed to load profile details:', err);
      if (err.response?.status === 401) {
        handleLogout();
      }
    }
  };

  const fetchAttendance = async () => {
    try {
      const res = await api.get('/auth/attendance/today/');
      setIsOnDuty(Boolean(res.data.is_present));
    } catch (err) {
      setIsOnDuty(false);
    }
  };

  const fetchTasks = useCallback(async () => {
    if (!currentUser) return;
    try {
      const targetMode = isBaseEmployee ? 'self' : (isAdminTier ? 'team' : viewMode);
      const [tasksRes, commitmentsRes] = await Promise.all([
        api.get(`/tasks/?view_mode=${targetMode}`),
        api.get('/tasks/daily-commitments/'),
      ]);
      setTasks(tasksRes.data || []);
      setTodaysCommitments(commitmentsRes.data.selected_tasks || []);
      setIsOnDuty(Boolean(commitmentsRes.data.is_on_duty));
    } catch (err) {
      console.error('Failed to load tasks or commitments:', err);
    }
  }, [currentUser, isBaseEmployee, isAdminTier, viewMode]);

  useEffect(() => {
    if (currentUser) {
      fetchProfile();
      fetchAttendance();
      fetchTasks();
    }
  }, [currentUser?.id, viewMode]);

  const handleLogout = () => {
    localStorage.clear();
    setCurrentUser(null);
    setTasks([]);
    setTodaysCommitments([]);
    setDrilldownUserId(null);
    setActiveTab('landing');
    localStorage.setItem('activeTab', 'landing');
  };

  if (!currentUser) {
    return (
      <Login
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setActiveTab('landing');
          localStorage.setItem('activeTab', 'landing');
          fetchProfile();
          fetchAttendance();
          fetchTasks();
        }}
      />
    );
  }

  // Self Metrics Calculation
  const pendingAcceptRejectCount = tasks.filter(
    (t) => t.status === 'REQUEST_PENDING' && t.assigned_to === currentUser.id
  ).length;

  const activeSelfTasks = tasks.filter(
    (t) => (t.assigned_to === currentUser.id || !t.assigned_to) &&
      ['ACCEPTED', 'IN_PROGRESS', 'ON_HOLD'].includes(t.status) &&
      t.progress_percentage < 100
  );

  const activeCommitsTodayCount = todaysCommitments.filter(
    (t) => ['ACCEPTED', 'IN_PROGRESS', 'ON_HOLD'].includes(t.status) && t.progress_percentage < 100
  ).length;

  const overdueTasksCount = tasks.filter(
    (t) => t.assigned_to === currentUser.id &&
      Boolean(t.is_overdue) &&
      !['VERIFIED', 'REJECTED', 'CANCELLED'].includes(t.status)
  ).length;

  const isEmployeeIdle = isOnDuty && activeCommitsTodayCount === 0;
  const renderSelfCockpit = isBaseEmployee || (isMidTierManager && viewMode === 'self');

  return (
    /* Outer Screen Shell: 
       - Increased padding for md and below screens (p-3 sm:p-4), kept identical on desktop (md:p-[1.25%])
       - Uses dynamic viewport height (h-[100dvh]) and overscroll-none to lock mobile browser window scrolling
    */
    <div className="h-screen h-[100dvh] w-screen overflow-hidden overscroll-none bg-slate-100/90 flex font-sans text-slate-800 p-3 sm:p-4 md:p-[1.25%] gap-2.5 md:gap-4 box-border">
      {/* ===================== SIDEBAR ===================== */}
      <Sidebar
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setDrilldownUserId(null);
        }}
        onLogout={handleLogout}
        pendingTasksCount={pendingAcceptRejectCount}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        isMinimized={isSidebarMinimized}
        onToggleMinimize={() => setIsSidebarMinimized((prev) => !prev)}
      />

      {/* ===================== MAIN CONTENT WRAPPER ===================== */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Floating Top Navbar */}
        <TopNavbar
          currentUser={currentUser}
          isOnDuty={isOnDuty}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenPlanner={() => setIsPlannerOpen(true)}
          onOpenCreateTask={() => setIsCreateTaskOpen(true)}
          onAttendanceChanged={() => {
            fetchAttendance();
            fetchTasks();
          }}
          isSidebarMinimized={isSidebarMinimized}
        />

        {/* Scrollable Content Body: 
            - pt-20/24 provides clearance under TopNavbar
            - overscroll-y-contain traps vertical scrolling inside this container on mobile
            - [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden hides the scrollbar across all engines
        */}
        <main className="w-full h-full pt-20 md:pt-24 space-y-6 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          
          {/* TAB 1: OVERVIEW LANDING & COCKPIT */}
          {activeTab === 'landing' && (
            <div className="space-y-6 w-full">
              {drilldownUserId ? (
                <UserDetailView
                  userId={drilldownUserId}
                  onBack={() => setDrilldownUserId(null)}
                  currentUser={currentUser}
                  onOpenTaskAction={(t) => setSelectedTaskForAction(t)}
                />
              ) : (
                <>
                  {isMidTierManager && (
                    <div className="flex justify-between items-center bg-white/90 backdrop-blur-xs p-3 rounded-2xl border border-slate-200/80 shadow-2xs w-full">
                      <div className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                        <span className="font-mono text-[10px] uppercase font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded">
                          {role.replace('_', ' ')} PERSPECTIVE
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setViewMode('team')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                            viewMode === 'team'
                              ? 'bg-slate-900 text-white shadow-2xs font-bold'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <Users size={13} /> Team Oversight
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('self')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                            viewMode === 'self'
                              ? 'bg-slate-900 text-white shadow-2xs font-bold'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <User size={13} /> My Personal Work
                        </button>
                      </div>
                    </div>
                  )}

                  {viewMode === 'team' && isPrivileged && (
                    <SupervisorTeamView 
                      currentUser={currentUser}
                      onSelectUser={(id) => setDrilldownUserId(id)} 
                    />
                  )}

                  {renderSelfCockpit && (
                    <div className="space-y-6 w-full">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                        <div className={`p-4 sm:p-5 rounded-2xl border shadow-2xs flex items-center justify-between transition ${
                          pendingAcceptRejectCount > 0 ? 'bg-amber-50/70 border-amber-200' : 'bg-white/90 border-slate-200/80'
                        }`}>
                          <div>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                              Pending Accept / Reject
                            </span>
                            <div className={`text-2xl font-bold mt-1 ${pendingAcceptRejectCount > 0 ? 'text-amber-700 font-mono' : 'text-slate-900'}`}>
                              {pendingAcceptRejectCount}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">Incoming tasks awaiting action</p>
                          </div>
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${pendingAcceptRejectCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-50 text-slate-400'}`}>
                            <Inbox size={20} />
                          </div>
                        </div>

                        <div className="bg-white/90 p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
                          <div>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                              Today Commits / Active
                            </span>
                            <div className="text-2xl font-bold text-slate-900 mt-1">
                              <span className="text-blue-600 font-mono">{activeCommitsTodayCount}</span>
                              <span className="text-slate-400 text-lg font-normal font-mono"> / {activeSelfTasks.length}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">Committed today vs total backlog</p>
                          </div>
                          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <CalendarClock size={20} />
                          </div>
                        </div>

                        <div className={`p-4 sm:p-5 rounded-2xl border shadow-2xs flex items-center justify-between transition ${
                          overdueTasksCount > 0 ? 'bg-rose-50/70 border-rose-200' : 'bg-white/90 border-slate-200/80'
                        }`}>
                          <div>
                            <span className={`text-[11px] font-bold uppercase tracking-wider block ${overdueTasksCount > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                              Overdue Tasks
                            </span>
                            <div className={`text-2xl font-bold mt-1 ${overdueTasksCount > 0 ? 'text-rose-700 font-mono' : 'text-slate-900'}`}>
                              {overdueTasksCount}
                            </div>
                            <p className={`text-[11px] mt-0.5 ${overdueTasksCount > 0 ? 'text-rose-600/80' : 'text-slate-400'}`}>Personal tasks past deadline</p>
                          </div>
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${overdueTasksCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-50 text-slate-400'}`}>
                            <Clock size={20} />
                          </div>
                        </div>
                      </div>

                      <TodaysCommitmentsTable
                        commitments={todaysCommitments}
                        onOpenActionModal={(t) => setSelectedTaskForAction(t)}
                        onRefresh={fetchTasks}
                        currentUser={currentUser}
                      />

                      {isEmployeeIdle && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-center justify-between w-full">
                          <div className="flex items-center gap-2.5">
                            <AlertCircle size={18} className="text-amber-600 shrink-0" />
                            <span>
                              <strong>Capacity Notice:</strong> You are marked On-Duty but currently have <strong>0 active tasks committed</strong> for today. Add tasks from your backlog using the planner.
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsPlannerOpen(true)}
                            className="text-xs font-bold bg-amber-200 hover:bg-amber-300 px-3 py-1.5 rounded-xl text-amber-900 transition shrink-0 cursor-pointer"
                          >
                            Open Planner
                          </button>
                        </div>
                      )}

                      <div className="space-y-3 w-full">
                        <div className="flex justify-between items-center">
                          <h3 className="text-sm font-bold text-slate-900">Active Tasks Backlog (Recent 5)</h3>
                          <button
                            type="button"
                            onClick={() => setActiveTab('tasks')}
                            className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer inline-flex items-center gap-1"
                          >
                            View All ({tasks.length}) <ChevronRight size={13} />
                          </button>
                        </div>
                        <TaskTable
                          tasks={tasks.slice(0, 5)}
                          onOpenActionModal={(t) => setSelectedTaskForAction(t)}
                          currentUser={currentUser}
                          onRefresh={fetchTasks}
                          viewMode="self"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 2: TASKS BACKLOG & HIERARCHICAL WORKSPACE */}
          {activeTab === 'tasks' && (
            <div className="w-full">
              <TaskModuleHub
                currentUser={currentUser}
                tasks={tasks}
                onOpenActionModal={(t) => setSelectedTaskForAction(t)}
                onRefresh={fetchTasks}
              />
            </div>
          )}

          {/* TAB 3: BUSINESS & ORG MATRIX */}
          {activeTab === 'matrix' && canManageMatrix && (
            <div className="space-y-4 w-full">
              <BusinessDeptMatrixView
                currentUser={currentUser}
                userRole={currentUser.role}
                onClose={() => setActiveTab('landing')}
              />
            </div>
          )}

          {/* TAB 4: USER MANAGEMENT CONSOLE */}
          {activeTab === 'users' && isPrivileged && (
            <div className="space-y-4 w-full">
              <UserManagementView 
                currentUser={currentUser} 
                onInspectUser={(userId) => {
                  setDrilldownUserId(userId);
                  setActiveTab('landing');
                }}
              />
            </div>
          )}

          {/* TAB 5: REASON FORMS REVIEW HUB */}
          {activeTab === 'reviews' && isPrivileged && (
            <div className="w-full">
              <ReasonReviewsView currentUser={currentUser} />
            </div>
          )}

          {/* TAB 6: HIERARCHY TREE */}
          {activeTab === 'tree' && isPrivileged && (
            <div className="space-y-4 w-full">
              <div>
                <h3 className="text-base font-bold text-slate-900">Reporting Hierarchy Tree</h3>
                <p className="text-xs text-slate-500">Downstream supervisor reporting structures</p>
              </div>
              <OrgTreeViewer />
            </div>
          )}

          {/* TAB 7: PERSONAL PROFILE */}
          {activeTab === 'profile' && (
            <div className="w-full">
              <PersonalProfileView
                currentUser={currentUser}
                onProfileUpdated={(updated) => {
                  setCurrentUser(updated);
                  localStorage.setItem('user', JSON.stringify(updated));
                }}
              />
            </div>
          )}

          {/* TAB 8: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="w-full">
              <AuditLogViewer currentUser={currentUser} />
            </div>
          )}
        </main>
      </div>

      {/* ===================== MODALS ===================== */}
      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
        onTaskCreated={fetchTasks}
        currentUser={currentUser}
      />

      <TaskActionModal
        isOpen={Boolean(selectedTaskForAction)}
        onClose={() => setSelectedTaskForAction(null)}
        task={selectedTaskForAction}
        onActionSuccess={fetchTasks}
        currentUser={currentUser}
      />

      <MorningPlannerModal
        isOpen={isPlannerOpen}
        onClose={() => setIsPlannerOpen(false)}
        onCommitmentSaved={fetchTasks}
        currentUser={currentUser}
      />
    </div>
  );
}