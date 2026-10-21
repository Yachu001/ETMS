import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Users, ChevronRight, ChevronDown, Shield, Briefcase } from 'lucide-react';

function TreeNode({ node }) {
  const [isOpen, setIsOpen] = useState(true);
  const hasSubordinates = node.subordinates && node.subordinates.length > 0;

  const roleColors = {
    SUPER_ADMIN: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    ADMIN: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    SUPERVISOR: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    EMPLOYEE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  };

  return (
    <div className="ml-4 border-l border-slate-700/60 pl-3 my-2">
      <div className="flex items-center gap-2 bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/50 hover:border-slate-600 transition">
        {hasSubordinates ? (
          <button 
            onClick={() => setIsOpen(!isOpen)} 
            className="p-1 hover:bg-slate-700 rounded text-slate-400"
          >
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-5" />
        )}

        <div className="flex-1 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-white mr-2">{node.username}</span>
            <span className="text-[11px] text-slate-400">({node.designation})</span>
          </div>

          <div className="flex items-center gap-2">
            {node.primary_department && (
              <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-medium">
                {node.primary_department}
              </span>
            )}
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${roleColors[node.role] || 'text-slate-300'}`}>
              {node.role}
            </span>
          </div>
        </div>
      </div>

      {hasSubordinates && isOpen && (
        <div className="ml-2">
          {node.subordinates.map(subNode => (
            <TreeNode key={subNode.id} node={subNode} />
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

  useEffect(() => {
    api.get('/auth/org/tree/')
      .then(res => {
        setTreeData(res.data);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to fetch reporting tree structure.');
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="text-xs text-slate-400 p-4">Loading reporting tree...</div>;
  if (error) return <div className="text-xs text-rose-400 p-4">{error}</div>;

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 shadow-lg">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-700">
        <Users className="text-blue-400" size={18} />
        <h3 className="text-sm font-bold text-white">Hierarchical Reporting Line</h3>
      </div>
      {treeData ? <TreeNode node={treeData} /> : <p className="text-xs text-slate-500">No tree data found.</p>}
    </div>
  );
}