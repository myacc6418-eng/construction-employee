import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Plus, ShieldCheck, Wallet } from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import { apiRequest } from '../services/apiClient';
import { generateIdempotencyKey } from '../services/offlineSync';
import {
  Button,
  FormField,
  ModalSheet,
  StatusLabel,
  SurfaceCard,
  formatDate,
  formatINR,
  inferStatusTone,
  inputClass,
} from '../components/ui/Primitives';

const advanceSchema = z.object({
  requestType: z.enum(['Salary Advance', 'Wage Advance', 'Emergency Medical Loan', 'Festival Advance']),
  requestedAmount: z.number().min(200, 'Minimum ₹200').max(50000, 'Maximum ₹50,000'),
  repaymentMonths: z.number().min(1).max(12),
  reason: z.string().min(5, 'Provide a clear reason for your advance request'),
});

type AdvanceForm = z.infer<typeof advanceSchema>;

export const AdvancesScreen: React.FC = () => {
  const { bootstrap, token, refreshData } = useWorkforce();
  const emp = bootstrap?.employee;
  const advances = bootstrap?.advanceRequests || [];

  const [modalOpen, setModalOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AdvanceForm>({
    resolver: zodResolver(advanceSchema),
    defaultValues: {
      requestType: emp?.payModel === 'monthly_salaried' ? 'Salary Advance' : 'Wage Advance',
      requestedAmount: 1500,
      repaymentMonths: 3,
      reason: '',
    },
  });

  if (!emp) return null;

  const totalOutstanding = advances
    .filter((a) => !['Rejected', 'Fully Repaid'].includes(a.status))
    .reduce((acc, a) => acc + a.remainingBalance, 0);
  const totalRepaid = advances.reduce((acc, a) => acc + a.repaidAmount, 0);
  const pendingCount = advances.filter((a) => ['Submitted', 'Under Review'].includes(a.status)).length;

  const watchAmt = Number(watch('requestedAmount')) || 0;
  const watchMonths = Math.max(1, Number(watch('repaymentMonths')) || 1);

  const onSubmit = async (data: AdvanceForm) => {
    setServerError(null);
    try {
      await apiRequest('/api/advances', {
        method: 'POST',
        token,
        body: { ...data, idempotencyKey: generateIdempotencyKey('adv') },
      });
      await refreshData();
      setModalOpen(false);
      reset();
      setNotice('Advance request submitted for Supervisor, HR, and Finance approval.');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Unable to submit advance request.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#101F35]">Advance & Loan Requests</h1>
          <p className="text-sm text-[#64748B]">
            Request salary or wage advances and track your approved repayment schedule.
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={() => setModalOpen(true)}>
          <Plus className="w-5 h-5" />
          Request Advance
        </Button>
      </div>

      {notice && (
        <div className="rounded-2xl bg-[#EAF2FF] border border-[#2563EB]/25 p-3.5 text-sm text-[#101F35] flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-[#2563EB] shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <SurfaceCard className="space-y-1">
          <span className="text-xs text-[#64748B]">Outstanding Balance</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#101F35]">
            {formatINR(totalOutstanding)}
          </p>
        </SurfaceCard>
        <SurfaceCard className="space-y-1">
          <span className="text-xs text-[#64748B]">Amount Already Repaid</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#16A34A]">
            {formatINR(totalRepaid)}
          </p>
        </SurfaceCard>
        <SurfaceCard className="space-y-1">
          <span className="text-xs text-[#64748B]">Pending Requests</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#2563EB]">{pendingCount}</p>
        </SurfaceCard>
      </div>

      {/* Advance History & Repayment Schedules */}
      <div className="space-y-4">
        {advances.length === 0 ? (
          <SurfaceCard className="text-center py-8 space-y-2">
            <Wallet className="w-8 h-8 text-[#64748B] mx-auto" />
            <p className="text-sm font-semibold text-[#101F35]">No advances recorded</p>
            <p className="text-xs text-[#64748B]">Tap Request Advance above when you need a salary or wage advance.</p>
          </SurfaceCard>
        ) : (
          advances.map((adv) => (
            <SurfaceCard key={adv.id} className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-bold text-[#101F35]">{adv.requestType}</h2>
                    <StatusLabel label={adv.status} tone={inferStatusTone(adv.status)} />
                  </div>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Requested {formatDate(adv.submittedAt)} · {adv.reason}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="text-xl font-bold font-mono tabular-nums text-[#101F35]">
                    {formatINR(adv.requestedAmount)}
                  </p>
                  <p className="text-xs font-mono text-[#64748B] tabular-nums">
                    Remaining: {formatINR(adv.remainingBalance)}
                  </p>
                </div>
              </div>

              {adv.reviewerRemarks && (
                <p className="text-xs text-[#172B4D] bg-[#F5F7FA] rounded-xl px-3 py-2">
                  {adv.reviewerRemarks}
                </p>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#64748B]">Repayment Schedule</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {adv.repaymentSchedule.map((rep) => (
                    <div
                      key={rep.id}
                      className="border border-[#E2E8F0] rounded-xl p-2.5 text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-[#101F35] block">
                          #{rep.installmentNumber} · {rep.payrollPeriod}
                        </span>
                        <span className="text-[#64748B] font-mono">{formatDate(rep.dueDate)}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-[#101F35] block tabular-nums">
                          {formatINR(rep.amount)}
                        </span>
                        <span
                          className={`text-[11px] font-semibold ${
                            rep.status === 'Deducted' ? 'text-[#16A34A]' : 'text-[#64748B]'
                          }`}
                        >
                          {rep.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SurfaceCard>
          ))
        )}
      </div>

      <div className="rounded-xl bg-white border border-[#E2E8F0] px-4 py-3 text-xs text-[#64748B] flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-[#16A34A] shrink-0" />
        <span>
          Employees are never charged unapproved deductions. Payroll recovery starts only after Finance disbursement confirmation.
        </span>
      </div>

      <ModalSheet
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Request Salary / Wage Advance"
        subtitle="Requires Supervisor and Finance approval"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Request Type" required>
            <select {...register('requestType')} className={inputClass}>
              <option value="Salary Advance">Salary Advance</option>
              <option value="Wage Advance">Wage Advance</option>
              <option value="Emergency Medical Loan">Emergency Medical Loan</option>
              <option value="Festival Advance">Festival Advance</option>
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Requested Amount (₹)" required error={errors.requestedAmount?.message}>
              <input type="number" step="100" {...register('requestedAmount', { valueAsNumber: true })} className={inputClass} />
            </FormField>
            <FormField label="Repayment Installments" required error={errors.repaymentMonths?.message}>
              <select {...register('repaymentMonths', { valueAsNumber: true })} className={inputClass}>
                {[1, 2, 3, 4, 6, 9, 12].map((m) => (
                  <option key={m} value={m}>
                    {m} cycle{m > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="rounded-xl bg-[#F5F7FA] border border-[#E2E8F0] px-3.5 py-2.5 text-xs flex items-center justify-between">
            <span className="text-[#64748B]">Estimated Recovery per Cycle</span>
            <span className="font-mono font-bold text-[#101F35] tabular-nums">
              {formatINR(Math.round((watchAmt / watchMonths) * 100) / 100)}
            </span>
          </div>

          <FormField label="Reason" required error={errors.reason?.message}>
            <textarea
              rows={3}
              {...register('reason')}
              placeholder="Explain the need for this advance..."
              className={inputClass}
            />
          </FormField>

          {serverError && (
            <div className="rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/25 p-3 text-xs text-[#DC2626]">
              {serverError}
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Advance Request'}
          </Button>
        </form>
      </ModalSheet>
    </div>
  );
};
