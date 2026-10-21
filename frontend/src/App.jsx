import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import CreateUserModal from './components/CreateUserModal';
import OrgTreeViewer from './components/OrgTreeViewer';
import SubordinateSelect from './components/SubordinateSelect';
import api from './api/axios';
import { 
  LogOut, 
  UserPlus, 
  UserCheck, 
  Network, 
  LayoutDashboard,
  Users
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'tree'
  const [selectedSubordinate, setSelectedSubordinate] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
      api.get('/auth/me/')
        .then(res => setProfileData(res.data))
        .catch(() => {});
    }
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    setCurrentUser(null);
    setProfileData(null);
  };

  if (!currentUser) {
    return (
      <Login 
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          api.get('/auth/me/').then(res => setProfileData(res.data));
        }} 
      />
    );
  }

  const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'].includes(currentUser.role);

  const roleBadgeColors = {
    SUPER_ADMIN: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    ADMIN: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    SUPERVISOR: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    EMPLOYEE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      
      {/* Top Navbar */}
      <header className="bg-slate-800/80 backdrop-blur-md border-b border-slate-700/80 px-6 py-3.5 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <span className="text-lg font-black tracking-tight text-blue-400">TeamPulse</span>
          <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${roleBadgeColors[currentUser.role] || 'bg-slate-700 text-slate-300'}`}>
            {currentUser.role}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs font-semibold text-white">{currentUser.username}</div>
            <div className="text-[11px] text-slate-400">{currentUser.designation || 'Staff Member'}</div>
          </div>

          {isPrivileged && (
            <button
              onClick={() => setIsCreateUserOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 shadow-sm shadow-emerald-600/30"
            >
              <UserPlus size={14} />
              + Create User
            </button>
          )}

          <button
            onClick={handleLogout}
            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition"
            title="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Workspace Navigation Tabs (Visible for Supervisors/Admins) */}
      {isPrivileged && (
        <div className="bg-slate-800/40 border-b border-slate-700/50 px-6 pt-2">
          <div className="max-w-6xl mx-auto flex gap-4">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 pb-2.5 px-1 text-xs font-semibold border-b-2 transition ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard size={15} />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('tree')}
              className={`flex items-center gap-2 pb-2.5 px-1 text-xs font-semibold border-b-2 transition ${
                activeTab === 'tree'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Network size={15} />
              Reporting Hierarchy
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace Container */}
      <main className="max-w-6xl mx-auto px-4 py-8 w-full flex-1 space-y-6">
        
        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <UserCheck className="text-blue-400" size={22} />
                    Welcome Back, {currentUser.username}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    System ready. Phase 1 (Auth) and Phase 2 (Reporting Structure) are connected.
                  </p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                  System Online
                </span>
              </div>

              {profileData && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4">
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Primary Department</span>
                    <div className="text-sm font-bold text-white mt-1">
                      {profileData.departments?.length > 0 ? profileData.departments[0].name : 'Unassigned / Global Lead'}
                    </div>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4">
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">End-of-Day Reminder</span>
                    <div className="text-sm font-bold text-white mt-1">
                      {profileData.reminder_enabled ? `${profileData.reminder_time} (Active)` : 'Disabled'}
                    </div>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4">
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Auth Status</span>
                    <div className="text-sm font-bold text-emerald-400 mt-1">
                      JWT Session Active
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Test Preview for Phase 3 Task Assignment Subordinate Selector */}
            {isPrivileged && (
              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-md">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="text-indigo-400" size={18} />
                  <h3 className="text-sm font-bold text-white">Delegation Scope Test</h3>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Test the downstream subordinate selector that will be used when creating and assigning tasks.
                </p>
                
                <div className="max-w-md">
                  <SubordinateSelect 
                    value={selectedSubordinate} 
                    onChange={setSelectedSubordinate} 
                    placeholder="Choose a direct/indirect report..."
                  />
                  {selectedSubordinate && (
                    <p className="text-[11px] text-emerald-400 mt-2 font-mono">
                      Selected Report ID: {selectedSubordinate}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Organization Hierarchy Tree */}
        {activeTab === 'tree' && isPrivileged && (
          <div className="space-y-4">
            <OrgTreeViewer />
          </div>
        )}

      </main>

      {/* Internal User Provisioning Modal */}
      <CreateUserModal
        isOpen={isCreateUserOpen}
        onClose={() => setIsCreateUserOpen(false)}
        currentUserRole={currentUser.role}
      />
    </div>
  );
}