import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Briefcase,
  Camera,
  CheckCircle2,
  ClipboardList,
  FileText,
  HelpCircle,
  MapPin,
  Phone,
  Search,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import { generateIdempotencyKey } from '../services/offlineSync';
import type { WorkAssignment } from '../types/buildflow';
import {
  Button,
  EmptyState,
  FormField,
  ModalSheet,
  StatusLabel,
  SurfaceCard,
  formatDate,
  formatTime,
  inferStatusTone,
  inputClass,
} from '../components/ui/Primitives';

export const MyWorkScreen: React.FC = () => {
  const { bootstrap, queueOrSend } = useWorkforce();
  const works = bootstrap?.workAssignments || [];

  const [tab, setTab] = useState<'active' | 'history' | 'all'>('active');
  const [search, setSearch] = useState('');
  const [selectedWork, setSelectedWork] = useState<WorkAssignment | null>(null);
  const [actionType, setActionType] = useState<'progress' | 'submit' | 'blocker' | 'clarification' | null>(null);
  const [qtyInput, setQtyInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return works.filter((w) => {
      if (tab === 'active' && w.status === 'Completed') return false;
      if (tab === 'history' && w.status !== 'Completed' && w.status !== 'Submitted for Review' && w.status !== 'Rework Required') {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          w.title.toLowerCase().includes(q) ||
          w.taskCode.toLowerCase().includes(q) ||
          w.locationFloor.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [works, tab, search]);

  const activeSelected = selectedWork ? works.find((w) => w.id === selectedWork.id) || selectedWork : null;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPhotoPreviews((prev) => [...prev, reader.result as string].slice(0, 3));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleQuickAction = async (
    work: WorkAssignment,
    action: 'accept' | 'start' | 'progress' | 'submit' | 'blocker' | 'clarification'
  ) => {
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await queueOrSend({
        kind: 'work_progress',
        title: `${work.taskCode}: ${action}`,
        endpoint: `/api/work/${work.id}/action`,
        payload: {
          action,
          completedQuantity: work.measurable && qtyInput !== '' ? Number(qtyInput) : undefined,
          notes: notesInput.trim() || undefined,
          photoDataUrls: photoPreviews,
        },
        idempotencyKey: generateIdempotencyKey(`wrk-${work.id}`),
      });

      setActionType(null);
      setNotesInput('');
      setPhotoPreviews([]);
      setFeedback(
        res.mode === 'queued'
          ? 'Saved on Device (Waiting to Sync). Your work update will upload automatically when online.'
          : action === 'submit'
          ? 'Submitted for supervisor verification. Official approval is completed by your Site Engineer or Supervisor.'
          : 'Work assignment updated successfully.'
      );
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to update work.');
    } finally {
      setSubmitting(false);
    }
  };

  const openActionForm = (work: WorkAssignment, type: 'progress' | 'submit' | 'blocker' | 'clarification') => {
    setActionType(type);
    setQtyInput(work.completedQuantity !== undefined ? String(work.completedQuantity) : '');
    setNotesInput('');
    setPhotoPreviews([]);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#101F35]">My Work Assignments</h1>
          <p className="text-sm text-[#64748B]">
            View assigned tasks, log measured quantities, attach site photos, and submit for supervisor review.
          </p>
        </div>
      </div>

      {feedback && (
        <div className="rounded-2xl bg-[#EAF2FF] border border-[#2563EB]/25 p-3.5 text-sm text-[#101F35] flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-[#2563EB] shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Search & Filter Tabs */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="inline-flex p-1 bg-white border border-[#E2E8F0] rounded-xl gap-1">
          {[
            { id: 'active', label: 'Active Work' },
            { id: 'history', label: 'Review & History' },
            { id: 'all', label: 'All Tasks' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as typeof tab)}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                tab === item.id ? 'bg-[#101F35] text-white' : 'text-[#64748B] hover:text-[#101F35]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-72">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search task ID, title, or floor..."
            className={`${inputClass} pl-10`}
          />
        </div>
      </div>

      {/* Work Cards */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="w-6 h-6" />}
          title="No matching work assignments"
          description="Try switching the status tab or clearing your search query."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((w) => {
            const pct =
              w.measurable && w.expectedQuantity
                ? Math.min(100, Math.round(((w.completedQuantity || 0) / w.expectedQuantity) * 100))
                : null;

            return (
              <SurfaceCard
                key={w.id}
                onClick={() => {
                  setSelectedWork(w);
                  setActionType(null);
                }}
                className="flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-[#2563EB]">
                      {w.taskCode} · {w.priority} Priority
                    </span>
                    <StatusLabel label={w.status} tone={inferStatusTone(w.status)} />
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-[#101F35]">{w.title}</h2>
                    <p className="text-xs text-[#64748B] mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      {w.siteName} · {w.locationFloor}
                    </p>
                  </div>

                  <p className="text-sm text-[#172B4D] line-clamp-2">{w.description}</p>

                  {w.measurable && w.expectedQuantity !== undefined && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#64748B]">Submitted Progress</span>
                        <span className="font-mono font-semibold text-[#101F35] tabular-nums">
                          {w.completedQuantity || 0} / {w.expectedQuantity} {w.unit}
                          {w.approvedQuantity !== undefined ? ` (${w.approvedQuantity} approved)` : ''}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[#F5F7FA] overflow-hidden border border-[#E2E8F0]">
                        <div
                          className="h-full bg-[#2563EB] rounded-full transition-all"
                          style={{ width: `${pct || 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
                  <span>Supervisor: {w.supervisorName}</span>
                  <span className="font-mono tabular-nums">Due {formatDate(w.dueDate)}</span>
                </div>
              </SurfaceCard>
            );
          })}
        </div>
      )}

      {/* Task Details & Actions Sheet */}
      <ModalSheet
        open={Boolean(activeSelected)}
        onClose={() => {
          setSelectedWork(null);
          setActionType(null);
        }}
        title={activeSelected?.title || 'Task Details'}
        subtitle={
          activeSelected
            ? `${activeSelected.taskCode} · ${activeSelected.projectName} · ${activeSelected.siteName}`
            : ''
        }
      >
        {activeSelected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <StatusLabel label={activeSelected.status} tone={inferStatusTone(activeSelected.status)} />
              <span className="text-xs font-mono text-[#64748B]">
                Due {formatDate(activeSelected.dueDate)}
              </span>
            </div>

            {activeSelected.referencePhotoUrl && (
              <img
                src={activeSelected.referencePhotoUrl}
                alt={activeSelected.title}
                className="w-full h-44 object-cover rounded-2xl border border-[#E2E8F0]"
                referrerPolicy="no-referrer"
              />
            )}

            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#64748B]">Location & Scope</p>
              <p className="text-sm font-medium text-[#101F35]">{activeSelected.locationFloor}</p>
              <p className="text-sm text-[#172B4D] leading-relaxed">{activeSelected.description}</p>
            </div>

            {activeSelected.measurable && (
              <div className="grid grid-cols-3 gap-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-xl p-3 text-xs">
                <div>
                  <span className="text-[#64748B] block">Expected</span>
                  <span className="font-mono font-bold text-[#101F35] tabular-nums">
                    {activeSelected.expectedQuantity} {activeSelected.unit}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block">Submitted</span>
                  <span className="font-mono font-bold text-[#2563EB] tabular-nums">
                    {activeSelected.completedQuantity || 0} {activeSelected.unit}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block">Approved</span>
                  <span className="font-mono font-bold text-[#16A34A] tabular-nums">
                    {activeSelected.approvedQuantity || 0} {activeSelected.unit}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#101F35] flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-[#2563EB]" />
                Work Instructions
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs text-[#172B4D]">
                {activeSelected.instructions.map((ins, i) => (
                  <li key={i}>{ins}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-2 bg-[#FFFBEB] border border-[#F59E0B]/30 rounded-xl p-3">
              <p className="text-xs font-semibold text-[#B45309] flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                Safety & PPE Requirements
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs text-[#172B4D]">
                {activeSelected.safetyInstructions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#F5F7FA] rounded-xl p-3">
              <div>
                <p className="font-semibold text-[#101F35] flex items-center gap-1">
                  <Wrench className="w-3.5 h-3.5 text-[#64748B]" />
                  Required Equipment
                </p>
                <p className="text-[#64748B] mt-0.5">{activeSelected.requiredEquipment.join(', ')}</p>
              </div>
              <div>
                <p className="font-semibold text-[#101F35] flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-[#64748B]" />
                  Supervisor
                </p>
                <p className="text-[#64748B] mt-0.5">
                  {activeSelected.supervisorName} · {activeSelected.supervisorPhone}
                </p>
                {activeSelected.drawingTitle && (
                  <p className="text-[#2563EB] mt-1 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    {activeSelected.drawingTitle}
                  </p>
                )}
              </div>
            </div>

            {/* Task Action Buttons */}
            {!actionType && activeSelected.status !== 'Completed' && (
              <div className="space-y-2.5 pt-2 border-t border-[#E2E8F0]">
                <div className="grid grid-cols-2 gap-2.5">
                  {activeSelected.status === 'Assigned' && (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => void handleQuickAction(activeSelected, 'accept')}
                      disabled={submitting}
                    >
                      Accept Assignment
                    </Button>
                  )}
                  {(activeSelected.status === 'Assigned' || activeSelected.status === 'Acknowledged') && (
                    <Button
                      variant="success"
                      size="md"
                      onClick={() => void handleQuickAction(activeSelected, 'start')}
                      disabled={submitting}
                    >
                      Start Work
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => openActionForm(activeSelected, 'progress')}
                  >
                    Update Progress
                  </Button>
                  <Button
                    variant="success"
                    size="md"
                    onClick={() => openActionForm(activeSelected, 'submit')}
                  >
                    Submit for Review
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => openActionForm(activeSelected, 'blocker')}
                  >
                    <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                    Report Blocker
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => openActionForm(activeSelected, 'clarification')}
                  >
                    <HelpCircle className="w-4 h-4 text-[#2563EB]" />
                    Ask Clarification
                  </Button>
                </div>
              </div>
            )}

            {/* Progress / Submission / Blocker Form */}
            {actionType && (
              <div className="space-y-3 pt-3 border-t border-[#E2E8F0]">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#101F35]">
                    {actionType === 'progress'
                      ? 'Update Work Progress'
                      : actionType === 'submit'
                      ? 'Submit Work for Supervisor Approval'
                      : actionType === 'blocker'
                      ? 'Report Site Blocker'
                      : 'Request Clarification'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActionType(null)}
                    className="text-xs text-[#64748B] hover:text-[#101F35] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                {(actionType === 'progress' || actionType === 'submit') && activeSelected.measurable && (
                  <FormField
                    label={`Completed Quantity (${activeSelected.unit})`}
                    hint={`Target: ${activeSelected.expectedQuantity} ${activeSelected.unit}. Final approved quantity is verified by your supervisor.`}
                  >
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={qtyInput}
                      onChange={(e) => setQtyInput(e.target.value)}
                      className={inputClass}
                    />
                  </FormField>
                )}

                <FormField label="Work Notes / Details" required>
                  <textarea
                    rows={3}
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder="Describe completed work, material issue, or question for supervisor..."
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Photo Evidence (Optional, up to 3 photos)">
                  <label className="min-h-[44px] px-4 py-2 rounded-xl border border-dashed border-[#2563EB]/40 bg-[#EAF2FF]/40 text-xs font-medium text-[#2563EB] flex items-center justify-center gap-2 cursor-pointer">
                    <Camera className="w-4 h-4" />
                    <span>Attach Site Work Photos</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      onChange={handlePhotoSelect}
                      className="sr-only"
                    />
                  </label>
                  {photoPreviews.length > 0 && (
                    <div className="flex gap-2 pt-2">
                      {photoPreviews.map((src, idx) => (
                        <img
                          key={idx}
                          src={src}
                          alt={`Work evidence ${idx + 1}`}
                          className="w-16 h-16 rounded-xl object-cover border border-[#E2E8F0]"
                        />
                      ))}
                    </div>
                  )}
                </FormField>

                <Button
                  variant={actionType === 'submit' ? 'success' : 'primary'}
                  size="lg"
                  className="w-full"
                  disabled={submitting || !notesInput.trim()}
                  onClick={() => void handleQuickAction(activeSelected, actionType)}
                >
                  {submitting ? 'Saving...' : 'Confirm & Send Update'}
                </Button>
              </div>
            )}

            {/* Update Log */}
            {activeSelected.updates.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-[#E2E8F0]">
                <h3 className="text-xs font-bold text-[#64748B]">Activity History</h3>
                <div className="space-y-2.5">
                  {activeSelected.updates.map((u) => (
                    <div key={u.id} className="text-xs bg-[#F5F7FA] rounded-xl p-3 space-y-1">
                      <div className="flex items-center justify-between text-[#64748B]">
                        <span className="font-semibold text-[#101F35] capitalize">
                          {u.updateType.replace('_', ' ')}
                        </span>
                        <span className="font-mono">{formatDate(u.createdAt)} {formatTime(u.createdAt)}</span>
                      </div>
                      <p className="text-[#172B4D]">{u.notes}</p>
                      {u.completedQuantity !== undefined && (
                        <p className="font-mono text-[#2563EB]">
                          Reported Qty: {u.completedQuantity} {activeSelected.unit}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </ModalSheet>
    </div>
  );
};
