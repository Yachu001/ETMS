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

  // Mobile Back Navigation & Swipe Gesture Listener
  useEffect(() => {
    const handlePopState = () => {
      if (drilldownUserId) {
        setDrilldownUserId(null);
        return;
      }
      if (activeTab !== 'landing') {
        setActiveTab('landing');
        return;
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [drilldownUserId, activeTab]);

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
    <div className="h-screen h-[100dvh] w-screen overflow-hidden overscroll-none bg-[#EEF2F6] bg-[radial-gradient(ellipse_at_top,_#F8FAFC,_#E2E8F0)] flex font-sans text-slate-800 p-3 sm:p-4 md:p-[1.25%] gap-2.5 md:gap-4 box-border">
      {/* ===================== SIDEBAR ===================== */}
      <Sidebar
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab !== activeTab) {
            window.history.pushState({ tab }, '', '');
          }
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

        {/* Scrollable Content Body */}
        <main className="w-full h-full pt-20 md:pt-24 pb-28 sm:pb-20 space-y-6 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          
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
                    <div className="flex flex-wrap justify-between items-center gap-3 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-slate-200/90 shadow-[0_8px_24px_rgba(15,23,42,0.05)] w-full">
                      <div className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                        <span className="font-mono text-[10px] uppercase font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2.5 py-0.5 rounded-full">
                          {role.replace('_', ' ')} PERSPECTIVE
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setViewMode('team')}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                            viewMode === 'team'
                              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold shadow-[0_4px_12px_rgba(37,99,235,0.28)]'
                              : 'bg-slate-50 text-slate-600 hover:text-blue-700 hover:bg-blue-50/70 border border-slate-200/80'
                          }`}
                        >
                          <Users size={13} /> Team Oversight
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('self')}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                            viewMode === 'self'
                              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold shadow-[0_4px_12px_rgba(37,99,235,0.28)]'
                              : 'bg-slate-50 text-slate-600 hover:text-blue-700 hover:bg-blue-50/70 border border-slate-200/80'
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
                      {/* Metric Stat Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                        <div className={`p-4 sm:p-5 rounded-3xl border shadow-[0_8px_25px_rgba(15,23,42,0.05)] flex items-center justify-between transition ${
                          pendingAcceptRejectCount > 0 
                            ? 'bg-gradient-to-b from-blue-50/80 to-white border-blue-200 shadow-[0_10px_25px_rgba(37,99,235,0.08)]' 
                            : 'bg-white border-slate-200/90'
                        }`}>
                          <div>
                            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
                              Pending Accept / Reject
                            </span>
                            <div className={`text-2xl font-bold mt-1 ${pendingAcceptRejectCount > 0 ? 'text-blue-700 font-mono' : 'text-slate-900'}`}>
                              {pendingAcceptRejectCount}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">Incoming tasks awaiting action</p>
                          </div>
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${pendingAcceptRejectCount > 0 ? 'bg-blue-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)]' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                            <Inbox size={20} />
                          </div>
                        </div>

                        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-[0_8px_25px_rgba(15,23,42,0.05)] flex items-center justify-between">
                          <div>
                            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                              Today Commits / Active
                            </span>
                            <div className="text-2xl font-bold text-slate-900 mt-1">
                              <span className="text-blue-600 font-mono">{activeCommitsTodayCount}</span>
                              <span className="text-slate-400 text-lg font-normal font-mono"> / {activeSelfTasks.length}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">Committed today vs total backlog</p>
                          </div>
                          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                            <CalendarClock size={20} />
                          </div>
                        </div>

                        <div className={`p-4 sm:p-5 rounded-3xl border shadow-[0_8px_25px_rgba(15,23,42,0.05)] flex items-center justify-between transition ${
                          overdueTasksCount > 0 
                            ? 'bg-gradient-to-b from-rose-50/90 to-white border-rose-200 shadow-[0_10px_25px_rgba(244,63,94,0.08)]' 
                            : 'bg-white border-slate-200/90'
                        }`}>
                          <div>
                            <span className={`text-[11px] font-bold uppercase tracking-wider block ${overdueTasksCount > 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                              Overdue Tasks
                            </span>
                            <div className={`text-2xl font-bold mt-1 ${overdueTasksCount > 0 ? 'text-rose-600 font-mono' : 'text-slate-900'}`}>
                              {overdueTasksCount}
                            </div>
                            <p className={`text-[11px] mt-0.5 ${overdueTasksCount > 0 ? 'text-rose-600/80' : 'text-slate-500'}`}>Personal tasks past deadline</p>
                          </div>
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${overdueTasksCount > 0 ? 'bg-rose-100 text-rose-600 border border-rose-200' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
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

                      {/* Capacity Notice */}
                      {isEmployeeIdle && (
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50/70 border border-blue-200 rounded-3xl p-4 text-xs text-slate-700 flex flex-wrap gap-3 items-center justify-between w-full shadow-[0_6px_20px_rgba(37,99,235,0.07)]">
                          <div className="flex items-center gap-2.5">
                            <AlertCircle size={18} className="text-blue-600 shrink-0" />
                            <span>
                              <strong className="text-blue-800">Capacity Notice:</strong> You are marked On-Duty but currently have <strong>0 active tasks committed</strong> for today. Add tasks from your backlog using the planner.
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsPlannerOpen(true)}
                            className="text-xs font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white px-4 py-2 rounded-xl transition shrink-0 cursor-pointer shadow-[0_4px_12px_rgba(37,99,235,0.25)]"
                          >
                            Open Planner
                          </button>
                        </div>
                      )}

                      <div className="space-y-3 w-full">
                        <div className="flex justify-between items-center">
                          <h3 className="text-sm font-bold text-slate-900 tracking-wide">Active Tasks Backlog (Recent 5)</h3>
                          <button
                            type="button"
                            onClick={() => setActiveTab('tasks')}
                            className="text-xs text-blue-600 hover:text-blue-700 hover:underline font-semibold cursor-pointer inline-flex items-center gap-1 transition"
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
                  window.history.pushState({ drilldown: userId }, '', '');
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
                <h3 className="text-base font-bold text-slate-900 tracking-wide">Reporting Hierarchy Tree</h3>
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
        onCommitmentsUpdated={fetchTasks}
        currentUser={currentUser}
      />
    </div>
  );
}