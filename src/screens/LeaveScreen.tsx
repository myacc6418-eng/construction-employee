import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarDays, CheckCircle2, Info, Plus } from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import { apiRequest } from '../services/apiClient';
import { generateIdempotencyKey } from '../services/offlineSync';
import {
  Button,
  EmptyState,
  FormField,
  ModalSheet,
  StatusLabel,
  SurfaceCard,
  formatDate,
  inferStatusTone,
  inputClass,
} from '../components/ui/Primitives';

const leaveSchema = z.object({
  leaveTypeId: z.string().min(1, 'Select leave type'),
  startDate: z.string().min(1, 'Select start date'),
  endDate: z.string().min(1, 'Select end date'),
  durationType: z.enum(['Full Day', 'First Half', 'Second Half']),
  reason: z.string().min(5, 'Enter reason for leave (min 5 characters)'),
  contactDuringLeave: z.string().optional(),
  supportingDocName: z.string().optional(),
});

type LeaveForm = z.infer<typeof leaveSchema>;

export const LeaveScreen: React.FC = () => {
  const { bootstrap, token, refreshData } = useWorkforce();
  const emp = bootstrap?.employee;
  const balances = bootstrap?.leaveBalances || [];
  const requests = bootstrap?.leaveRequests || [];

  const [modalOpen, setModalOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeaveForm>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      leaveTypeId: balances[0]?.leaveTypeId || 'cl',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      durationType: 'Full Day',
      reason: '',
      contactDuringLeave: emp?.phone || '',
    },
  });

  const startDate = watch('startDate');
  const endDate = watch('endDate');
  const durationType = watch('durationType');

  const estimatedDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;
    if (durationType !== 'Full Day') return 0.5;
    let count = 0;
    const cur = new Date(s);
    while (cur <= e) {
      if (cur.getDay() !== 0) count += 1;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }, [startDate, endDate, durationType]);

  if (!emp) return null;

  if (!emp.leaveEligible) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-[#101F35]">Leave Management</h1>
          <p className="text-sm text-[#64748B]">Employment category: {emp.employmentCategory}</p>
        </div>
        <EmptyState
          icon={<Info className="w-6 h-6" />}
          title="Paid Leave Balances Not Applicable"
          description={`As a ${emp.employmentCategory}, your compensation is based on approved site days/output rather than salaried annual leave quotas. If you need planned time off, inform your supervisor (${emp.reportingSupervisorName}) directly.`}
        />
      </div>
    );
  }

  const onSubmit = async (data: LeaveForm) => {
    setServerError(null);
    try {
      await apiRequest('/api/leaves', {
        method: 'POST',
        token,
        body: { ...data, idempotencyKey: generateIdempotencyKey('lv') },
      });
      await refreshData();
      setModalOpen(false);
      reset();
      setNotice('Leave request submitted to your supervisor and HR for review.');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Unable to submit leave request.');
    }
  };

  const handleCancel = async (id: string) => {
    await apiRequest(`/api/leaves/${id}/cancel`, { method: 'POST', token });
    await refreshData();
    setNotice('Pending leave request cancelled and balance restored.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#101F35]">Leave Management</h1>
          <p className="text-sm text-[#64748B]">Check your configured leave balances and request time off.</p>
        </div>
        <Button variant="primary" size="lg" onClick={() => setModalOpen(true)}>
          <Plus className="w-5 h-5" />
          Request Leave
        </Button>
      </div>

      {notice && (
        <div className="rounded-2xl bg-[#EAF2FF] border border-[#2563EB]/25 p-3.5 text-sm text-[#101F35] flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-[#2563EB] shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Leave Balances */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {balances.map((b) => (
          <SurfaceCard key={b.leaveTypeId} className="space-y-2">
            <p className="text-xs font-semibold text-[#64748B]">{b.leaveTypeName}</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-[#101F35]">
              {b.available} <span className="text-xs font-normal text-[#64748B]">avail</span>
            </p>
            <div className="text-[11px] font-mono text-[#64748B] flex items-center justify-between pt-1 border-t border-[#E2E8F0]">
              <span>Used: {b.used}</span>
              <span>Pending: {b.pending}</span>
            </div>
          </SurfaceCard>
        ))}
      </div>

      {/* Leave Request History */}
      <SurfaceCard className="space-y-3">
        <h2 className="text-base font-bold text-[#101F35]">Leave Request History</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-[#64748B] py-4">No leave requests submitted yet.</p>
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {requests.map((lr) => (
              <div key={lr.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-bold text-[#101F35]">{lr.leaveTypeName}</span>
                    <StatusLabel label={lr.status} tone={inferStatusTone(lr.status)} />
                  </div>
                  <p className="text-xs font-mono text-[#64748B] tabular-nums">
                    {formatDate(lr.startDate)} → {formatDate(lr.endDate)} · {lr.workingDaysCount} day(s) ({lr.durationType})
                  </p>
                  <p className="text-xs text-[#172B4D]">{lr.reason}</p>
                  {lr.reviewerRemarks && (
                    <p className="text-xs text-[#64748B]">Reviewer note: {lr.reviewerRemarks}</p>
                  )}
                </div>
                {['Submitted', 'Under Review', 'Draft'].includes(lr.status) && (
                  <Button variant="secondary" size="md" onClick={() => void handleCancel(lr.id)}>
                    Cancel Request
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>

      {/* Request Leave Modal */}
      <ModalSheet
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Request Leave"
        subtitle="Sundays are automatically excluded from working-day counts"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Leave Category" required error={errors.leaveTypeId?.message}>
            <select {...register('leaveTypeId')} className={inputClass}>
              {balances.map((b) => (
                <option key={b.leaveTypeId} value={b.leaveTypeId}>
                  {b.leaveTypeName} ({b.available} days available)
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start Date" required error={errors.startDate?.message}>
              <input type="date" {...register('startDate')} className={inputClass} />
            </FormField>
            <FormField label="End Date" required error={errors.endDate?.message}>
              <input type="date" {...register('endDate')} className={inputClass} />
            </FormField>
          </div>

          <FormField label="Duration">
            <select {...register('durationType')} className={inputClass}>
              <option value="Full Day">Full Day(s)</option>
              <option value="First Half">First Half (0.5 day)</option>
              <option value="Second Half">Second Half (0.5 day)</option>
            </select>
          </FormField>

          <div className="rounded-xl bg-[#F5F7FA] border border-[#E2E8F0] px-3.5 py-2.5 flex items-center justify-between text-xs">
            <span className="text-[#64748B] flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-[#2563EB]" />
              Calculated Working Days
            </span>
            <span className="font-mono font-bold text-[#101F35] tabular-nums">{estimatedDays} day(s)</span>
          </div>

          <FormField label="Reason" required error={errors.reason?.message}>
            <textarea
              rows={3}
              {...register('reason')}
              placeholder="Briefly explain why you need leave..."
              className={inputClass}
            />
          </FormField>

          <FormField label="Contact Number During Leave">
            <input {...register('contactDuringLeave')} className={inputClass} />
          </FormField>

          {serverError && (
            <div className="rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/25 p-3 text-xs font-medium text-[#DC2626]">
              {serverError}
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Leave Request'}
          </Button>
        </form>
      </ModalSheet>
    </div>
  );
};
