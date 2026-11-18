import React, { useState } from 'react';
import {
  CheckCircle2,
  CloudOff,
  Lock,
  LogOut,
  RefreshCw,
  Smartphone,
  Trash2,
  Wifi,
} from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import { apiRequest } from '../services/apiClient';
import { getPlatformRuntimeLabel } from '../services/capacitorBridge';
import {
  Button,
  FormField,
  StatusLabel,
  SurfaceCard,
  formatDate,
  formatTime,
  inferStatusTone,
  inputClass,
} from '../components/ui/Primitives';

export const ProfileScreen: React.FC = () => {
  const {
    bootstrap,
    token,
    refreshData,
    isOnline,
    simulatedOffline,
    setSimulatedOffline,
    offlineQueue,
    isSyncing,
    syncOfflineQueue,
    clearSyncedQueue,
    logout,
  } = useWorkforce();

  const emp = bootstrap?.employee;
  const [phone, setPhone] = useState(emp?.phone || '');
  const [email, setEmail] = useState(emp?.email || '');
  const [emergencyName, setEmergencyName] = useState(emp?.emergencyContactName || '');
  const [emergencyPhone, setEmergencyPhone] = useState(emp?.emergencyContactPhone || '');
  const [emergencyRel, setEmergencyRel] = useState(emp?.emergencyContactRelation || '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!emp) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      await apiRequest('/api/me/profile', {
        method: 'PATCH',
        token,
        body: {
          phone,
          email,
          emergencyContactName: emergencyName,
          emergencyContactPhone: emergencyPhone,
          emergencyContactRelation: emergencyRel,
        },
      });
      await refreshData();
      setFeedback('Permitted personal contact details updated.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#101F35]">My Profile & Offline Sync</h1>
          <p className="text-sm text-[#64748B]">
            View company assignment details, update personal emergency contacts, and manage offline drafts.
          </p>
        </div>
        <Button variant="secondary" size="md" onClick={() => void logout()}>
          <LogOut className="w-4 h-4" />
          Switch / Sign Out
        </Button>
      </div>

      {feedback && (
        <div className="rounded-2xl bg-[#EAF2FF] border border-[#2563EB]/25 p-3.5 text-sm text-[#101F35] flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-[#2563EB] shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-2xl bg-[#DC2626]/10 border border-[#DC2626]/25 p-3.5 text-sm text-[#DC2626]">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Identity & Locked Company Fields */}
        <SurfaceCard className="lg:col-span-6 space-y-5">
          <div className="flex items-center gap-4">
            <img
              src={emp.avatarUrl}
              alt={emp.fullName}
              className="w-20 h-20 rounded-2xl object-cover border border-[#E2E8F0]"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[#101F35]">{emp.fullName}</h2>
              <p className="text-xs font-mono font-semibold text-[#2563EB]">{emp.employeeCode}</p>
              <p className="text-xs text-[#64748B] mt-0.5">
                {emp.designation} · {emp.employmentCategory}
              </p>
            </div>
          </div>

          <div className="bg-[#F5F7FA] border border-[#E2E8F0] rounded-2xl p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between text-[#64748B] pb-1.5 border-b border-[#E2E8F0]">
              <span className="font-semibold text-[#101F35] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#64748B]" />
                HR-Verified Assignment Details (Read-Only)
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[#64748B] block">Department</span>
                <strong className="text-[#101F35]">{emp.department}</strong>
              </div>
              <div>
                <span className="text-[#64748B] block">Joining Date</span>
                <strong className="font-mono text-[#101F35]">{formatDate(emp.joiningDate)}</strong>
              </div>
              <div>
                <span className="text-[#64748B] block">Assigned Project</span>
                <strong className="text-[#101F35]">{emp.primaryProjectName}</strong>
              </div>
              <div>
                <span className="text-[#64748B] block">Assigned Site</span>
                <strong className="text-[#101F35]">{emp.primarySiteName}</strong>
              </div>
              <div>
                <span className="text-[#64748B] block">Reporting Supervisor</span>
                <strong className="text-[#101F35]">{emp.reportingSupervisorName}</strong>
              </div>
              <div>
                <span className="text-[#64748B] block">Bank / KYC (Masked)</span>
                <strong className="font-mono text-[#101F35]">{emp.bankAccountMasked}</strong>
              </div>
            </div>
            <p className="text-[11px] text-[#64748B] pt-1">
              Employees cannot alter salary structure, employment category, or assigned sites directly. Raise a Help Desk request if corrections are needed.
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <h3 className="text-sm font-bold text-[#101F35]">Editable Personal Contact Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Mobile Phone">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
              </FormField>
              <FormField label="Email">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Emergency Contact Name">
                <input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} className={inputClass} />
              </FormField>
              <FormField label="Relationship">
                <input value={emergencyRel} onChange={(e) => setEmergencyRel(e.target.value)} className={inputClass} />
              </FormField>
              <FormField label="Emergency Phone">
                <input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} className={inputClass} />
              </FormField>
            </div>
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={saving}>
              {saving ? 'Saving...' : 'Save Contact Updates'}
            </Button>
          </form>
        </SurfaceCard>

        {/* Offline Support & Sync Diagnostics */}
        <div className="lg:col-span-6 space-y-5">
          <SurfaceCard className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <Wifi className="w-5 h-5 text-[#16A34A]" />
                ) : (
                  <CloudOff className="w-5 h-5 text-[#F59E0B]" />
                )}
                <div>
                  <h2 className="text-base font-bold text-[#101F35]">Connectivity & Offline Queue</h2>
                  <p className="text-xs text-[#64748B]">
                    {isOnline
                      ? 'Online — drafts automatically sync with idempotency protection'
                      : 'Offline — drafts stored securely on device'}
                  </p>
                </div>
              </div>
              <StatusLabel label={isOnline ? 'Online' : 'Offline Mode'} tone={isOnline ? 'success' : 'warning'} />
            </div>

            {/* Field Offline Simulator Toggle */}
            <div className="bg-[#F5F7FA] border border-[#E2E8F0] rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="text-xs">
                <p className="font-semibold text-[#101F35]">Test Low-Signal / Offline Site Mode</p>
                <p className="text-[#64748B]">
                  Toggle offline mode to verify local draft capture & automatic sync on reconnect.
                </p>
              </div>
              <Button
                variant={simulatedOffline ? 'warning' : 'secondary'}
                size="md"
                onClick={() => setSimulatedOffline(!simulatedOffline)}
              >
                {simulatedOffline ? 'Go Online' : 'Go Offline'}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="md"
                disabled={!isOnline || isSyncing || offlineQueue.length === 0}
                onClick={() => void syncOfflineQueue()}
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing Queue...' : 'Sync Pending Now'}
              </Button>
              {offlineQueue.some((i) => i.status === 'Synced Successfully') && (
                <Button variant="secondary" size="md" onClick={clearSyncedQueue}>
                  <Trash2 className="w-4 h-4" />
                  Clear Synced
                </Button>
              )}
            </div>

            {offlineQueue.length === 0 ? (
              <p className="text-xs text-[#64748B] py-3 border-t border-[#E2E8F0]">
                No offline drafts queued on this device.
              </p>
            ) : (
              <div className="divide-y divide-[#E2E8F0] border-t border-[#E2E8F0]">
                {offlineQueue.map((q) => (
                  <div key={q.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#101F35] truncate">{q.title}</span>
                      <StatusLabel label={q.status} tone={inferStatusTone(q.status)} />
                    </div>
                    <p className="text-[11px] font-mono text-[#64748B]">
                      Key: {q.idempotencyKey} · {formatDate(q.createdAt)} {formatTime(q.createdAt)}
                    </p>
                    {q.lastError && <p className="text-xs text-[#DC2626]">{q.lastError}</p>}
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard className="space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-[#101F35]">
              <Smartphone className="w-4 h-4 text-[#2563EB]" />
              <span>Mobile & Capacitor Compatibility</span>
            </div>
            <p className="text-[#64748B]">
              Active Runtime: <strong className="text-[#101F35]">{getPlatformRuntimeLabel()}</strong>
            </p>
            <p className="text-[#64748B] leading-relaxed">
              Camera, GPS, and local storage access run through BuildFlow&apos;s Capacitor-ready hardware bridge so the same React codebase packages cleanly for Android and iOS.
            </p>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
};
