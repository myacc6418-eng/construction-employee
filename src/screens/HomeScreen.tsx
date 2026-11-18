import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Briefcase,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock,
  IndianRupee,
  LifeBuoy,
  MapPin,
  Navigation,
  ShoppingCart,
  UserCheck,
  Wallet,
} from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import { Button, SampleBanner, StatusLabel, SurfaceCard, formatTime, inferStatusTone } from '../components/ui/Primitives';

function getGreeting(): string {
  const hr = new Date().getHours();
  if (hr < 12) return 'Good Morning';
  if (hr < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function formatDurationMinutes(startIso: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(startIso).getTime());
  const totalMins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `${hrs}h ${String(mins).padStart(2, '0')}m`;
}

export const HomeScreen: React.FC = () => {
  const { bootstrap, lastLocationPingAt } = useWorkforce();
  const navigate = useNavigate();
  const [, setTick] = useState(0);

  const emp = bootstrap?.employee;
  const activeSession = bootstrap?.activeSession;
  const unresolvedSession = bootstrap?.unresolvedSession;
  const primarySite = bootstrap?.authorizedSites.find((s) => s.id === emp?.primarySiteId) || bootstrap?.authorizedSites[0];
  const works = bootstrap?.workAssignments || [];
  const notifications = bootstrap?.notifications || [];

  useEffect(() => {
    if (!activeSession) return;
    const t = setInterval(() => setTick((v) => v + 1), 30_000);
    return () => clearInterval(t);
  }, [activeSession]);

  if (!emp) return null;

  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const completedTasks = works.filter((w) => w.status === 'Completed').length;
  const pendingTasks = works.filter((w) => w.status !== 'Completed').length;

  const quickActions = [
    {
      label: activeSession ? 'Check Out' : 'Check In',
      sub: activeSession ? 'End shift with selfie' : 'Live selfie + GPS',
      icon: Camera,
      to: '/attendance',
      accent: true,
    },
    {
      label: 'View Work',
      sub: `${pendingTasks} active task${pendingTasks === 1 ? '' : 's'}`,
      icon: Briefcase,
      to: '/work',
    },
    ...(emp.leaveEligible
      ? [
          {
            label: 'Request Leave',
            sub: 'Apply & check balance',
            icon: CalendarDays,
            to: '/leave',
          },
        ]
      : []),
    {
      label: 'View Salary',
      sub:
        emp.payModel === 'monthly_salaried'
          ? 'Salary & payslips'
          : emp.payModel === 'piece_rate'
          ? 'Approved quantities'
          : 'Daily wages & history',
      icon: IndianRupee,
      to: '/salary',
    },
    {
      label: 'Request Advance',
      sub: 'Advance & repayment',
      icon: Wallet,
      to: '/advances',
    },
    {
      label: 'Submit Purchase',
      sub: 'Material req / bills',
      icon: ShoppingCart,
      to: '/purchases',
    },
    {
      label: 'Report Issue',
      sub: 'Help desk & safety',
      icon: LifeBuoy,
      to: '/help',
    },
  ];

  return (
    <div className="space-y-6">
      {emp.isSampleData && (
        <SampleBanner label="Sample Employee View — Realistic demo profile and site data" />
      )}

      {/* Welcome & Worker Identity */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-[#64748B]">{todayFormatted}</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#101F35] tracking-tight mt-0.5">
              {getGreeting()}, {emp.fullName}
            </h1>
            <p className="text-sm text-[#64748B]">Your workday starts here.</p>
          </div>
          <div className="text-xs text-[#64748B] sm:text-right">
            <span className="font-mono font-semibold text-[#101F35]">{emp.employeeCode}</span>
            <span aria-hidden="true"> · </span>
            <span>{emp.designation}</span>
            <span aria-hidden="true"> · </span>
            <span>{emp.employmentCategory}</span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-2xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#172B4D]">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[#2563EB]" />
            <strong>{emp.primaryProjectName}</strong> — {emp.primarySiteName}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#64748B]">
            <UserCheck className="w-4 h-4 text-[#64748B]" />
            Supervisor: <strong className="text-[#172B4D]">{emp.reportingSupervisorName}</strong>
          </span>
        </div>
      </section>

      {/* Unresolved Previous Session Recovery Warning */}
      {unresolvedSession && (
        <SurfaceCard className="bg-[#FFFBEB] border-[#F59E0B]/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-[#B45309] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <StatusLabel label="Unresolved Previous Session" tone="danger" />
                <h2 className="text-base font-bold text-[#101F35]">
                  Missing Check-Out from {unresolvedSession.shiftDate}
                </h2>
                <p className="text-sm text-[#64748B]">
                  You checked in at {unresolvedSession.siteName} ({formatTime(unresolvedSession.checkInTime)}) but did not check out. Resolve it before starting a new attendance session.
                </p>
              </div>
            </div>
            <Button variant="warning" size="lg" onClick={() => navigate('/attendance')}>
              Resolve Session
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </SurfaceCard>
      )}

      {/* Primary Focal Anchor: Attendance Status Card + Today's Work Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <SurfaceCard className="lg:col-span-7 flex flex-col justify-between bg-[#101F35] text-white border-[#101F35]">
          {!activeSession ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F59E0B]">
                  <Clock className="w-4 h-4" />
                  Not Checked In
                </span>
                <span className="text-xs text-white/70">{primarySite?.shiftName || 'Day Shift'}</span>
              </div>

              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  {primarySite?.siteName || emp.primarySiteName}
                </h2>
                <p className="text-sm text-white/75">{primarySite?.address || emp.primaryProjectName}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-white/15 text-xs">
                <div>
                  <span className="text-white/60 block">Scheduled Start</span>
                  <span className="font-mono font-semibold text-white tabular-nums">
                    {primarySite?.shiftStart || '08:00 AM'}
                  </span>
                </div>
                <div>
                  <span className="text-white/60 block">Geofence</span>
                  <span className="font-semibold text-white">
                    {primarySite?.geofenceEnabled ? `${primarySite.geofenceRadiusMeters}m radius` : 'Standard'}
                  </span>
                </div>
                <div>
                  <span className="text-white/60 block">Availability</span>
                  <span className="font-semibold text-[#F59E0B]">
                    {unresolvedSession ? 'Resolve previous first' : 'Ready for Selfie Check-In'}
                  </span>
                </div>
              </div>

              <Button
                variant="warning"
                size="lg"
                className="w-full text-base font-bold"
                onClick={() => navigate('/attendance')}
              >
                <Camera className="w-5 h-5" />
                {unresolvedSession ? 'RESOLVE & CHECK IN' : 'CHECK IN'}
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4ADE80]">
                  <CheckCircle2 className="w-4 h-4" />
                  Checked In
                </span>
                <span className="font-mono text-xs text-white/75 tabular-nums">
                  Ref: {activeSession.referenceId}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <img
                  src={activeSession.checkInSelfieDataUrl}
                  alt="Check-in selfie thumbnail"
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-white/30 shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0 space-y-1">
                  <p className="text-xs text-white/70">Active Session Duration</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-white">
                    {formatDurationMinutes(activeSession.checkInTime)}
                  </p>
                  <p className="text-xs text-white/80 truncate">
                    {activeSession.siteName} · In at {formatTime(activeSession.checkInTime)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/15 text-xs">
                <div>
                  <span className="text-white/60 block">Location Verification</span>
                  <span className="font-semibold text-[#4ADE80]">
                    {activeSession.checkInGeofence.statusLabel}
                  </span>
                </div>
                <div>
                  <span className="text-white/60 block">Last GPS Update</span>
                  <span className="font-mono text-white tabular-nums inline-flex items-center gap-1">
                    <Navigation className="w-3 h-3 text-[#60A5FA]" />
                    {formatTime(lastLocationPingAt || activeSession.lastLocationUpdateAt || activeSession.checkInTime)}
                  </span>
                </div>
              </div>

              <Button
                variant="danger"
                size="lg"
                className="w-full text-base font-bold"
                onClick={() => navigate('/attendance')}
              >
                <Camera className="w-5 h-5" />
                CHECK OUT
              </Button>
            </div>
          )}
        </SurfaceCard>

        {/* Today's Work Summary */}
        <SurfaceCard className="lg:col-span-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#101F35]">Today&apos;s Work Summary</h2>
              <button
                type="button"
                onClick={() => navigate('/work')}
                className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
              >
                Open My Work
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="bg-[#F5F7FA] rounded-xl p-3">
                <span className="text-2xl font-bold font-mono tabular-nums text-[#101F35] block">
                  {works.length}
                </span>
                <span className="text-xs text-[#64748B]">Assigned</span>
              </div>
              <div className="bg-[#F5F7FA] rounded-xl p-3">
                <span className="text-2xl font-bold font-mono tabular-nums text-[#16A34A] block">
                  {completedTasks}
                </span>
                <span className="text-xs text-[#64748B]">Completed</span>
              </div>
              <div className="bg-[#F5F7FA] rounded-xl p-3">
                <span className="text-2xl font-bold font-mono tabular-nums text-[#2563EB] block">
                  {pendingTasks}
                </span>
                <span className="text-xs text-[#64748B]">Active</span>
              </div>
            </div>

            {works.filter((w) => w.status !== 'Completed').slice(0, 2).map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => navigate('/work')}
                className="w-full text-left py-2.5 border-t border-[#E2E8F0] flex items-center justify-between gap-3 hover:bg-[#F5F7FA] rounded-lg px-2 transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#101F35] truncate">{w.title}</p>
                  <p className="text-xs text-[#64748B] truncate">
                    {w.taskCode} · {w.locationFloor}
                  </p>
                </div>
                <StatusLabel label={w.status} tone={inferStatusTone(w.status)} className="shrink-0" />
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-[#E2E8F0] text-xs text-[#64748B] flex items-center justify-between">
            <span>Supervisor: {emp.reportingSupervisorName}</span>
            <span className="font-mono">{emp.primarySiteName}</span>
          </div>
        </SurfaceCard>
      </div>

      {/* Quick Actions */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-[#101F35]">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {quickActions.map((act) => {
            const Icon = act.icon;
            return (
              <button
                key={act.label}
                type="button"
                onClick={() => navigate(act.to)}
                className="text-left bg-white border border-[#E2E8F0] hover:border-[#2563EB] rounded-2xl p-4 min-h-[96px] flex flex-col justify-between transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2563EB]"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    act.accent ? 'bg-[#2563EB] text-white' : 'bg-[#EAF2FF] text-[#2563EB]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="pt-3">
                  <p className="text-sm font-bold text-[#101F35]">{act.label}</p>
                  <p className="text-xs text-[#64748B] truncate">{act.sub}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Notifications Preview */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#101F35]">Latest Notifications</h2>
          <button
            type="button"
            onClick={() => navigate('/notifications')}
            className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
          >
            View All ({notifications.length})
          </button>
        </div>

        <SurfaceCard className="p-0 sm:p-0 divide-y divide-[#E2E8F0] overflow-hidden">
          {notifications.slice(0, 3).map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => navigate(n.targetRoute || '/notifications')}
              className="w-full text-left px-4 py-3.5 hover:bg-[#F5F7FA] transition-colors flex items-start gap-3 cursor-pointer"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${n.read ? 'bg-[#F5F7FA] text-[#64748B]' : 'bg-[#EAF2FF] text-[#2563EB]'}`}>
                <Bell className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm truncate ${n.read ? 'font-medium text-[#172B4D]' : 'font-bold text-[#101F35]'}`}>
                    {n.title}
                  </p>
                  <span className="text-[11px] font-mono text-[#64748B] shrink-0">
                    {formatTime(n.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-[#64748B] line-clamp-2 mt-0.5">{n.message}</p>
              </div>
            </button>
          ))}
        </SurfaceCard>
      </section>
    </div>
  );
};
