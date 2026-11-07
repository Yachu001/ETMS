// frontend/src/components/OrgTreeViewer.jsx

import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Users, ChevronRight, ChevronDown, CheckCircle2, Clock, RefreshCw } from 'lucide-react';

function TreeNode({ node, depth = 0 }) {
  const [isOpen, setIsOpen] = useState(true);
  const hasSubordinates = Boolean(node.subordinates && node.subordinates.length > 0);

  const roleColors = {
    SUPER_ADMIN: 'bg-amber-500/15 text-amber-300 border-amber-400/50 shadow-[0_0_10px_rgba(245,158,11,0.15)]',
    ADMIN: 'bg-amber-500/10 text-amber-200 border-amber-400/35',
    DEPT_HEAD: 'bg-[#181612] text-amber-200 border-amber-500/30',
    BUSINESS_ADMIN: 'bg-[#181510] text-amber-300 border-amber-500/30',
    SUPERVISOR: 'bg-neutral-900 text-amber-300/90 border-amber-500/25',
    EMPLOYEE: 'bg-neutral-900/80 text-neutral-300 border-neutral-800',
  };

  return (
    <div className={`space-y-2 ${depth > 0 ? 'ml-4 sm:ml-8 pl-3 sm:pl-4 border-l-2 border-amber-400/30' : ''}`}>
      {/* Node Container: Deep obsidian fill with crisp gold border and ambient glow */}
      <div className="flex items-center gap-2 bg-[#101216] p-3 rounded-2xl border border-amber-400/40 shadow-[0_4px_20px_rgba(0,0,0,0.7),0_0_12px_rgba(245,158,11,0.08)] hover:border-amber-400/70 hover:shadow-[0_0_16px_rgba(245,158,11,0.18)] transition-all duration-200">
        {hasSubordinates ? (
          <button 
            type="button"
            onClick={() => setIsOpen(!isOpen)} 
            className="p-1 hover:bg-amber-500/10 rounded-lg text-amber-400 hover:text-amber-300 transition shrink-0 cursor-pointer"
            title={isOpen ? "Collapse branch" : "Expand branch"}
          >
            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        ) : (
          <span className="w-5 flex justify-center text-amber-400/40 shrink-0">•</span>
        )}

        <div className="flex-1 flex flex-wrap items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* User Avatar Chip */}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1c1917] via-[#161412] to-[#0a0a0a] text-amber-300 border border-amber-400/50 flex items-center justify-center font-bold text-xs shrink-0 shadow-[0_2px_8px_rgba(212,175,55,0.15)] ring-1 ring-amber-400/20">
              {(node.full_name || node.username || 'U').substring(0, 2).toUpperCase()}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-bold text-white truncate tracking-wide">
                  {node.full_name || node.username}
                </span>
                {node.is_present !== undefined && (
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 uppercase tracking-wider ${
                    node.is_present 
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-400/40 shadow-[0_0_8px_rgba(245,158,11,0.15)]' 
                      : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                  }`}>
                    {node.is_present ? <CheckCircle2 size={10} className="text-amber-400" /> : <Clock size={10} className="text-neutral-500" />}
                    {node.is_present ? 'Present' : 'Leave'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                {node.designation || 'Staff'} {node.primary_department ? `• ${node.primary_department}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border uppercase font-bold tracking-wider ${roleColors[node.role] || 'bg-neutral-900 text-neutral-300 border-neutral-800'}`}>
              {node.role.replace('_', ' ')}
            </span>
            {hasSubordinates && (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/40 flex items-center gap-1 shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                <Users size={11} className="text-amber-400" /> {node.subordinates.length}
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
      <div className="bg-[#0b0c0e] border border-amber-400/40 rounded-3xl p-10 text-center shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_20px_rgba(245,158,11,0.12)]">
        <div className="text-xs text-amber-200/70 flex items-center justify-center gap-2 font-medium">
          <RefreshCw size={14} className="animate-spin text-amber-400" />
          Loading reporting tree...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#0b0c0e] border border-rose-500/30 rounded-3xl p-6 shadow-2xl text-center space-y-2">
        <div className="text-xs text-rose-400 font-medium">{error}</div>
        <button
          onClick={fetchTree}
          className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-[0_0_12px_rgba(212,175,55,0.25)]"
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#0b0c0e] border border-amber-400/50 rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_25px_rgba(245,158,11,0.14)] space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-amber-500/20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1c1917] via-[#161412] to-[#0a0a0a] text-amber-300 border border-amber-400/40 flex items-center justify-center shadow-xs">
            <Users size={16} className="text-amber-400" />
          </div>
          <h3 className="text-sm font-bold text-white tracking-wide">Hierarchical Reporting Line</h3>
        </div>
        <button
          onClick={fetchTree}
          className="text-xs text-amber-200/70 hover:text-white flex items-center gap-1.5 border border-amber-500/30 px-3 py-1.5 rounded-xl hover:bg-amber-500/10 hover:border-amber-400/60 transition cursor-pointer shadow-xs"
        >
          <RefreshCw size={12} className="text-amber-400" /> Refresh
        </button>
      </div>

      <div className="pt-2">
        {treeData ? (
          <TreeNode node={treeData} depth={0} />
        ) : (
          <p className="text-xs text-neutral-500 py-4 text-center">No tree data found.</p>
        )}
      </div>
    </div>
  );
}