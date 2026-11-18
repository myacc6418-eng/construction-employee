import React, { useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import { apiRequest, ApiError } from '../services/apiClient';
import { computeDistanceMeters, requestCurrentGps, type GpsReading } from '../services/capacitorBridge';
import { generateIdempotencyKey } from '../services/offlineSync';
import { SelfieCameraModal } from '../components/attendance/SelfieCameraModal';
import { SiteGeofenceMap } from '../components/attendance/SiteGeofenceMap';
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
import type { AttendanceException, AttendanceSession } from '../types/buildflow';

export const AttendanceScreen: React.FC = () => {
  const {
    token,
    bootstrap,
    isOnline,
    refreshData,
    queueOrSend,
    triggerLocationPingNow,
    lastLocationPingAt,
    lastLocationStatus,
  } = useWorkforce();

  const emp = bootstrap?.employee;
  const sites = bootstrap?.authorizedSites || [];
  const activeSession = bootstrap?.activeSession || null;
  const unresolvedSession = bootstrap?.unresolvedSession || null;
  const recentAttendance = bootstrap?.recentAttendance || [];
  const exceptions = bootstrap?.attendanceExceptions || [];
  const locationLogs = bootstrap?.locationLogs || [];

  const [selectedSiteId, setSelectedSiteId] = useState<string>(
    emp?.primarySiteId || sites[0]?.id || ''
  );
  const currentSite = sites.find((s) => s.id === (activeSession?.siteId || selectedSiteId)) || sites[0];

  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<'check-in' | 'check-out'>('check-in');
  const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null);
  const [gps, setGps] = useState<GpsReading | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [loadingGps, setLoadingGps] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failureAlert, setFailureAlert] = useState<{
    title: string;
    message: string;
    canException: boolean;
    reasonType?: AttendanceException['reasonType'];
  } | null>(null);

  const [successConfirmation, setSuccessConfirmation] = useState<{
    title: string;
    session: AttendanceSession;
  } | null>(null);

  const [exceptionModalOpen, setExceptionModalOpen] = useState(false);
  const [exceptionReason, setExceptionReason] = useState<AttendanceException['reasonType']>('Outside Geofence');
  const [exceptionNotes, setExceptionNotes] = useState('');
  const [exceptionSubmitting, setExceptionSubmitting] = useState(false);
  const [exceptionNotice, setExceptionNotice] = useState<string | null>(null);

  const [resolveNotes, setResolveNotes] = useState('Completed full shift; forgot to tap Check Out before gate exit.');
  const [resolving, setResolving] = useState(false);

  if (!emp || !currentSite) return null;

  const distanceToSite = gps
    ? computeDistanceMeters(gps.latitude, gps.longitude, currentSite.latitude, currentSite.longitude)
    : null;
  const withinGeofencePreview =
    distanceToSite !== null ? !currentSite.geofenceEnabled || distanceToSite <= currentSite.geofenceRadiusMeters : null;

  const handleOpenCamera = (mode: 'check-in' | 'check-out') => {
    setFailureAlert(null);
    setCameraMode(mode);
    setCameraModalOpen(true);
  };

  const handleFetchGps = async () => {
    setLoadingGps(true);
    setGpsError(null);
    setFailureAlert(null);
    const result = await requestCurrentGps();
    setLoadingGps(false);
    if (result.ok && result.reading) {
      setGps(result.reading);
    } else {
      setGps(null);
      setGpsError(result.errorMessage || 'Unable to retrieve GPS coordinates.');
      setFailureAlert({
        title: 'Location Access / GPS Required',
        message: result.errorMessage || 'Enable device location services and retry.',
        canException: true,
        reasonType: result.errorCode === 'PERMISSION_DENIED' ? 'GPS Unavailable' : 'Weak GPS',
      });
    }
  };

  const handleSelfieCaptured = async (dataUrl: string) => {
    setSelfieDataUrl(dataUrl);
    setCameraModalOpen(false);
    // Automatically proceed to Step 7-8: retrieve GPS coordinates
    await handleFetchGps();
  };

  const handleSubmitAttendance = async () => {
    setFailureAlert(null);

    if (!selfieDataUrl) {
      setFailureAlert({
        title: 'Live Selfie Required',
        message: 'Capture a fresh live selfie from the front camera before submitting.',
        canException: true,
        reasonType: 'Camera Unavailable',
      });
      return;
    }

    if (!gps) {
      await handleFetchGps();
      return;
    }

    // Offline handling: never fake official check-in approval
    if (!isOnline) {
      const idemp = generateIdempotencyKey(`offline-${cameraMode}`);
      await queueOrSend({
        kind: 'pending_offline_checkin',
        title: `Pending Offline ${cameraMode === 'check-in' ? 'Check-In' : 'Check-Out'} (${currentSite.siteName})`,
        endpoint: cameraMode === 'check-in' ? '/api/attendance/check-in' : '/api/attendance/check-out',
        payload: {
          siteId: currentSite.id,
          sessionId: activeSession?.id,
          selfieDataUrl,
          captureSource: 'live_camera',
          latitude: gps.latitude,
          longitude: gps.longitude,
          accuracyMeters: gps.accuracyMeters,
          deviceTimestamp: new Date().toISOString(),
        },
        idempotencyKey: idemp,
      });
      setSelfieDataUrl(null);
      setExceptionNotice(
        'Saved as Pending Attendance Submission on your device. It will be sent for backend verification as soon as internet connectivity returns — it is NOT yet officially approved.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const idemp = generateIdempotencyKey(cameraMode);
      if (cameraMode === 'check-in') {
        const res = await apiRequest<{ session: AttendanceSession }>('/api/attendance/check-in', {
          method: 'POST',
          token,
          body: {
            siteId: currentSite.id,
            selfieDataUrl,
            captureSource: 'live_camera',
            latitude: gps.latitude,
            longitude: gps.longitude,
            accuracyMeters: gps.accuracyMeters,
            deviceTimestamp: new Date().toISOString(),
            idempotencyKey: idemp,
          },
        });
        setSelfieDataUrl(null);
        await refreshData();
        setSuccessConfirmation({
          title: 'Check-in Successful',
          session: res.session,
        });
      } else if (activeSession) {
        const res = await apiRequest<{ session: AttendanceSession }>('/api/attendance/check-out', {
          method: 'POST',
          token,
          body: {
            sessionId: activeSession.id,
            selfieDataUrl,
            captureSource: 'live_camera',
            latitude: gps.latitude,
            longitude: gps.longitude,
            accuracyMeters: gps.accuracyMeters,
            idempotencyKey: idemp,
          },
        });
        setSelfieDataUrl(null);
        await refreshData();
        setSuccessConfirmation({
          title: 'Check-out Successful',
          session: res.session,
        });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        const reasonMap: Record<string, AttendanceException['reasonType']> = {
          OUTSIDE_GEOFENCE: 'Outside Geofence',
          WEAK_GPS: 'Weak GPS',
          GPS_UNAVAILABLE: 'GPS Unavailable',
          INVALID_SELFIE: 'Camera Unavailable',
        };
        setFailureAlert({
          title: err.code === 'OUTSIDE_GEOFENCE' ? 'Outside Site Geofence' : 'Attendance Submission Failed',
          message: err.message,
          canException: err.code === 'OUTSIDE_GEOFENCE' || err.code === 'WEAK_GPS' || err.code === 'GPS_UNAVAILABLE',
          reasonType: err.code ? reasonMap[err.code] : 'Outside Geofence',
        });
      } else {
        setFailureAlert({
          title: 'Network / Server Error',
          message: err instanceof Error ? err.message : 'Unable to reach BuildFlow attendance server.',
          canException: true,
          reasonType: 'Network Offline',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitException = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exceptionNotes.trim()) return;
    setExceptionSubmitting(true);
    try {
      const result = await queueOrSend({
        kind: 'attendance_exception',
        title: `Attendance Exception (${exceptionReason})`,
        endpoint: '/api/attendance/exception',
        payload: {
          siteId: currentSite.id,
          reasonType: exceptionReason,
          notes: exceptionNotes.trim(),
          latitude: gps?.latitude,
          longitude: gps?.longitude,
          accuracyMeters: gps?.accuracyMeters,
        },
        idempotencyKey: generateIdempotencyKey('att-ex'),
      });
      setExceptionModalOpen(false);
      setExceptionNotes('');
      setFailureAlert(null);
      setExceptionNotice(
        result.mode === 'queued'
          ? 'Exception saved offline on your device. It will sync automatically when online.'
          : 'Attendance exception submitted to your site supervisor for verification.'
      );
    } catch (err) {
      setFailureAlert({
        title: 'Exception Request Failed',
        message: err instanceof Error ? err.message : 'Could not submit exception.',
        canException: false,
      });
    } finally {
      setExceptionSubmitting(false);
    }
  };

  const handleResolveUnresolved = async () => {
    if (!unresolvedSession) return;
    setResolving(true);
    try {
      await apiRequest('/api/attendance/resolve-session', {
        method: 'POST',
        token,
        body: {
          sessionId: unresolvedSession.id,
          reason: resolveNotes,
          idempotencyKey: generateIdempotencyKey('resolve'),
        },
      });
      await refreshData();
      setExceptionNotice('Previous shift resolution sent to your supervisor. You can now check in for today.');
    } catch (err) {
      setFailureAlert({
        title: 'Could Not Resolve Session',
        message: err instanceof Error ? err.message : 'Please try again.',
        canException: false,
      });
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-[#101F35]">Selfie Attendance & Live GPS</h1>
          <p className="text-sm text-[#64748B]">
            Live front-camera selfie and site GPS verification are required for check-in and check-out.
          </p>
        </div>
        {activeSession ? (
          <StatusLabel label="Checked In · Tracking Active" tone="success" />
        ) : unresolvedSession ? (
          <StatusLabel label="Unresolved Session" tone="danger" />
        ) : (
          <StatusLabel label="Not Checked In" tone="warning" />
        )}
      </div>

      {exceptionNotice && (
        <div className="rounded-2xl bg-[#EAF2FF] border border-[#2563EB]/25 p-4 text-sm text-[#101F35] flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5" />
          <div className="flex-1">{exceptionNotice}</div>
        </div>
      )}

      {/* Unresolved Previous Session Recovery */}
      {unresolvedSession && (
        <SurfaceCard className="bg-[#FFFBEB] border-[#F59E0B]/40 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-[#B45309] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#101F35]">
                Unresolved Session Recovery ({unresolvedSession.shiftDate})
              </h2>
              <p className="text-sm text-[#64748B]">
                Previous check-in at {unresolvedSession.siteName} ({formatTime(unresolvedSession.checkInTime)}) has no check-out. Confirm your exit note below so your supervisor can verify it.
              </p>
            </div>
          </div>
          <FormField label="Recovery Note for Supervisor">
            <input
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              className={inputClass}
            />
          </FormField>
          <Button variant="warning" size="lg" onClick={handleResolveUnresolved} disabled={resolving}>
            {resolving ? 'Submitting Recovery...' : 'Submit Previous Shift Recovery'}
          </Button>
        </SurfaceCard>
      )}

      {/* Check-In / Check-Out Stepper Card */}
      {!unresolvedSession && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <SurfaceCard className="lg:col-span-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h2 className="text-lg font-bold text-[#101F35]">
                  {activeSession ? 'Check-Out Workflow' : 'Check-In Workflow'}
                </h2>
                <p className="text-xs text-[#64748B]">
                  {activeSession
                    ? `Active at ${activeSession.siteName} since ${formatTime(activeSession.checkInTime)}`
                    : 'Follow steps 1–3 below to record verified attendance'}
                </p>
              </div>
              <span className="font-mono text-xs text-[#64748B]">{currentSite.shiftStart}</span>
            </div>

            {/* Step 1: Select Assigned Site */}
            {!activeSession && (
              <FormField label="1. Assigned Site" hint="Only sites authorized for your worker profile are listed.">
                <select
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className={inputClass}
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.siteName} — {s.projectName}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            {/* Step 2: Live Selfie */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#172B4D]">
                  {activeSession ? '1. Capture Check-Out Selfie' : '2. Capture Live Selfie'}
                </span>
                {selfieDataUrl && <StatusLabel label="Live Selfie Ready" tone="success" />}
              </div>

              {selfieDataUrl ? (
                <div className="flex items-center gap-4 p-3 rounded-xl bg-[#F5F7FA] border border-[#E2E8F0]">
                  <img
                    src={selfieDataUrl}
                    alt="Live captured selfie"
                    className="w-16 h-16 rounded-xl object-cover border border-[#E2E8F0]"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0 text-xs">
                    <p className="font-semibold text-[#101F35]">Fresh camera capture verified</p>
                    <p className="text-[#64748B]">Ready for server submission</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => handleOpenCamera(activeSession ? 'check-out' : 'check-in')}
                  >
                    Retake
                  </Button>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={() => handleOpenCamera(activeSession ? 'check-out' : 'check-in')}
                >
                  <Camera className="w-5 h-5" />
                  {activeSession ? 'Open Camera for Check-Out Selfie' : 'Open Front Camera & Capture Selfie'}
                </Button>
              )}
            </div>

            {/* Step 3: GPS Verification */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#172B4D]">
                  {activeSession ? '2. Verify Site GPS' : '3. Verify Site GPS & Geofence'}
                </span>
                {gps && (
                  <StatusLabel
                    label={withinGeofencePreview ? 'Inside Geofence' : `${distanceToSite}m from site`}
                    tone={withinGeofencePreview ? 'success' : 'danger'}
                  />
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-[#F5F7FA] border border-[#E2E8F0] space-y-2.5 text-xs">
                {gps ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[#64748B] block">GPS Coordinates</span>
                      <span className="font-mono font-semibold text-[#101F35] tabular-nums">
                        {gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block">Accuracy & Distance</span>
                      <span className="font-mono font-semibold text-[#101F35] tabular-nums">
                        ±{gps.accuracyMeters}m · {distanceToSite}m away
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[#64748B]">
                    {gpsError || 'Tap below to retrieve your live GPS coordinates and verify site boundary.'}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="md" onClick={handleFetchGps} disabled={loadingGps}>
                    <LocateFixed className="w-4 h-4" />
                    {loadingGps ? 'Reading GPS...' : gps ? 'Refresh GPS' : 'Get Live GPS'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => {
                      setExceptionReason(gps ? 'Outside Geofence' : 'GPS Unavailable');
                      setExceptionModalOpen(true);
                    }}
                  >
                    Request Exception
                  </Button>
                </div>
              </div>
            </div>

            {/* Failure Cases & Recovery */}
            {failureAlert && (
              <div className="rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/25 p-3.5 space-y-2 text-xs">
                <p className="font-bold text-[#DC2626]">{failureAlert.title}</p>
                <p className="text-[#172B4D] leading-relaxed">{failureAlert.message}</p>
                {failureAlert.canException && currentSite.allowGeofenceException && (
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      setExceptionReason(failureAlert.reasonType || 'Outside Geofence');
                      setExceptionModalOpen(true);
                    }}
                  >
                    Submit Attendance Exception Request
                  </Button>
                )}
              </div>
            )}

            {/* Submit Check-In / Check-Out */}
            <Button
              variant={activeSession ? 'danger' : 'success'}
              size="lg"
              className="w-full"
              disabled={submitting || !selfieDataUrl || !gps}
              onClick={handleSubmitAttendance}
            >
              <ShieldCheck className="w-5 h-5" />
              {submitting
                ? 'Confirming with Server...'
                : activeSession
                ? 'Submit Check-Out'
                : 'Submit Check-In'}
            </Button>
          </SurfaceCard>

          {/* Live GPS Tracking & Site Geofence Map */}
          <div className="lg:col-span-6 space-y-4">
            <SiteGeofenceMap
              site={currentSite}
              gps={gps}
              gpsError={gpsError}
              locationLogs={locationLogs}
              trackingActive={Boolean(activeSession?.trackingActive)}
            />

            <SurfaceCard className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-[#2563EB]" />
                  <h3 className="text-sm font-bold text-[#101F35]">Work-Session Location Tracking</h3>
                </div>
                <StatusLabel
                  label={activeSession?.trackingActive ? 'Active (5m interval)' : 'Inactive'}
                  tone={activeSession?.trackingActive ? 'success' : 'neutral'}
                />
              </div>

              <p className="text-xs text-[#64748B] leading-relaxed">
                Location tracking runs <strong>only while checked in</strong> for site coordination and stops automatically when you check out. In web or background mobile modes, updates are best-effort and queued offline if signal drops.
              </p>

              {activeSession?.trackingActive && (
                <div className="pt-2 border-t border-[#E2E8F0] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-[#64748B]">
                      Last update:{' '}
                      <strong className="font-mono text-[#101F35]">
                        {formatTime(lastLocationPingAt || activeSession.lastLocationUpdateAt || activeSession.checkInTime)}
                      </strong>
                    </span>
                    <span className="text-[#64748B]">
                      {lastLocationStatus || `${locationLogs.length} session ping(s) recorded`}
                    </span>
                  </div>
                  <Button variant="secondary" size="md" onClick={() => void triggerLocationPingNow()}>
                    <RefreshCw className="w-4 h-4" />
                    Send Location Update Now
                  </Button>
                </div>
              )}
            </SurfaceCard>
          </div>
        </div>
      )}

      {/* Recent Attendance History & Exceptions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SurfaceCard className="space-y-3">
          <h2 className="text-base font-bold text-[#101F35]">Recent Attendance Sessions</h2>
          <div className="divide-y divide-[#E2E8F0]">
            {recentAttendance.map((s) => (
              <div key={s.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#101F35] truncate">
                    {formatDate(s.shiftDate)} · {s.siteName}
                  </p>
                  <p className="text-xs text-[#64748B] font-mono tabular-nums">
                    In {formatTime(s.checkInTime)}
                    {s.checkOutTime ? ` · Out ${formatTime(s.checkOutTime)}` : ' · Active'}
                    {s.payableMinutes !== undefined ? ` · ${Math.floor(s.payableMinutes / 60)}h ${s.payableMinutes % 60}m payable` : ''}
                  </p>
                </div>
                <StatusLabel label={s.approvalStatus} tone={inferStatusTone(s.approvalStatus)} className="shrink-0" />
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard className="space-y-3">
          <h2 className="text-base font-bold text-[#101F35]">Attendance Exception Requests</h2>
          {exceptions.length === 0 ? (
            <p className="text-sm text-[#64748B] py-4">No exception requests submitted.</p>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {exceptions.map((ex) => (
                <div key={ex.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#101F35]">{ex.reasonType}</span>
                    <StatusLabel label={ex.status} tone={inferStatusTone(ex.status)} />
                  </div>
                  <p className="text-xs text-[#64748B]">{ex.notes}</p>
                  <p className="text-[11px] font-mono text-[#64748B]">
                    {ex.siteName} · {formatDate(ex.requestedAt)} {formatTime(ex.requestedAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>
      </div>

      {/* Live Selfie Capture Modal */}
      <SelfieCameraModal
        open={cameraModalOpen}
        mode={cameraMode}
        siteName={currentSite.siteName}
        onClose={() => setCameraModalOpen(false)}
        onCaptured={handleSelfieCaptured}
        onReportCameraException={(msg) => {
          setCameraModalOpen(false);
          setExceptionReason('Camera Unavailable');
          setExceptionNotes(msg);
          setExceptionModalOpen(true);
        }}
      />

      {/* Attendance Exception Modal */}
      <ModalSheet
        open={exceptionModalOpen}
        onClose={() => setExceptionModalOpen(false)}
        title="Attendance Exception Request"
        subtitle={`${currentSite.siteName} · Sent to supervisor for approval`}
      >
        <form onSubmit={handleSubmitException} className="space-y-4">
          <FormField label="Exception Reason">
            <select
              value={exceptionReason}
              onChange={(e) => setExceptionReason(e.target.value as AttendanceException['reasonType'])}
              className={inputClass}
            >
              <option value="Outside Geofence">Outside Site Geofence</option>
              <option value="GPS Unavailable">GPS Permission / Signal Unavailable</option>
              <option value="Weak GPS">Weak GPS Accuracy</option>
              <option value="Camera Unavailable">Front Camera Unavailable</option>
              <option value="Network Offline">Network Connectivity Issue</option>
            </select>
          </FormField>
          <FormField label="Explanation for Supervisor" required>
            <textarea
              rows={3}
              value={exceptionNotes}
              onChange={(e) => setExceptionNotes(e.target.value)}
              placeholder="Explain where you are working and why check-in verification failed..."
              className={inputClass}
              required
            />
          </FormField>
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={exceptionSubmitting}>
            {exceptionSubmitting ? 'Submitting...' : 'Submit Exception Request'}
          </Button>
        </form>
      </ModalSheet>

      {/* Server Confirmation Dialog */}
      <ModalSheet
        open={Boolean(successConfirmation)}
        onClose={() => setSuccessConfirmation(null)}
        title={successConfirmation?.title || 'Attendance Confirmed'}
        subtitle="Confirmed and recorded by BuildFlow server"
      >
        {successConfirmation && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#16A34A]/10 border border-[#16A34A]/25">
              <CheckCircle2 className="w-6 h-6 text-[#16A34A] shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-[#101F35]">{emp.fullName}</p>
                <p className="text-xs text-[#64748B] font-mono">
                  Ref: {successConfirmation.session.referenceId}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <img
                src={
                  successConfirmation.session.checkOutSelfieDataUrl ||
                  successConfirmation.session.checkInSelfieDataUrl
                }
                alt="Verified attendance selfie"
                className="w-20 h-20 rounded-2xl object-cover border border-[#E2E8F0]"
                referrerPolicy="no-referrer"
              />
              <div className="text-xs space-y-1.5">
                <p className="flex items-center gap-1.5 text-[#172B4D]">
                  <MapPin className="w-3.5 h-3.5 text-[#2563EB]" />
                  <strong>{successConfirmation.session.siteName}</strong>
                </p>
                <p className="flex items-center gap-1.5 text-[#172B4D] font-mono tabular-nums">
                  <Clock className="w-3.5 h-3.5 text-[#2563EB]" />
                  {formatTime(
                    successConfirmation.session.checkOutTime || successConfirmation.session.checkInTime
                  )}
                </p>
                <StatusLabel
                  label={
                    (
                      successConfirmation.session.checkOutGeofence ||
                      successConfirmation.session.checkInGeofence
                    ).statusLabel
                  }
                  tone="success"
                />
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => setSuccessConfirmation(null)}
            >
              Done
            </Button>
          </div>
        )}
      </ModalSheet>
    </div>
  );
};
