import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import { apiRequest } from '../services/apiClient';
import { Button, EmptyState, SurfaceCard, formatDate, formatTime } from '../components/ui/Primitives';

export const NotificationsScreen: React.FC = () => {
  const { bootstrap, token, refreshData } = useWorkforce();
  const navigate = useNavigate();
  const notifications = bootstrap?.notifications || [];
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const visible = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  const handleOpen = async (id: string, targetRoute: string) => {
    await apiRequest(`/api/notifications/${id}/read`, { method: 'POST', token }).catch(() => {});
    await refreshData();
    navigate(targetRoute || '/');
  };

  const handleMarkAllRead = async () => {
    await apiRequest('/api/notifications/all/read', { method: 'POST', token });
    await refreshData();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#101F35]">Notifications</h1>
          <p className="text-sm text-[#64748B]">
            Real-time attendance, work review, payroll, leave, purchase, and safety alerts.
          </p>
        </div>
        {notifications.some((n) => !n.read) && (
          <Button variant="secondary" size="md" onClick={() => void handleMarkAllRead()}>
            <CheckCheck className="w-4 h-4" />
            Mark All Read
          </Button>
        )}
      </div>

      <div className="inline-flex p-1 bg-white border border-[#E2E8F0] rounded-xl gap-1">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`min-h-[38px] px-4 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
            filter === 'all' ? 'bg-[#101F35] text-white' : 'text-[#64748B]'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('unread')}
          className={`min-h-[38px] px-4 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
            filter === 'unread' ? 'bg-[#101F35] text-white' : 'text-[#64748B]'
          }`}
        >
          Unread ({notifications.filter((n) => !n.read).length})
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-6 h-6" />}
          title="You are all caught up"
          description="No unread notifications right now."
        />
      ) : (
        <SurfaceCard className="p-0 sm:p-0 divide-y divide-[#E2E8F0] overflow-hidden">
          {visible.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => void handleOpen(n.id, n.targetRoute)}
              className={`w-full text-left px-4 py-4 hover:bg-[#F5F7FA] transition-colors flex items-start gap-3.5 cursor-pointer ${
                !n.read ? 'bg-[#EAF2FF]/35' : ''
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  n.read ? 'bg-[#F5F7FA] text-[#64748B]' : 'bg-[#2563EB] text-white'
                }`}
              >
                <Bell className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#2563EB]">
                    {n.category} · {n.projectSite}
                  </span>
                  <span className="text-[11px] font-mono text-[#64748B] shrink-0">
                    {formatDate(n.timestamp)} {formatTime(n.timestamp)}
                  </span>
                </div>
                <p className={`text-sm ${n.read ? 'font-semibold text-[#172B4D]' : 'font-bold text-[#101F35]'}`}>
                  {n.title}
                </p>
                <p className="text-xs text-[#64748B] leading-relaxed">{n.message}</p>
              </div>
            </button>
          ))}
        </SurfaceCard>
      )}
    </div>
  );
};
