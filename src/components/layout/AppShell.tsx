import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Briefcase,
  CalendarDays,
  Camera,
  CloudOff,
  FileText,
  HardHat,
  Home,
  IndianRupee,
  LayoutGrid,
  LifeBuoy,
  LogOut,
  RefreshCw,
  ShoppingCart,
  User,
  Wallet,
  Wifi,
} from 'lucide-react';
import { useWorkforce } from '../../context/WorkforceContext';
import { cn } from '../ui/Primitives';

const PRIMARY_TABS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/attendance', label: 'Attendance', icon: Camera },
  { to: '/work', label: 'My Work', icon: Briefcase },
  { to: '/salary', label: 'Salary', icon: IndianRupee },
  { to: '/more', label: 'More', icon: LayoutGrid },
];

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { bootstrap, isOnline, offlineQueue, isSyncing, syncOfflineQueue, logout } = useWorkforce();
  const navigate = useNavigate();
  const location = useLocation();

  const emp = bootstrap?.employee;
  const unreadCount = (bootstrap?.notifications || []).filter((n) => !n.read).length;
  const pendingQueueCount = offlineQueue.filter(
    (q) => q.status === 'Waiting to Sync' || q.status === 'Sync Failed' || q.status === 'Saved on Device'
  ).length;
  const activeSession = bootstrap?.activeSession;

  const secondaryLinks = [
    ...(emp?.leaveEligible ? [{ to: '/leave', label: 'Leave Requests', icon: CalendarDays }] : []),
    { to: '/advances', label: 'Advances & Loans', icon: Wallet },
    { to: '/purchases', label: 'Material Purchases', icon: ShoppingCart },
    { to: '/documents', label: 'My Documents', icon: FileText },
    { to: '/safety', label: 'Site Safety', icon: HardHat },
    { to: '/help', label: 'Help & Support', icon: LifeBuoy },
    { to: '/notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
    { to: '/profile', label: 'My Profile & Sync', icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#172B4D] flex flex-col lg:flex-row">
      {/* Desktop / Tablet Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:fixed lg:inset-y-0 lg:left-0 bg-[#101F35] text-white z-30">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#2563EB] flex items-center justify-center font-bold text-white shrink-0">
              BF
            </div>
            <div className="min-w-0">
              <span className="font-bold text-base tracking-tight block truncate">BuildFlow</span>
              <span className="text-[11px] text-white/65 block truncate">Employee & Labour App</span>
            </div>
          </div>
        </div>

        {emp && (
          <div className="p-4 border-b border-white/10 flex items-center gap-3">
            <img
              src={emp.avatarUrl}
              alt={emp.fullName}
              className="w-11 h-11 rounded-xl object-cover border border-white/20 shrink-0"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{emp.fullName}</p>
              <p className="text-xs text-white/70 truncate">
                {emp.designation} · {emp.employeeCode}
              </p>
              <p className="text-[11px] text-[#F59E0B] truncate mt-0.5">
                {emp.primarySiteName} · {emp.primaryProjectName}
              </p>
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <p className="px-3 pb-1 text-[11px] font-semibold text-white/45">Main Workspace</p>
          {PRIMARY_TABS.slice(0, 4).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-[#2563EB] text-white'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  )
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}

          <p className="px-3 pt-4 pb-1 text-[11px] font-semibold text-white/45">Site & Self-Service</p>
          {secondaryLinks.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-[#2563EB] text-white'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  )
                }
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge ? (
                  <span className="text-xs font-mono tabular-nums font-semibold text-[#F59E0B]">
                    {item.badge}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-2">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-white/85 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              {isOnline ? <Wifi className="w-3.5 h-3.5 text-[#16A34A]" /> : <CloudOff className="w-3.5 h-3.5 text-[#F59E0B]" />}
              <span>{isOnline ? 'Online · Synced' : 'Offline Mode'}</span>
            </span>
            {pendingQueueCount > 0 && (
              <span className="font-mono text-[#F59E0B]">{pendingQueueCount} pending</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-white/80 hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Switch / Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-72 flex flex-col min-h-screen">
        {/* Compact Sticky Mobile/Tablet Header (<=56px height) */}
        <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] px-4 lg:px-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="lg:hidden w-8 h-8 rounded-lg bg-[#101F35] text-white font-bold text-xs flex items-center justify-center shrink-0 cursor-pointer"
              aria-label="BuildFlow Home"
            >
              BF
            </button>
            <div className="min-w-0">
              <span className="text-sm font-bold text-[#101F35] truncate block">
                {emp ? emp.primarySiteName : 'BuildFlow'}
              </span>
              <span className="text-[11px] text-[#64748B] truncate block">
                {emp?.primaryProjectName || 'Site Workspace'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {activeSession?.trackingActive && (
              <button
                type="button"
                onClick={() => navigate('/attendance')}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#EAF2FF] text-[#2563EB] text-xs font-semibold cursor-pointer"
                title="Live work-session GPS tracking is active"
              >
                <span>GPS Active</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (pendingQueueCount > 0 && isOnline) {
                  void syncOfflineQueue();
                } else {
                  navigate('/profile');
                }
              }}
              className={cn(
                'min-h-[40px] px-2.5 rounded-xl flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-colors',
                isOnline ? 'text-[#16A34A] hover:bg-[#F5F7FA]' : 'text-[#B45309] bg-[#F59E0B]/15'
              )}
              title={isOnline ? 'Connected' : 'Offline — drafts stored on device'}
            >
              {isSyncing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : isOnline ? (
                <Wifi className="w-4 h-4" />
              ) : (
                <CloudOff className="w-4 h-4" />
              )}
              <span className="hidden sm:inline whitespace-nowrap">
                {isSyncing
                  ? 'Syncing...'
                  : pendingQueueCount > 0
                  ? `${pendingQueueCount} Pending`
                  : isOnline
                  ? 'Synced'
                  : 'Offline'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/notifications')}
              aria-label="Notifications"
              className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#172B4D] hover:bg-[#F5F7FA] cursor-pointer"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#DC2626] text-white text-[10px] font-mono font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {emp && (
              <button
                type="button"
                onClick={() => navigate('/profile')}
                aria-label="My Profile"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-[#F5F7FA] cursor-pointer"
              >
                <img
                  src={emp.avatarUrl}
                  alt={emp.fullName}
                  className="w-8 h-8 rounded-full object-cover border border-[#E2E8F0]"
                  referrerPolicy="no-referrer"
                />
              </button>
            )}
          </div>
        </header>

        {/* Responsive Main Viewport */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Fixed 5-Item Mobile Bottom Navigation (<=60px height) */}
      <nav
        aria-label="Primary Mobile Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E2E8F0] pb-safe"
      >
        <div className="grid grid-cols-5 h-[58px]">
          {PRIMARY_TABS.map((item) => {
            const Icon = item.icon;
            const isMoreSubRoute =
              item.to === '/more' &&
              ['/more', '/leave', '/advances', '/purchases', '/documents', '/safety', '/help', '/notifications', '/profile'].some(
                (p) => location.pathname.startsWith(p)
              );

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => {
                  const active = isActive || isMoreSubRoute;
                  return cn(
                    'flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors',
                    active ? 'text-[#2563EB]' : 'text-[#64748B]'
                  );
                }}
              >
                {({ isActive }) => {
                  const active = isActive || isMoreSubRoute;
                  return (
                    <>
                      <Icon className={cn('w-5 h-5', active && 'stroke-[2.4]')} />
                      <span className={cn('text-[11px] leading-none whitespace-nowrap', active ? 'font-bold' : 'font-medium')}>
                        {item.label}
                      </span>
                    </>
                  );
                }}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
