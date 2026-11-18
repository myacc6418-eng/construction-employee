import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HardHat, KeyRound, ShieldCheck, UserCheck } from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import { apiRequest, type SampleWorkerSummary } from '../services/apiClient';
import { Button, FormField, SampleBanner, inputClass } from '../components/ui/Primitives';

const loginSchema = z.object({
  employeeCode: z.string().min(3, 'Enter your Employee ID (e.g. BF-EMP-1001)'),
  pin: z.string().length(4, 'Enter your 4-digit PIN'),
});

type LoginForm = z.infer<typeof loginSchema>;

export const LoginScreen: React.FC = () => {
  const { login } = useWorkforce();
  const [samples, setSamples] = useState<SampleWorkerSummary[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loadingCode, setLoadingCode] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { employeeCode: 'BF-EMP-1001', pin: '1234' },
  });

  useEffect(() => {
    apiRequest<{ profiles: SampleWorkerSummary[] }>('/api/auth/sample-profiles')
      .then((res) => setSamples(res.profiles))
      .catch(() => {});
  }, []);

  const onSubmit = async (data: LoginForm) => {
    setServerError(null);
    try {
      await login(data.employeeCode, data.pin);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Unable to sign in.');
    }
  };

  const handleQuickLogin = async (employeeCode: string) => {
    setServerError(null);
    setLoadingCode(employeeCode);
    setValue('employeeCode', employeeCode);
    setValue('pin', '1234');
    try {
      await login(employeeCode, '1234');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoadingCode(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Brand & Worker Sign-In Form */}
        <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#101F35] text-white flex items-center justify-center font-bold text-lg">
                <HardHat className="w-6 h-6 text-[#F59E0B]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#101F35]">BuildFlow Workforce</h1>
                <p className="text-xs text-[#64748B]">Employee & Construction Labour App</p>
              </div>
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-[#101F35] tracking-tight">Worker Sign In</h2>
              <p className="text-sm text-[#64748B]">
                Check in with a live selfie, view today&apos;s site tasks, and track your wages.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <FormField label="Employee ID" required error={errors.employeeCode?.message}>
                <input
                  {...register('employeeCode')}
                  placeholder="e.g. BF-EMP-1001"
                  className={inputClass}
                  autoComplete="username"
                />
              </FormField>

              <FormField
                label="4-Digit Site PIN"
                required
                error={errors.pin?.message}
                hint="Demo PIN for all sample profiles is 1234"
              >
                <input
                  {...register('pin')}
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  className={inputClass}
                  autoComplete="current-password"
                />
              </FormField>

              {serverError && (
                <div className="rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/25 px-3.5 py-2.5 text-xs font-medium text-[#DC2626]">
                  {serverError}
                </div>
              )}

              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isSubmitting}>
                <KeyRound className="w-4 h-4" />
                {isSubmitting ? 'Signing In...' : 'Sign In to Workspace'}
              </Button>
            </form>
          </div>

          <div className="pt-6 mt-6 border-t border-[#E2E8F0] flex items-center gap-2.5 text-xs text-[#64748B]">
            <ShieldCheck className="w-4 h-4 text-[#16A34A] shrink-0" />
            <span>Protected session · Employees can only access their own site, attendance, and wage records.</span>
          </div>
        </div>

        {/* Sample Indian Construction Worker Profiles */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-[#101F35]">Quick Demo Worker Access</h2>
            <p className="text-sm text-[#64748B]">
              Select any illustrative worker profile below to experience how BuildFlow adapts across salaried, daily-wage, and piece-rate categories.
            </p>
          </div>

          <SampleBanner label="Sample Demo Data — Illustrative Indian construction worker accounts (PIN: 1234)" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {samples.map((w) => (
              <button
                key={w.employeeCode}
                type="button"
                onClick={() => void handleQuickLogin(w.employeeCode)}
                disabled={loadingCode === w.employeeCode}
                className="text-left bg-white border border-[#E2E8F0] hover:border-[#2563EB] rounded-2xl p-4 transition-all cursor-pointer flex items-start gap-3.5 focus-visible:outline-2 focus-visible:outline-[#2563EB]"
              >
                <img
                  src={w.avatarUrl}
                  alt={w.fullName}
                  className="w-14 h-14 rounded-xl object-cover border border-[#E2E8F0] shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-[#101F35] truncate">{w.fullName}</span>
                    <span className="font-mono text-[11px] font-semibold text-[#2563EB] shrink-0">
                      {w.employeeCode}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-[#172B4D]">
                    {w.designation} · {w.employmentCategory}
                  </p>
                  <p className="text-xs text-[#64748B] truncate">
                    {w.primarySiteName} · {w.primaryProjectName}
                  </p>
                  <div className="pt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB]">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>{loadingCode === w.employeeCode ? 'Opening...' : 'Tap to Sign In'}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
