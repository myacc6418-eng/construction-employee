import React from 'react';
import { AlertCircle, CheckCircle2, Clock, X, XCircle } from 'lucide-react';
import { clsx } from 'clsx';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return clsx(inputs);
}

export const formatINR = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
};

export const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatTime = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'warning' | 'success' | 'danger' | 'ghost';
  size?: 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}) => {
  const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'bg-[#2563EB] text-white hover:bg-[#1D4ED8] active:scale-[0.99]',
    secondary: 'bg-white text-[#172B4D] border border-[#E2E8F0] hover:bg-[#F5F7FA] active:scale-[0.99]',
    warning: 'bg-[#F59E0B] text-[#101F35] hover:bg-[#D97706] font-semibold active:scale-[0.99]',
    success: 'bg-[#16A34A] text-white hover:bg-[#15803D] active:scale-[0.99]',
    danger: 'bg-[#DC2626] text-white hover:bg-[#B91C1C] active:scale-[0.99]',
    ghost: 'bg-transparent text-[#172B4D] hover:bg-[#EAF2FF] active:scale-[0.99]',
  };
  const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
    md: 'min-h-[44px] px-4 py-2 text-sm rounded-xl',
    lg: 'min-h-[52px] px-6 py-3 text-base rounded-2xl',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]',
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
};

export const SurfaceCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}> = ({ children, className, onClick }) => {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-full text-left bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 transition-colors hover:border-[#2563EB]/40 focus-visible:outline-2 focus-visible:outline-[#2563EB] cursor-pointer',
          className
        )}
      >
        {children}
      </button>
    );
  }
  return (
    <div className={cn('bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5', className)}>
      {children}
    </div>
  );
};

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const StatusLabel: React.FC<{
  label: string;
  tone?: StatusTone;
  className?: string;
}> = ({ label, tone = 'neutral', className }) => {
  const map: Record<StatusTone, { text: string; icon: React.ReactNode }> = {
    success: {
      text: 'text-[#16A34A]',
      icon: <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />,
    },
    warning: {
      text: 'text-[#B45309]',
      icon: <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />,
    },
    danger: {
      text: 'text-[#DC2626]',
      icon: <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" />,
    },
    info: {
      text: 'text-[#2563EB]',
      icon: <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />,
    },
    neutral: {
      text: 'text-[#64748B]',
      icon: <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />,
    },
  };

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', map[tone].text, className)}>
      {map[tone].icon}
      <span>{label}</span>
    </span>
  );
};

export function inferStatusTone(status: string): StatusTone {
  const s = status.toLowerCase();
  if (
    s.includes('approved') ||
    s.includes('completed') ||
    s.includes('paid') ||
    s.includes('verified') ||
    s.includes('received') ||
    s.includes('reimbursed') ||
    s.includes('resolved') ||
    s.includes('synced') ||
    s.includes('checked in') ||
    s.includes('fully repaid')
  ) {
    return 'success';
  }
  if (
    s.includes('rejected') ||
    s.includes('failed') ||
    s.includes('rework') ||
    s.includes('outside') ||
    s.includes('expired') ||
    s.includes('unresolved') ||
    s.includes('critical')
  ) {
    return 'danger';
  }
  if (
    s.includes('pending') ||
    s.includes('review') ||
    s.includes('processing') ||
    s.includes('waiting') ||
    s.includes('not checked') ||
    s.includes('hold') ||
    s.includes('partial')
  ) {
    return 'warning';
  }
  if (s.includes('progress') || s.includes('submitted') || s.includes('acknowledged') || s.includes('uploading')) {
    return 'info';
  }
  return 'neutral';
}

export const ModalSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, subtitle, children }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#101F35]/60 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-lg max-h-[92vh] bg-white rounded-t-3xl sm:rounded-2xl border border-[#E2E8F0] flex flex-col overflow-hidden shadow-2xl">
        <div className="sm:hidden w-10 h-1.5 bg-[#E2E8F0] rounded-full mx-auto mt-3 shrink-0" />
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#E2E8F0] shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#101F35] truncate">{title}</h2>
            {subtitle && <p className="text-xs text-[#64748B] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#64748B] hover:bg-[#F5F7FA] hover:text-[#101F35] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">{children}</div>
      </div>
    </div>
  );
};

export const FormField: React.FC<{
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, required, error, hint, children }) => (
  <div className="space-y-1.5">
    <label className="block text-sm font-medium text-[#172B4D]">
      {label}
      {required && <span className="text-[#DC2626] ml-1">*</span>}
    </label>
    {children}
    {hint && !error && <p className="text-xs text-[#64748B]">{hint}</p>}
    {error && <p className="text-xs font-medium text-[#DC2626]">{error}</p>}
  </div>
);

export const inputClass =
  'w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-white text-[#172B4D] border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 placeholder:text-[#64748B]/70';

export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 text-center space-y-3">
    <div className="w-12 h-12 rounded-2xl bg-[#EAF2FF] text-[#2563EB] flex items-center justify-center mx-auto">
      {icon}
    </div>
    <h3 className="text-base font-semibold text-[#101F35]">{title}</h3>
    <p className="text-sm text-[#64748B] max-w-sm mx-auto">{description}</p>
    {action && <div className="pt-2">{action}</div>}
  </div>
);

export const SampleBanner: React.FC<{ label?: string }> = ({
  label = 'Illustrative Sample Data — Realistic demo construction records for testing',
}) => (
  <div className="text-xs text-[#64748B] bg-[#EAF2FF]/70 border border-[#2563EB]/20 rounded-xl px-3.5 py-2 flex items-center justify-between gap-2">
    <span>{label}</span>
  </div>
);
