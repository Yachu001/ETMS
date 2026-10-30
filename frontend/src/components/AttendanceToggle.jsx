import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { UserCheck, UserX } from 'lucide-react';

export default function AttendanceToggle({ onStatusChange }) {
  const [isPresent, setIsPresent] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/attendance/today/')
      .then((res) => setIsPresent(Boolean(res.data.is_present)))
      .catch((err) => console.error('Failed to load attendance:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async () => {
    const nextStatus = !isPresent;
    try {
      await api.post('/auth/attendance/today/', { is_present: nextStatus });
      setIsPresent(nextStatus);
      if (onStatusChange) onStatusChange(nextStatus);
    } catch (err) {
      alert('Failed to update duty attendance status.');
    }
  };

  if (loading) return null;

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`flex items-center gap-1.5 text-xs px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition border shadow-2xs cursor-pointer ${
        isPresent
          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
          : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
      }`}
      title="Click to toggle your duty attendance for today"
    >
      {isPresent ? (
        <>
          <UserCheck size={14} className="text-emerald-600" />
          <span className="hidden sm:inline">Duty: <strong>Present</strong></span>
          <span className="sm:hidden font-bold">Present</span>
        </>
      ) : (
        <>
          <UserX size={14} className="text-amber-600" />
          <span className="hidden sm:inline">Duty: <strong>On Leave</strong></span>
          <span className="sm:hidden font-bold">Leave</span>
        </>
      )}
    </button>
  );
}