import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Users, ChevronRight, ChevronDown, User, RefreshCw } from 'lucide-react';

function TreeNode({ node }) {
  const [isOpen, setIsOpen] = useState(true);
  const hasSubordinates = node.subordinates && node.subordinates.length > 0;

  const roleColors = {
    SUPER_ADMIN: 'bg-rose-50 text-rose-700 border-rose-200',
    ADMIN: 'bg-amber-50 text-amber-700 border-amber-200',
    SUPERVISOR: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    EMPLOYEE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  return (
    <div className="ml-4 border-l-2 border-slate-200 pl-3 my-2">
      <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-xs transition">
        {hasSubordinates ? (
          <button 
            onClick={() => setIsOpen(!isOpen)} 
            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition"
            title={isOpen ? "Collapse branch" : "Expand branch"}
          >
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-5 flex justify-center text-slate-300">•</span>
        )}

        <div className="flex-1 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[11px] border border-slate-200">
              {node.username.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 mr-2">{node.username}</span>
              {/* <span className="text-[11px] text-slate-500 font-medium">({node.designation || 'Staff'})</span> */}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {node.primary_department && (
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-medium">
                {node.primary_department}
              </span>
            )}
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${roleColors[node.role] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
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

  const fetchTree = () => {
    setLoading(true);
    setError(null);
    api.get('/auth/org/tree/')
      .then(res => {
        setTreeData(res.data);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to fetch reporting tree structure.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTree();
  }, []);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-xs">
        <div className="text-xs text-slate-500 flex items-center justify-center gap-2">
          <RefreshCw size={14} className="animate-spin text-blue-600" />
          Loading reporting tree...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-6 shadow-xs">
        <div className="text-xs text-rose-600 font-medium">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
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
          <TreeNode node={treeData} />
        ) : (
          <p className="text-xs text-slate-500 py-4 text-center">No tree data found.</p>
        )}
      </div>
    </div>
  );
}