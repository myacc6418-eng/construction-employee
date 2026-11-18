import React, { useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  HardHat,
  PhoneCall,
  ShieldCheck,
} from 'lucide-react';
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
  formatTime,
  inferStatusTone,
  inputClass,
} from '../components/ui/Primitives';

export const SafetyScreen: React.FC = () => {
  const { bootstrap, token, refreshData, queueOrSend } = useWorkforce();
  const emp = bootstrap?.employee;
  const sites = bootstrap?.authorizedSites || [];
  const notices = bootstrap?.safetyNotices || [];
  const incidents = bootstrap?.safetyIncidents || [];

  const [modalOpen, setModalOpen] = useState(false);
  const [incidentType, setIncidentType] = useState<
    'Unsafe Condition' | 'Near Miss' | 'Minor Injury' | 'Equipment Hazard' | 'Critical Incident'
  >('Unsafe Condition');
  const [siteId, setSiteId] = useState(emp?.primarySiteId || sites[0]?.id || '');
  const [locationDetail, setLocationDetail] = useState('');
  const [description, setDescription] = useState('');
  const [peopleInvolved, setPeopleInvolved] = useState('');
  const [immediateActionTaken, setImmediateActionTaken] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!emp) return null;

  const handleAcknowledge = async (noticeId: string) => {
    await apiRequest(`/api/safety/notices/${noticeId}/acknowledge`, {
      method: 'POST',
      token,
    });
    await refreshData();
    setFeedback('Safety instruction acknowledged and logged.');
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    files.forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPhotos((p) => [...p, reader.result as string].slice(0, 3));
        }
      };
      reader.readAsDataURL(f);
    });
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await queueOrSend({
        kind: 'safety_incident',
        title: `Safety Report: ${incidentType}`,
        endpoint: '/api/safety/incidents',
        payload: {
          incidentType,
          siteId,
          locationDetail,
          description,
          peopleInvolved: peopleInvolved || undefined,
          immediateActionTaken,
          photoDataUrls: photos,
        },
        idempotencyKey: generateIdempotencyKey('inc'),
      });
      setModalOpen(false);
      setLocationDetail('');
      setDescription('');
      setImmediateActionTaken('');
      setPhotos([]);
      setFeedback(
        res.mode === 'queued'
          ? 'Safety report saved on device. Will upload automatically when online.'
          : incidentType === 'Critical Incident'
          ? 'Critical safety alert immediately escalated to Site Manager and HSE Officer.'
          : 'Safety report submitted to Site Safety team.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#101F35]">Safety & Site Rules</h1>
          <p className="text-sm text-[#64748B]">
            Toolbox talks, required PPE, emergency contacts, and hazard reporting.
          </p>
        </div>
        <Button variant="danger" size="lg" onClick={() => setModalOpen(true)}>
          <AlertTriangle className="w-5 h-5" />
          Report Unsafe Condition / Incident
        </Button>
      </div>

      {feedback && (
        <div className="rounded-2xl bg-[#EAF2FF] border border-[#2563EB]/25 p-3.5 text-sm text-[#101F35] flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-[#2563EB] shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Emergency Contacts */}
      <SurfaceCard className="bg-[#101F35] text-white border-[#101F35]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs text-[#F59E0B] font-semibold">Emergency Site Contacts</p>
            <h2 className="text-base font-bold">Site Safety Officer & First Aid Desk</h2>
            <p className="text-xs text-white/75">
              Supervisor: {emp.reportingSupervisorName} ({emp.reportingSupervisorPhone})
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-mono">
            <a
              href="tel:108"
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#DC2626] text-white font-semibold inline-flex items-center gap-2"
            >
              <PhoneCall className="w-4 h-4" />
              Ambulance 108
            </a>
            <a
              href={`tel:${emp.reportingSupervisorPhone.replace(/\s+/g, '')}`}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white/15 text-white font-semibold inline-flex items-center gap-2"
            >
              <PhoneCall className="w-4 h-4" />
              Call Supervisor
            </a>
          </div>
        </div>
      </SurfaceCard>

      {/* Safety Notices & Toolbox Talks */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-[#101F35]">Site Safety Instructions & Toolbox Talks</h2>
        {notices.map((n) => (
          <SurfaceCard key={n.id} className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-semibold text-[#2563EB]">
                  {n.category} · {n.siteName}
                </span>
                <h3 className="text-base font-bold text-[#101F35] mt-0.5">{n.title}</h3>
              </div>
              {n.acknowledged ? (
                <StatusLabel label={`Acknowledged ${formatDate(n.acknowledgedAt)}`} tone="success" />
              ) : (
                <StatusLabel label="Acknowledgement Required" tone="warning" />
              )}
            </div>

            <p className="text-sm text-[#172B4D]">{n.summary}</p>

            <div className="bg-[#F5F7FA] rounded-xl p-3 text-xs">
              <span className="font-semibold text-[#101F35] flex items-center gap-1.5 mb-1">
                <HardHat className="w-4 h-4 text-[#F59E0B]" />
                Mandatory PPE
              </span>
              <p className="text-[#64748B]">{n.requiredPpe.join(' · ')}</p>
            </div>

            {!n.acknowledged && (
              <Button variant="success" size="md" onClick={() => void handleAcknowledge(n.id)}>
                <ShieldCheck className="w-4 h-4" />
                I Read & Acknowledge This Safety Rule
              </Button>
            )}
          </SurfaceCard>
        ))}
      </div>

      {/* Reported Incidents */}
      <SurfaceCard className="space-y-3">
        <h2 className="text-base font-bold text-[#101F35]">My Reported Safety Incidents</h2>
        {incidents.length === 0 ? (
          <p className="text-sm text-[#64748B]">No safety incidents or hazards reported by you.</p>
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {incidents.map((inc) => (
              <div key={inc.id} className="py-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[#101F35]">
                    {inc.incidentType} · {inc.siteName}
                  </span>
                  <StatusLabel label={inc.status} tone={inferStatusTone(inc.status)} />
                </div>
                <p className="text-xs text-[#64748B]">
                  {inc.locationDetail} · {formatDate(inc.occurredAt)} {formatTime(inc.occurredAt)}
                </p>
                <p className="text-xs text-[#172B4D]">{inc.description}</p>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>

      <ModalSheet
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Report Unsafe Condition / Incident"
        subtitle="Critical incidents immediately notify Site Management"
      >
        <form onSubmit={handleReportSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Incident Type" required>
              <select
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value as typeof incidentType)}
                className={inputClass}
              >
                <option value="Unsafe Condition">Unsafe Condition</option>
                <option value="Near Miss">Near Miss</option>
                <option value="Equipment Hazard">Equipment Hazard</option>
                <option value="Minor Injury">Minor Injury</option>
                <option value="Critical Incident">Critical Incident</option>
              </select>
            </FormField>
            <FormField label="Site" required>
              <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className={inputClass}>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.siteName}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Exact Location / Floor" required>
            <input
              value={locationDetail}
              onChange={(e) => setLocationDetail(e.target.value)}
              placeholder="e.g. Floor 4 East stairwell"
              className={inputClass}
              required
            />
          </FormField>

          <FormField label="Description" required>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the hazard or incident clearly..."
              className={inputClass}
              required
            />
          </FormField>

          <FormField label="Immediate Action Taken" required>
            <input
              value={immediateActionTaken}
              onChange={(e) => setImmediateActionTaken(e.target.value)}
              placeholder="e.g. Cordoned off area and alerted foreman"
              className={inputClass}
              required
            />
          </FormField>

          <FormField label="People Involved (Optional)">
            <input
              value={peopleInvolved}
              onChange={(e) => setPeopleInvolved(e.target.value)}
              placeholder="Optional names"
              className={inputClass}
            />
          </FormField>

          <FormField label="Supporting Photographs">
            <label className="min-h-[44px] px-4 py-2 rounded-xl border border-dashed border-[#E2E8F0] text-xs font-medium text-[#2563EB] flex items-center justify-center gap-2 cursor-pointer">
              <Camera className="w-4 h-4" />
              <span>Attach Photos ({photos.length})</span>
              <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="sr-only" />
            </label>
          </FormField>

          <Button type="submit" variant="danger" size="lg" className="w-full" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Safety Report'}
          </Button>
        </form>
      </ModalSheet>
    </div>
  );
};
