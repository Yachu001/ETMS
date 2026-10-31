// frontend/src/App.jsx

import React, { useState, useEffect } from 'react';
import api from './api/axios';
import Login from './pages/Login';

// Layout & Navigation Components
import TopNavbar from './components/common/TopNavbar';
import Sidebar from './components/common/Sidebar';

// Feature Views & Components
import TaskTable from './components/TaskTable';
import TodaysCommitmentsTable from './components/TodaysCommitmentsTable';
import ReasonReviewsView from './components/ReasonReviewsView';
import OrgTreeViewer from './components/OrgTreeViewer';
import AuditLogViewer from './components/AuditLogViewer';
import SupervisorTeamView from './components/SupervisorTeamView';
import AdminDepartmentsView from './components/AdminDepartmentsView';
import UserDetailView from './components/UserDetailView';
import BusinessDeptMatrixView from './components/BusinessDeptMatrixView';
import UserManagementView from './components/UserManagementView';
import PersonalProfileView from './components/PersonalProfileView';

// Modals
import CreateUserModal from './components/CreateUserModal';
import CreateTaskModal from './components/CreateTaskModal';
import TaskActionModal from './components/TaskActionModal';
import MorningPlannerModal from './components/MorningPlannerModal';

import {
  User,
  Clock,
  Briefcase,
  Building,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Users,
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [isOnDuty, setIsOnDuty] = useState(true);
  const [activeTab, setActiveTab] = useState('landing'); // 'landing' | 'tasks' | 'matrix' | 'users' | 'reviews' | 'tree' | 'profile' | 'audit'
  const [tasks, setTasks] = useState([]);
  const [todaysCommitments, setTodaysCommitments] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Dual-view switch for Supervisors: 'team' vs 'self'
  const [supervisorViewMode, setSupervisorViewMode] = useState('team');

  // Modals
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [selectedTaskForAction, setSelectedTaskForAction] = useState(null);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);

  // Drill-down inspection state
  const [drilldownUserId, setDrilldownUserId] = useState(null);

  // Load User & Profile
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      fetchProfile();
      fetchAttendance();
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

  const fetchAttendance = async () => {
    try {
      const res = await api.get('/auth/attendance/today/');
      setIsOnDuty(Boolean(res.data.is_present));
    } catch (err) {
      setIsOnDuty(false);
    }
  };

  const fetchTasks = async () => {
    setLoadingTasks(true);
    try {
      const [tasksRes, commitmentsRes] = await Promise.all([
        api.get('/tasks/'),
        api.get('/tasks/daily-commitments/'),
      ]);
      setTasks(tasksRes.data);
      setTodaysCommitments(commitmentsRes.data.selected_tasks || []);
      setIsOnDuty(commitmentsRes.data.is_on_duty);
    } catch (err) {
      console.error('Failed to load tasks or commitments', err);
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

  if (!currentUser) {
    return (
      <Login
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          fetchProfile();
          fetchAttendance();
        }}
      />
    );
  }

  const isPrivileged = ['SUPERVISOR', 'ADMIN', 'SUPER_ADMIN', 'DEPT_HEAD', 'BUSINESS_ADMIN'].includes(currentUser.role);
  const isAdminTier = ['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role);
  
  // Mandatory update: Allowed SUPERVISOR to view and manage their assigned matrix members
  const canManageMatrix = ['SUPER_ADMIN', 'ADMIN', 'BUSINESS_ADMIN', 'DEPT_HEAD', 'SUPERVISOR'].includes(currentUser.role);

  // Summary Metrics for Landing Page
  const pendingTasks = tasks.filter((t) => t.status === 'REQUEST_PENDING');
  const inProgressTasks = tasks.filter((t) => ['ACCEPTED', 'IN_PROGRESS'].includes(t.status));
  const completedTasks = tasks.filter((t) => ['VERIFIED', 'AWAITING_VERIFICATION'].includes(t.status));
  const isEmployeeIdle = isOnDuty && todaysCommitments.length === 0;

  return (
    <div className="h-screen overflow-hidden bg-slate-50 flex font-sans text-slate-800">
      {/* ===================== SIDEBAR ===================== */}
      <Sidebar
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setDrilldownUserId(null);
        }}
        onLogout={handleLogout}
        pendingTasksCount={pendingTasks.length}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* ===================== MAIN CONTENT WRAPPER ===================== */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Pinned Top Navbar */}
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
        />

        {/* Scrollable Content Body */}
        <main className="p-4 md:p-8 max-w-7xl w-full mx-auto space-y-6 flex-1 overflow-y-auto">
          {/* TAB 1: LANDING PAGE & SUMMARY */}
          {activeTab === 'landing' && (
            <div className="space-y-6">
              {drilldownUserId ? (
                <UserDetailView
                  userId={drilldownUserId}
                  onBack={() => setDrilldownUserId(null)}
                  currentUser={currentUser}
                  onOpenTaskAction={(t) => setSelectedTaskForAction(t)}
                />
              ) : (
                <>
                  {isAdminTier && (
                    <AdminDepartmentsView
                      onSelectUser={(userId) => setDrilldownUserId(userId)}
                    />
                  )}

                  {currentUser.role === 'SUPERVISOR' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200">
                        <div className="text-xs font-semibold text-slate-700">Supervisor Perspective</div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSupervisorViewMode('team')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                              supervisorViewMode === 'team'
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <Users size={13} /> Team Oversight
                          </button>
                          <button
                            onClick={() => setSupervisorViewMode('self')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                              supervisorViewMode === 'self'
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <User size={13} /> My Personal Tasks
                          </button>
                        </div>
                      </div>

                      {supervisorViewMode === 'team' && (
                        <SupervisorTeamView onSelectUser={(id) => setDrilldownUserId(id)} />
                      )}
                    </div>
                  )}

                  {(currentUser.role === 'EMPLOYEE' ||
                    (currentUser.role === 'SUPERVISOR' && supervisorViewMode === 'self')) && (
                    <div className="space-y-6">
                      {/* Greeting Banner */}
                      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-wrap justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold text-xl">
                            {(currentUser.username || 'U').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-slate-900">
                              Welcome back, {currentUser.full_name || currentUser.username}!
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {currentUser.designation || 'Staff Member'} &bull;{' '}
                              {profileData?.department_name || profileData?.matrix_name || 'Organization Member'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setActiveTab('tasks')}
                            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs px-3.5 py-2 rounded-lg font-medium transition"
                          >
                            Open Tasks Backlog <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Today's Commitments Table */}
                      <TodaysCommitmentsTable
                        commitments={todaysCommitments}
                        onOpenActionModal={(t) => setSelectedTaskForAction(t)}
                        onRefresh={() => fetchTasks()}
                        currentUser={currentUser}
                      />

                      {/* Capacity / Idle Notice */}
                      {isEmployeeIdle && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <AlertCircle size={18} className="text-amber-600 shrink-0" />
                            <span>
                              <strong>Capacity Notice:</strong> You currently have <strong>0 tasks committed</strong> for today. Add tasks from your backlog using the planner.
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

                      {/* Status Metrics Grid */}
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
                              Verified / Done
                            </span>
                            <div className="text-2xl font-bold text-emerald-600 mt-1">{completedTasks.length}</div>
                            <p className="text-[11px] text-slate-400 mt-1">Completed assignments</p>
                          </div>
                          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <CheckCircle2 size={20} />
                          </div>
                        </div>
                      </div>

                      {/* Recent Tasks Backlog Preview */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <h3 className="text-sm font-bold text-slate-900">Task Backlog</h3>
                          <button
                            onClick={() => setActiveTab('tasks')}
                            className="text-xs text-blue-600 hover:underline font-medium"
                          >
                            View All ({tasks.length})
                          </button>
                        </div>
                        <TaskTable
                          tasks={tasks.slice(0, 5)}
                          onOpenActionModal={(t) => setSelectedTaskForAction(t)}
                          currentUser={currentUser}
                          onRefresh={() => fetchTasks()}
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
                  currentUser={currentUser}
                  onRefresh={() => fetchTasks()}
                />
              )}
            </div>
          )}

          {/* TAB 3: BUSINESS & ORG MATRIX */}
          {activeTab === 'matrix' && canManageMatrix && (
            <div className="space-y-4">
              <BusinessDeptMatrixView
                currentUser={currentUser}
                userRole={currentUser.role}
                onClose={() => setActiveTab('landing')}
              />
            </div>
          )}

          {/* TAB 4: USER MANAGEMENT CONSOLE */}
          {activeTab === 'users' && isPrivileged && (
            <div className="space-y-4">
              <UserManagementView currentUser={currentUser} />
            </div>
          )}

          {/* TAB 5: REASON FORMS REVIEW HUB */}
          {activeTab === 'reviews' && isPrivileged && (
            <ReasonReviewsView currentUser={currentUser} />
          )}

          {/* TAB 6: HIERARCHY TREE */}
          {activeTab === 'tree' && isPrivileged && (
            <OrgTreeViewer
              currentUser={currentUser}
              onProfileUpdated={(updated) => setProfileData(updated)}
            />
          )}

          {/* TAB 7: PERSONAL DETAILS */}
          {activeTab === 'profile' && (
            <PersonalProfileView
              currentUser={currentUser}
              onProfileUpdated={(updated) => setProfileData(updated)}
            />
          )}

          {/* TAB 8: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <AuditLogViewer currentUser={currentUser} />
          )}
        </main>
      </div>

      {/* ===================== MODALS ===================== */}
      <CreateUserModal
        isOpen={isCreateUserOpen}
        onClose={() => setIsCreateUserOpen(false)}
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
    </div>
  );
}