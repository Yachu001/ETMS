import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRightLeft,
  X,
  CheckCheck,
  Check,
} from 'lucide-react';

export default function NotificationDrawer({ isOpen, onClose, onRefreshCount }) {
  if (!isOpen) return null;

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'UNREAD'

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const params = {};
      if (activeTab === 'UNREAD') params.is_read = 'false';
      const res = await api.get('/notifications/', { params });
      setNotifications(res.data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [activeTab]);

  const handleMarkAsRead = async (id, e) => {
    e.stopPropagation();
    try {
      await api.post(`/notifications/${id}/read/`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      if (onRefreshCount) onRefreshCount();
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read/');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      if (onRefreshCount) onRefreshCount();
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'TASK_ASSIGNED':
      case 'TASK_ACCEPTED':
      case 'TASK_VERIFIED':
        return <CheckCircle2 size={16} className="text-emerald-500" />;
      case 'TASK_OVERDUE':
      case 'DAILY_NO_ACTIVITY_ALERT':
        return <AlertTriangle size={16} className="text-rose-500" />;
      case 'IDLE_ALERT':
        return <Clock size={16} className="text-amber-500" />;
      case 'METRIX_TRANSFER':
      case 'METRIX_INCHARGE':
        return <ArrowRightLeft size={16} className="text-blue-500" />;
      default:
        return <Layers size={16} className="text-slate-400" />;
    }
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50">
      <div className="bg-white w-full max-w-sm h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-blue-600" />
            <h3 className="font-bold text-sm text-slate-800">Notifications</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Filters & Mark All */}
        <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between text-xs">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-2.5 py-1 rounded-md font-semibold transition ${
                activeTab === 'ALL'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('UNREAD')}
              className={`px-2.5 py-1 rounded-md font-semibold transition ${
                activeTab === 'UNREAD'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Unread
            </button>
          </div>

          <button
            type="button"
            onClick={handleMarkAllRead}
            className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
          >
            <CheckCheck size={14} /> Mark all read
          </button>
        </div>

        {/* List of Notifications */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No notifications in this view.
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-xl transition cursor-pointer mb-1 ${
                  item.is_read ? 'bg-white hover:bg-slate-50/80' : 'bg-blue-50/40 hover:bg-blue-50/70 border border-blue-100/60'
                }`}
                onClick={(e) => !item.is_read && handleMarkAsRead(item.id, e)}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 shrink-0">{getNotificationIcon(item.notification_type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs ${item.is_read ? 'font-medium text-slate-800' : 'font-bold text-slate-900'}`}>
                        {item.title}
                      </p>
                      {!item.is_read && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100/60 text-[10px] text-slate-400">
                      <span>{formatTimestamp(item.created_at)}</span>
                      {!item.is_read && (
                        <button
                          type="button"
                          onClick={(e) => handleMarkAsRead(item.id, e)}
                          className="text-blue-600 hover:underline flex items-center gap-0.5"
                        >
                          <Check size={12} /> Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}