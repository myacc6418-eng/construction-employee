import React, { useState } from 'react';
import { CheckCircle2, LifeBuoy, Plus } from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import { generateIdempotencyKey } from '../services/offlineSync';
import type { SupportTicket } from '../types/buildflow';
import {
  Button,
  FormField,
  ModalSheet,
  StatusLabel,
  SurfaceCard,
  formatDate,
  inferStatusTone,
  inputClass,
} from '../components/ui/Primitives';

const CATEGORIES: SupportTicket['category'][] = [
  'Attendance Correction Request',
  'Salary Discrepancy',
  'Missing Payslip',
  'Leave Issue',
  'Work Assignment Issue',
  'Purchase Reimbursement Issue',
  'Safety Concern',
  'Other Workplace Concern',
];

export const HelpDeskScreen: React.FC = () => {
  const { bootstrap, queueOrSend } = useWorkforce();
  const tickets = bootstrap?.supportTickets || [];

  const [modalOpen, setModalOpen] = useState(false);
  const [category, setCategory] = useState<SupportTicket['category']>('Attendance Correction Request');
  const [description, setDescription] = useState('');
  const [attachmentNames, setAttachmentNames] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setSubmitting(true);
    try {
      const res = await queueOrSend({
        kind: 'work_progress',
        title: `Help Desk: ${category}`,
        endpoint: '/api/support/tickets',
        payload: {
          category,
          description: description.trim(),
          attachmentNames,
        },
        idempotencyKey: generateIdempotencyKey('tkt'),
      });
      setModalOpen(false);
      setDescription('');
      setAttachmentNames([]);
      setNotice(
        res.mode === 'queued'
          ? 'Ticket saved on device. It will sync automatically when connectivity returns.'
          : 'Support ticket submitted and routed to the concerned department.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#101F35]">Complaints & Help Desk</h1>
          <p className="text-sm text-[#64748B]">
            Raise attendance, salary, work, or workplace support requests and track resolution.
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={() => setModalOpen(true)}>
          <Plus className="w-5 h-5" />
          New Help Ticket
        </Button>
      </div>

      {notice && (
        <div className="rounded-2xl bg-[#EAF2FF] border border-[#2563EB]/25 p-3.5 text-sm text-[#101F35] flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-[#2563EB] shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {tickets.length === 0 ? (
        <SurfaceCard className="text-center py-8 space-y-2">
          <LifeBuoy className="w-8 h-8 text-[#2563EB] mx-auto" />
          <p className="text-sm font-semibold text-[#101F35]">No support tickets yet</p>
          <p className="text-xs text-[#64748B]">Tap New Help Ticket if you need an attendance correction or payroll check.</p>
        </SurfaceCard>
      ) : (
        <div className="space-y-3.5">
          {tickets.map((t) => (
            <SurfaceCard key={t.id} className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-xs font-bold text-[#2563EB]">
                    {t.ticketNumber} · {t.assignedDepartment}
                  </span>
                  <h2 className="text-base font-bold text-[#101F35] mt-0.5">{t.category}</h2>
                </div>
                <StatusLabel label={t.status} tone={inferStatusTone(t.status)} />
              </div>

              <p className="text-sm text-[#172B4D]">{t.description}</p>
              <p className="text-xs text-[#64748B]">Submitted {formatDate(t.submittedAt)}</p>

              {t.resolutionRemarks && (
                <div className="rounded-xl bg-[#F5F7FA] border border-[#E2E8F0] p-3 text-xs text-[#172B4D]">
                  <strong className="text-[#101F35] block mb-0.5">Resolution Remarks</strong>
                  {t.resolutionRemarks}
                </div>
              )}
            </SurfaceCard>
          ))}
        </div>
      )}

      <ModalSheet
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Raise Help Desk Request"
        subtitle="Routed directly to Site HR, Payroll, Engineering, or HSE"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Request Category" required>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SupportTicket['category'])}
              className={inputClass}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Description" required>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Include date, shift, or bill reference if applicable..."
              className={inputClass}
              required
            />
          </FormField>

          <FormField label="Supporting Attachment (Optional)">
            <input
              type="file"
              multiple
              onChange={(e) => setAttachmentNames(Array.from(e.target.files || []).map((f) => f.name))}
              className="text-xs text-[#64748B] file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-[#EAF2FF] file:text-[#2563EB] file:font-semibold"
            />
          </FormField>

          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Ticket'}
          </Button>
        </form>
      </ModalSheet>
    </div>
  );
};
