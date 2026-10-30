import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Users, ChevronRight, ChevronDown, CheckCircle2, Clock, RefreshCw } from 'lucide-react';

function TreeNode({ node, depth = 0 }) {
  const [isOpen, setIsOpen] = useState(true);
  const hasSubordinates = Boolean(node.subordinates && node.subordinates.length > 0);

  const roleColors = {
    SUPER_ADMIN: 'bg-rose-50 text-rose-700 border-rose-200',
    ADMIN: 'bg-amber-50 text-amber-700 border-amber-200',
    DEPT_HEAD: 'bg-purple-50 text-purple-700 border-purple-200',
    BUSINESS_ADMIN: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    SUPERVISOR: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    EMPLOYEE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  return (
    <div className={`space-y-2 ${depth > 0 ? 'ml-4 sm:ml-8 pl-3 sm:pl-4 border-l-2 border-slate-200' : ''}`}>
      <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-xs transition">
        {hasSubordinates ? (
          <button 
            type="button"
            onClick={() => setIsOpen(!isOpen)} 
            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition shrink-0"
            title={isOpen ? "Collapse branch" : "Expand branch"}
          >
            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        ) : (
          <span className="w-5 flex justify-center text-slate-300 shrink-0">•</span>
        )}

        <div className="flex-1 flex flex-wrap items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs border border-slate-200 shrink-0">
              {(node.full_name || node.username || 'U').substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                  {node.full_name || node.username}
                </span>
                {node.is_present !== undefined && (
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold inline-flex items-center gap-1 ${
                    node.is_present ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {node.is_present ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                    {node.is_present ? 'Present' : 'Leave'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                {node.designation || 'Staff'} {node.primary_department ? `• ${node.primary_department}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${roleColors[node.role] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
              {node.role}
            </span>
            {hasSubordinates && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                <Users size={11} /> {node.subordinates.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {hasSubordinates && isOpen && (
        <div className="space-y-2 pt-1">
          {node.subordinates.map((subNode) => (
            <TreeNode key={subNode.id} node={subNode} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrgTreeViewer() {
  const [treeData, setTreeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTree = () => {
    setLoading(true);
    setError(null);
    api.get('/auth/org/tree/')
      .then((res) => {
        setTreeData(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load organization tree:', err);
        setError('Failed to fetch reporting tree structure.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTree();
  }, []);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-xs">
        <div className="text-xs text-slate-500 flex items-center justify-center gap-2">
          <RefreshCw size={14} className="animate-spin text-blue-600" />
          Loading reporting tree...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-6 shadow-xs text-center space-y-2">
        <div className="text-xs text-rose-600 font-medium">{error}</div>
        <button
          onClick={fetchTree}
          className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1"
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Users className="text-blue-600" size={18} />
          <h3 className="text-sm font-bold text-slate-900">Hierarchical Reporting Line</h3>
        </div>
        <button
          onClick={fetchTree}
          className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-50 transition"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="pt-2">
        {treeData ? (
          <TreeNode node={treeData} depth={0} />
        ) : (
          <p className="text-xs text-slate-500 py-4 text-center">No tree data found.</p>
        )}
      </div>
    </div>
  );
}