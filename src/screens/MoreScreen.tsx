import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  ChevronRight,
  FileText,
  HardHat,
  LifeBuoy,
  LogOut,
  ShoppingCart,
  User,
  Wallet,
} from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import { SurfaceCard } from '../components/ui/Primitives';

export const MoreScreen: React.FC = () => {
  const { bootstrap, logout } = useWorkforce();
  const navigate = useNavigate();
  const emp = bootstrap?.employee;
  const unread = (bootstrap?.notifications || []).filter((n) => !n.read).length;

  if (!emp) return null;

  const items = [
    ...(emp.leaveEligible
      ? [
          {
            to: '/leave',
            title: 'Leave Management',
            desc: 'Check leave balances and request time off',
            icon: CalendarDays,
          },
        ]
      : []),
    {
      to: '/advances',
      title: 'Advance & Loan Requests',
      desc: 'Request salary/wage advance and view repayment schedule',
      icon: Wallet,
    },
    {
      to: '/purchases',
      title: 'Materials & Purchase Bills',
      desc: 'Request site materials or submit purchase receipts',
      icon: ShoppingCart,
    },
    {
      to: '/documents',
      title: 'My Documents',
      desc: 'Employee ID, appointment letter, KYC & safety certificates',
      icon: FileText,
    },
    {
      to: '/safety',
      title: 'Safety & Site Information',
      desc: 'PPE rules, toolbox talks, emergency contacts & incident report',
      icon: HardHat,
    },
    {
      to: '/help',
      title: 'Complaints & Help Desk',
      desc: 'Attendance correction, salary discrepancy & support tickets',
      icon: LifeBuoy,
    },
    {
      to: '/notifications',
      title: 'Notifications',
      desc: unread > 0 ? `${unread} unread update(s)` : 'All site & payroll updates',
      icon: Bell,
    },
    {
      to: '/profile',
      title: 'My Profile, Offline Sync & Settings',
      desc: 'Personal details, offline draft queue & device diagnostics',
      icon: User,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#101F35]">More Services</h1>
        <p className="text-sm text-[#64748B]">
          Self-service modules for {emp.fullName} ({emp.employeeCode})
        </p>
      </div>

      <SurfaceCard className="p-0 sm:p-0 divide-y divide-[#E2E8F0] overflow-hidden">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.to}
              type="button"
              onClick={() => navigate(item.to)}
              className="w-full text-left px-4 py-4 hover:bg-[#F5F7FA] transition-colors flex items-center gap-3.5 cursor-pointer min-h-[64px]"
            >
              <div className="w-10 h-10 rounded-xl bg-[#EAF2FF] text-[#2563EB] flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#101F35]">{item.title}</p>
                <p className="text-xs text-[#64748B] truncate">{item.desc}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-[#64748B] shrink-0" />
            </button>
          );
        })}
      </SurfaceCard>

      <button
        type="button"
        onClick={() => void logout()}
        className="w-full min-h-[48px] rounded-2xl border border-[#DC2626]/30 bg-white text-[#DC2626] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#DC2626]/5 cursor-pointer"
      >
        <LogOut className="w-4 h-4" />
        Switch Worker / Sign Out
      </button>
    </div>
  );
};
