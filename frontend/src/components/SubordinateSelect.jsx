import React, { useState, useEffect } from 'react';
import api from '../api/axios';

export default function SubordinateSelect({ value, onChange, placeholder = "Select Assignee..." }) {
  const [subordinates, setSubordinates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/org/my-subordinates/')
      .then(res => {
        setSubordinates(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={loading || subordinates.length === 0}
      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      <option value="">{loading ? "Loading reports..." : subordinates.length === 0 ? "No reporting staff found" : placeholder}</option>
      {subordinates.map(sub => (
        <option key={sub.id} value={sub.id}>
          {sub.username} ({sub.designation || 'Staff'}) — {sub.primary_department || 'General'}
        </option>
      ))}
    </select>
  );
}