// frontend/src/components/OrgTreeViewer.jsx

import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Users, ChevronRight, ChevronDown, CheckCircle2, Clock, RefreshCw } from 'lucide-react';

function TreeNode({ node, depth = 0 }) {
  const [isOpen, setIsOpen] = useState(true);
  const hasSubordinates = Boolean(node.subordinates && node.subordinates.length > 0);

  const roleColors = {
    SUPER_ADMIN: 'bg-rose-50 text-rose-700 border-rose-200',
    ADMIN: 'bg-blue-100/80 text-blue-800 border-blue-300',
    DEPT_HEAD: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    BUSINESS_ADMIN: 'bg-sky-50 text-sky-700 border-sky-200',
    SUPERVISOR: 'bg-blue-50 text-blue-700 border-blue-200',
    EMPLOYEE: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <div className={`space-y-2 ${depth > 0 ? 'ml-4 sm:ml-8 pl-3 sm:pl-4 border-l-2 border-blue-200' : ''}`}>
      {/* Node Container: Crisp pure white card with soft slate border and subtle royal blue hover elevation */}
      <div className="flex items-center gap-2 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-[0_4px_14px_rgba(15,23,42,0.04)] hover:border-blue-300 hover:shadow-[0_6px_18px_rgba(37,99,235,0.08)] transition-all duration-200">
        {hasSubordinates ? (
          <button 
            type="button"
            onClick={() => setIsOpen(!isOpen)} 
            className="p-1.5 hover:bg-blue-50 rounded-xl text-blue-600 hover:text-blue-700 transition shrink-0 cursor-pointer"
            title={isOpen ? "Collapse branch" : "Expand branch"}
          >
            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        ) : (
          <span className="w-6 flex justify-center text-slate-300 shrink-0">&bull;</span>
        )}

        <div className="flex-1 flex flex-wrap items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* User Avatar Chip */}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-700 border border-blue-200/90 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs ring-1 ring-blue-500/10">
              {(node.full_name || node.username || 'U').substring(0, 2).toUpperCase()}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-bold text-slate-900 truncate tracking-wide">
                  {node.full_name || node.username}
                </span>
                {node.is_present !== undefined && (
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 uppercase tracking-wider ${
                    node.is_present 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}>
                    {node.is_present ? <CheckCircle2 size={10} className="text-emerald-600" /> : <Clock size={10} className="text-slate-400" />}
                    {node.is_present ? 'Present' : 'Leave'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {node.designation || 'Staff'} {node.primary_department ? `• ${node.primary_department}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border uppercase font-bold tracking-wider ${roleColors[node.role] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
              {node.role.replace('_', ' ')}
            </span>
            {hasSubordinates && (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1 shadow-2xs">
                <Users size={11} className="text-blue-600" /> {node.subordinates.length}
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
      <div className="bg-white border border-slate-200/90 rounded-3xl p-10 text-center shadow-[0_8px_25px_rgba(15,23,42,0.05)]">
        <div className="text-xs text-slate-500 flex items-center justify-center gap-2 font-medium">
          <RefreshCw size={14} className="animate-spin text-blue-600" />
          Loading reporting tree...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-rose-200 rounded-3xl p-6 shadow-[0_8px_25px_rgba(15,23,42,0.05)] text-center space-y-2.5">
        <div className="text-xs text-rose-600 font-semibold">{error}</div>
        <button
          type="button"
          onClick={fetchTree}
          className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-[0_4px_12px_rgba(37,99,235,0.25)]"
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-[0_8px_30px_rgba(15,23,42,0.06)] space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center shadow-2xs">
            <Users size={16} />
          </div>
          <h3 className="text-sm font-bold text-slate-900 tracking-wide">Hierarchical Reporting Line</h3>
        </div>
        <button
          type="button"
          onClick={fetchTree}
          className="text-xs text-slate-600 hover:text-blue-700 font-semibold flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition cursor-pointer shadow-2xs"
        >
          <RefreshCw size={12} className="text-blue-600" /> Refresh
        </button>
      </div>

      <div className="pt-2">
        {treeData ? (
          <TreeNode node={treeData} depth={0} />
        ) : (
          <p className="text-xs text-slate-400 py-4 text-center">No tree data found.</p>
        )}
      </div>
    </div>
  );
}