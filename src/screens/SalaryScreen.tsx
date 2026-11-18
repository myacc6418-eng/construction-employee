import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileText,
  IndianRupee,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import type { Payslip } from '../types/buildflow';
import {
  Button,
  ModalSheet,
  SampleBanner,
  StatusLabel,
  SurfaceCard,
  formatDate,
  formatINR,
  inferStatusTone,
} from '../components/ui/Primitives';

export const SalaryScreen: React.FC = () => {
  const { bootstrap } = useWorkforce();
  const emp = bootstrap?.employee;
  const salaryProfile = bootstrap?.salaryProfile;
  const payslips = bootstrap?.payslips || [];
  const transactions = bootstrap?.paymentTransactions || [];

  const [selectedSlip, setSelectedSlip] = useState<Payslip | null>(null);

  if (!emp) return null;

  const latestSlip = payslips[payslips.length - 1] || payslips[0];

  const handleDownloadPayslipHtml = (slip: Payslip) => {
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Payslip - ${slip.payrollPeriod}</title>
<style>body{font-family:sans-serif;max-width:720px;margin:32px auto;color:#172B4D}
h1{color:#101F35;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:16px}
th,td{border:1px solid #E2E8F0;padding:10px;text-align:left}th{background:#F5F7FA}</style></head>
<body>
<h1>${slip.companyName}</h1>
<p><strong>Payslip Period:</strong> ${slip.payrollPeriod} | <strong>Employee:</strong> ${emp.fullName} (${emp.employeeCode})</p>
<p><strong>Designation:</strong> ${emp.designation} | <strong>Type:</strong> ${emp.employmentCategory} | <strong>Attendance:</strong> ${slip.attendanceDays} days</p>
<table><thead><tr><th>Component</th><th>Type</th><th>Amount (INR)</th></tr></thead><tbody>
${slip.lineItems.map((l) => `<tr><td>${l.label}</td><td>${l.type}</td><td>₹${l.amount.toFixed(2)}</td></tr>`).join('')}
<tr><th colspan="2">Net Payable</th><th>₹${slip.netPay.toFixed(2)}</th></tr>
</tbody></table>
<p style="margin-top:16px"><strong>Payment Status:</strong> ${slip.paymentStatus} ${slip.paymentReference ? `| Ref: ${slip.paymentReference}` : ''}</p>
<p style="font-size:12px;color:#64748B">Sample / Private Employee Record — Generated for ${emp.fullName}</p>
</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BuildFlow-Payslip-${emp.employeeCode}-${slip.id}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-[#101F35]">
            {emp.payModel === 'monthly_salaried'
              ? 'Salary & Payslips'
              : emp.payModel === 'piece_rate'
              ? 'Piece-Rate Earnings & Payouts'
              : 'Daily Wages & Payment History'}
          </h1>
          <p className="text-sm text-[#64748B]">
            Tailored for {emp.employmentCategory} ({emp.employeeCode})
          </p>
        </div>
      </div>

      <SampleBanner label="Sample Payroll Data — Figures shown below are illustrative sample records" />

      {/* Adaptive Pay Summary Hero */}
      {salaryProfile && (
        <SurfaceCard className="bg-[#101F35] text-white border-[#101F35] space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs text-white/70 block">
                {emp.payModel === 'monthly_salaried'
                  ? 'Monthly Gross Salary'
                  : emp.payModel === 'daily_wage'
                  ? 'Approved Daily Wage Rate'
                  : emp.payModel === 'hourly'
                  ? 'Hourly Rate'
                  : 'Piece-Rate Schedule'}
              </span>
              <p className="text-3xl font-bold font-mono tabular-nums mt-0.5">
                {emp.payModel === 'monthly_salaried' && formatINR(salaryProfile.monthlyGross || 0)}
                {emp.payModel === 'daily_wage' && `${formatINR(salaryProfile.dailyWageRate || 0)} / day`}
                {emp.payModel === 'hourly' && `${formatINR(salaryProfile.hourlyRate || 0)} / hr`}
                {emp.payModel === 'piece_rate' &&
                  `${formatINR(salaryProfile.pieceRatePerUnit || 0)} / ${salaryProfile.pieceRateUnit}`}
              </p>
            </div>
            {salaryProfile.nextPayday && (
              <div className="text-left sm:text-right">
                <span className="text-xs text-white/70 block">Next Expected Payday</span>
                <span className="font-mono text-sm font-semibold text-[#F59E0B] tabular-nums">
                  {formatDate(salaryProfile.nextPayday)}
                </span>
              </div>
            )}
          </div>

          {latestSlip && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/15 text-xs">
              <div>
                <span className="text-white/65 block">Current Cycle</span>
                <span className="font-semibold text-white">{latestSlip.payrollPeriod}</span>
              </div>
              <div>
                <span className="text-white/65 block">
                  {emp.payModel === 'piece_rate' ? 'Approved Qty' : 'Approved Days'}
                </span>
                <span className="font-mono font-semibold text-white tabular-nums">
                  {emp.payModel === 'piece_rate'
                    ? `${latestSlip.approvedQuantity || 0} ${salaryProfile.pieceRateUnit}`
                    : `${latestSlip.attendanceDays} days`}
                </span>
              </div>
              <div>
                <span className="text-white/65 block">Deductions</span>
                <span className="font-mono font-semibold text-[#FCA5A5] tabular-nums">
                  -{formatINR(latestSlip.totalDeductions)}
                </span>
              </div>
              <div>
                <span className="text-white/65 block">Net Payable</span>
                <span className="font-mono font-bold text-[#4ADE80] tabular-nums">
                  {formatINR(latestSlip.netPay)}
                </span>
              </div>
            </div>
          )}
        </SurfaceCard>
      )}

      {/* Daily Wage / Piece-Rate Sample Breakdown Helper */}
      {emp.payModel === 'daily_wage' && (
        <SurfaceCard className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#101F35]">
              How Your Wage Is Calculated (Sample Breakdown)
            </h2>
            <span className="text-xs text-[#64748B]">Daily-Wage Policy</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs bg-[#F5F7FA] rounded-xl p-3.5">
            <div>
              <span className="text-[#64748B] block">Daily Wage</span>
              <span className="font-mono font-bold text-[#101F35] tabular-nums">
                {formatINR(salaryProfile?.dailyWageRate || 800)}
              </span>
            </div>
            <div>
              <span className="text-[#64748B] block">Approved Days</span>
              <span className="font-mono font-bold text-[#101F35] tabular-nums">
                {latestSlip?.attendanceDays || 24}
              </span>
            </div>
            <div>
              <span className="text-[#64748B] block">Overtime / Bonus</span>
              <span className="font-mono font-bold text-[#16A34A] tabular-nums">
                +{formatINR((latestSlip?.overtimePay || 0) + (latestSlip?.allowances || 0))}
              </span>
            </div>
            <div>
              <span className="text-[#64748B] block">Authorized Ded.</span>
              <span className="font-mono font-bold text-[#DC2626] tabular-nums">
                -{formatINR(latestSlip?.totalDeductions || 0)}
              </span>
            </div>
            <div>
              <span className="text-[#64748B] block">Net Payable</span>
              <span className="font-mono font-bold text-[#2563EB] tabular-nums">
                {formatINR(latestSlip?.netPay || 0)}
              </span>
            </div>
          </div>
        </SurfaceCard>
      )}

      {/* Salary History & Payslips */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SurfaceCard className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#101F35]">Salary History & Payslips</h2>
            <span className="text-xs text-[#64748B] inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" />
              Private access only
            </span>
          </div>
          <div className="divide-y divide-[#E2E8F0]">
            {payslips.map((slip) => (
              <div key={slip.id} className="py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#101F35] truncate">{slip.payrollPeriod}</p>
                  <p className="text-xs text-[#64748B] font-mono tabular-nums mt-0.5">
                    Gross {formatINR(slip.grossEarnings + slip.allowances + slip.overtimePay)} · Ded -{formatINR(slip.totalDeductions)}
                  </p>
                  <div className="mt-1">
                    <StatusLabel label={slip.paymentStatus} tone={inferStatusTone(slip.paymentStatus)} />
                  </div>
                </div>
                <div className="text-right shrink-0 space-y-1.5">
                  <p className="text-base font-bold font-mono tabular-nums text-[#101F35]">
                    {formatINR(slip.netPay)}
                  </p>
                  <Button variant="secondary" size="md" onClick={() => setSelectedSlip(slip)}>
                    <FileText className="w-4 h-4" />
                    Payslip
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>

        {/* Payment History */}
        <SurfaceCard className="space-y-3">
          <h2 className="text-base font-bold text-[#101F35]">Disbursement & Payment History</h2>
          <p className="text-xs text-[#64748B]">
            Payments only show Paid after Finance / banking confirmation.
          </p>
          <div className="divide-y divide-[#E2E8F0]">
            {transactions.map((tx) => (
              <div key={tx.id} className="py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-semibold text-[#101F35] truncate">{tx.periodLabel}</p>
                  <p className="text-xs text-[#64748B]">
                    {tx.paymentMethod} · {formatDate(tx.paymentDate)}
                  </p>
                  <p className="text-[11px] font-mono text-[#64748B] truncate">
                    Ref: {tx.transactionReference}
                  </p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="text-sm font-bold font-mono tabular-nums text-[#101F35]">
                    {formatINR(tx.amount)}
                  </p>
                  <StatusLabel label={tx.status} tone={inferStatusTone(tx.status)} />
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>

      {/* Payslip Modal */}
      <ModalSheet
        open={Boolean(selectedSlip)}
        onClose={() => setSelectedSlip(null)}
        title={selectedSlip ? `Payslip · ${selectedSlip.payrollPeriod}` : 'Payslip'}
        subtitle={selectedSlip ? `${selectedSlip.companyName} · ${emp.employeeCode}` : ''}
      >
        {selectedSlip && (
          <div className="space-y-4">
            <div className="bg-[#F5F7FA] border border-[#E2E8F0] rounded-xl p-3.5 grid grid-cols-2 gap-2.5 text-xs">
              <div>
                <span className="text-[#64748B] block">Employee</span>
                <strong className="text-[#101F35]">{emp.fullName}</strong>
              </div>
              <div>
                <span className="text-[#64748B] block">Employee ID</span>
                <strong className="font-mono text-[#101F35]">{emp.employeeCode}</strong>
              </div>
              <div>
                <span className="text-[#64748B] block">Category</span>
                <strong className="text-[#101F35]">{emp.employmentCategory}</strong>
              </div>
              <div>
                <span className="text-[#64748B] block">Attendance / Qty</span>
                <strong className="font-mono text-[#101F35] tabular-nums">
                  {selectedSlip.approvedQuantity
                    ? `${selectedSlip.approvedQuantity} sq ft`
                    : `${selectedSlip.attendanceDays} days (${selectedSlip.approvedOvertimeHours}h OT)`}
                </strong>
              </div>
            </div>

            <div className="border border-[#E2E8F0] rounded-xl divide-y divide-[#E2E8F0]">
              {selectedSlip.lineItems.map((item, idx) => (
                <div key={idx} className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                  <span className="text-[#172B4D]">{item.label}</span>
                  <span
                    className={`font-mono font-semibold tabular-nums ${
                      item.type === 'deduction' ? 'text-[#DC2626]' : 'text-[#16A34A]'
                    }`}
                  >
                    {item.type === 'deduction' ? '-' : '+'}
                    {formatINR(item.amount)}
                  </span>
                </div>
              ))}
              <div className="px-3.5 py-3 bg-[#101F35] text-white rounded-b-xl flex items-center justify-between">
                <span className="text-sm font-semibold">Net Payable</span>
                <span className="text-lg font-bold font-mono tabular-nums">
                  {formatINR(selectedSlip.netPay)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <StatusLabel label={`Status: ${selectedSlip.paymentStatus}`} tone={inferStatusTone(selectedSlip.paymentStatus)} />
              {selectedSlip.paymentReference && (
                <span className="font-mono text-[#64748B]">Ref: {selectedSlip.paymentReference}</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button variant="secondary" size="md" onClick={() => window.print()}>
                <Printer className="w-4 h-4" />
                Print / Save PDF
              </Button>
              <Button variant="primary" size="md" onClick={() => handleDownloadPayslipHtml(selectedSlip)}>
                <Download className="w-4 h-4" />
                Download Slip
              </Button>
            </div>
          </div>
        )}
      </ModalSheet>
    </div>
  );
};
