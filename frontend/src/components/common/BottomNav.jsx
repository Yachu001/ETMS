import {
  LayoutDashboard,
  CheckSquare,
  UserCog,
  Building2,
  User,
} from 'lucide-react';

export default function BottomNav({
  currentUser,
  activeTab,
  setActiveTab,
  pendingTasksCount = 0,
}) {
  if (!currentUser) return null;

  const isPrivileged = [
    'SUPERVISOR',
    'ADMIN',
    'SUPER_ADMIN',
    'DEPT_HEAD',
    'BUSINESS_ADMIN',
  ].includes(currentUser.role);

  const canManageMatrix = [
    'SUPER_ADMIN',
    'ADMIN',
    'BUSINESS_ADMIN',
    'DEPT_HEAD',
  ].includes(currentUser.role);

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 md:hidden flex items-center justify-around px-2 py-1.5 shadow-lg">
      {/* 1. Overview Landing */}
      <button
        type="button"
        onClick={() => setActiveTab('landing')}
        className={`flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-semibold transition ${
          activeTab === 'landing'
            ? 'text-blue-600'
            : 'text-slate-400 hover:text-slate-700'
        }`}
      >
        <LayoutDashboard size={18} className={activeTab === 'landing' ? 'stroke-[2.5]' : ''} />
        <span className="mt-0.5">Overview</span>
      </button>

      {/* 2. Tasks Backlog */}
      <button
        type="button"
        onClick={() => setActiveTab('tasks')}
        className={`relative flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-semibold transition ${
          activeTab === 'tasks'
            ? 'text-blue-600'
            : 'text-slate-400 hover:text-slate-700'
        }`}
      >
        <CheckSquare size={18} className={activeTab === 'tasks' ? 'stroke-[2.5]' : ''} />
        <span className="mt-0.5">Tasks</span>
        {pendingTasksCount > 0 && (
          <span className="absolute top-0.5 right-4 bg-amber-500 text-slate-950 font-bold px-1 rounded-full text-[9px] min-w-[14px] text-center">
            {pendingTasksCount}
          </span>
        )}
      </button>

      {/* 3. User Roster (Privileged) or Matrix */}
      {isPrivileged ? (
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-semibold transition ${
            activeTab === 'users'
              ? 'text-blue-600'
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          <UserCog size={18} className={activeTab === 'users' ? 'stroke-[2.5]' : ''} />
          <span className="mt-0.5">Users</span>
        </button>
      ) : canManageMatrix ? (
        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          className={`flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-semibold transition ${
            activeTab === 'matrix'
              ? 'text-blue-600'
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          <Building2 size={18} className={activeTab === 'matrix' ? 'stroke-[2.5]' : ''} />
          <span className="mt-0.5">Matrix</span>
        </button>
      ) : null}

      {/* 4. Personal Profile */}
      <button
        type="button"
        onClick={() => setActiveTab('profile')}
        className={`flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-semibold transition ${
          activeTab === 'profile'
            ? 'text-blue-600'
            : 'text-slate-400 hover:text-slate-700'
        }`}
      >
        <User size={18} className={activeTab === 'profile' ? 'stroke-[2.5]' : ''} />
        <span className="mt-0.5">Profile</span>
      </button>
    </nav>
  );
}