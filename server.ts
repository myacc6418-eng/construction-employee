import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getDb, saveDb } from './server/db';
import type {
  AttendanceException,
  AttendanceSession,
  EmployeeProfile,
  GeofenceCheckResult,
  LeaveRequest,
  LocationLog,
  PurchaseExpense,
  PurchaseExpenseItem,
  PurchaseRequest,
  SafetyIncident,
  SupportTicket,
  WorkProgressUpdate,
} from './src/types/buildflow';

const PORT = Number(process.env.PORT || 3000);

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

function fromPaise(paise: number): number {
  return Math.round(paise) / 100;
}

function evaluateGeofence(
  lat: number,
  lng: number,
  accuracyMeters: number,
  siteLat: number,
  siteLng: number,
  radiusMeters: number,
  geofenceEnabled: boolean
): GeofenceCheckResult {
  const distanceMeters = haversineMeters(lat, lng, siteLat, siteLng);
  if (!geofenceEnabled) {
    return {
      withinGeofence: true,
      distanceMeters,
      allowedRadiusMeters: radiusMeters,
      geofenceEnabled: false,
      accuracyMeters,
      statusLabel: 'Geofence Disabled',
    };
  }
  if (accuracyMeters > 120) {
    return {
      withinGeofence: false,
      distanceMeters,
      allowedRadiusMeters: radiusMeters,
      geofenceEnabled: true,
      accuracyMeters,
      statusLabel: 'Weak GPS Accuracy',
    };
  }
  const within = distanceMeters <= radiusMeters;
  return {
    withinGeofence: within,
    distanceMeters,
    allowedRadiusMeters: radiusMeters,
    geofenceEnabled: true,
    accuracyMeters,
    statusLabel: within ? 'Verified Inside Site' : 'Outside Geofence',
  };
}

function logActivity(employeeId: string, action: string, entityType: string, entityId: string, details: string) {
  const db = getDb();
  db.activityLogs.unshift({
    id: `log-${crypto.randomUUID().slice(0, 8)}`,
    employeeId,
    action,
    entityType,
    entityId,
    details,
    timestamp: new Date().toISOString(),
  });
  if (db.activityLogs.length > 500) {
    db.activityLogs.length = 500;
  }
}

interface AuthedRequest extends express.Request {
  employee?: EmployeeProfile;
  sessionToken?: string;
}

function requireEmployeeAuth(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  const token = (req.headers['x-session-token'] as string) || '';
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  const db = getDb();
  const sess = db.sessions[token];
  if (!sess) {
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }
  const emp = db.employees.find((e) => e.id === sess.employeeId);
  if (!emp) {
    return res.status(401).json({ error: 'Employee account not found.' });
  }
  req.employee = emp;
  req.sessionToken = token;
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, serverTime: new Date().toISOString() });
  });

  // Public sample worker list for demo login selector (strictly non-sensitive display metadata)
  app.get('/api/auth/sample-profiles', (_req, res) => {
    const db = getDb();
    res.json({
      isSampleData: true,
      profiles: db.employees.map((e) => ({
        employeeCode: e.employeeCode,
        fullName: e.fullName,
        designation: e.designation,
        employmentCategory: e.employmentCategory,
        payModel: e.payModel,
        primaryProjectName: e.primaryProjectName,
        primarySiteName: e.primarySiteName,
        avatarUrl: e.avatarUrl,
      })),
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { employeeCode, pin } = req.body || {};
    if (!employeeCode || typeof employeeCode !== 'string') {
      return res.status(400).json({ error: 'Employee ID is required.' });
    }
    const db = getDb();
    const normalized = employeeCode.trim().toUpperCase();
    const emp = db.employees.find((e) => e.employeeCode.toUpperCase() === normalized);
    if (!emp) {
      return res.status(401).json({ error: 'No worker found with that Employee ID.' });
    }
    const cred = db.credentials[emp.employeeCode];
    if (!cred || cred.pin !== String(pin || '').trim()) {
      return res.status(401).json({ error: 'Invalid 4-digit PIN.' });
    }
    const token = crypto.randomBytes(24).toString('hex');
    db.sessions[token] = { employeeId: emp.id, createdAt: new Date().toISOString() };
    logActivity(emp.id, 'LOGIN', 'session', token.slice(0, 8), 'Worker signed in');
    saveDb();
    res.json({ token, employee: emp });
  });

  app.post('/api/auth/logout', requireEmployeeAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    if (req.sessionToken) {
      delete db.sessions[req.sessionToken];
      saveDb();
    }
    res.json({ ok: true });
  });

  // Record-ID manipulation protection demonstration & enforcement
  app.get('/api/employees/:id', requireEmployeeAuth, (req: AuthedRequest, res) => {
    if (req.params.id !== req.employee!.id) {
      return res.status(403).json({ error: 'Access denied. Employees can only access their own profile.' });
    }
    res.json({ employee: req.employee });
  });

  // Bootstrap all employee-scoped workspace data
  app.get('/api/me/bootstrap', requireEmployeeAuth, (req: AuthedRequest, res) => {
    const emp = req.employee!;
    const db = getDb();
    const authorizedSites = db.sites.filter((s) => emp.authorizedSiteIds.includes(s.id));
    const sessions = db.attendanceSessions
      .filter((s) => s.employeeId === emp.id)
      .sort((a, b) => b.checkInTime.localeCompare(a.checkInTime));
    const activeSession = sessions.find((s) => s.status === 'active') || null;
    const unresolvedSession = sessions.find((s) => s.status === 'unresolved') || null;
    const locationLogs = activeSession
      ? db.locationLogs.filter((l) => l.sessionId === activeSession.id && l.employeeId === emp.id)
      : [];
    const notifications = db.notifications
      .filter((n) => n.employeeId === emp.id)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    res.json({
      serverTime: new Date().toISOString(),
      employee: emp,
      authorizedSites,
      activeSession,
      unresolvedSession,
      recentAttendance: sessions.slice(0, 15),
      attendanceExceptions: db.attendanceExceptions.filter((ex) => ex.employeeId === emp.id),
      locationLogs,
      workAssignments: db.workAssignments.filter((w) => w.employeeId === emp.id),
      salaryProfile: db.salaryProfiles.find((s) => s.employeeId === emp.id) || null,
      payslips: db.payslips.filter((p) => p.employeeId === emp.id),
      paymentTransactions: db.paymentTransactions.filter((t) => t.employeeId === emp.id),
      leaveBalances: emp.leaveEligible ? db.leaveBalances[emp.id] || [] : [],
      leaveRequests: emp.leaveEligible ? db.leaveRequests.filter((l) => l.employeeId === emp.id) : [],
      advanceRequests: db.advanceRequests.filter((a) => a.employeeId === emp.id),
      purchaseRequests: db.purchaseRequests.filter((p) => p.employeeId === emp.id),
      purchaseExpenses: db.purchaseExpenses.filter((p) => p.employeeId === emp.id),
      documents: db.documents.filter((d) => d.employeeId === emp.id),
      safetyNotices: db.safetyNotices.filter((s) => emp.authorizedSiteIds.includes(s.siteId)),
      safetyIncidents: db.safetyIncidents.filter((i) => i.employeeId === emp.id),
      supportTickets: db.supportTickets.filter((t) => t.employeeId === emp.id),
      notifications,
    });
  });

  // Update only permitted personal fields (phone, email, emergency contact)
  app.patch('/api/me/profile', requireEmployeeAuth, (req: AuthedRequest, res) => {
    const emp = req.employee!;
    const db = getDb();
    const { phone, email, emergencyContactName, emergencyContactPhone, emergencyContactRelation, ...forbidden } =
      req.body || {};

    const blockedKeys = ['salary', 'employmentCategory', 'payModel', 'designation', 'primarySiteId', 'role'];
    const attemptedForbidden = Object.keys(forbidden).filter((k) => blockedKeys.includes(k));
    if (attemptedForbidden.length > 0) {
      return res.status(403).json({
        error: `Employees cannot modify restricted company fields (${attemptedForbidden.join(', ')}). Submit an HR Help Desk ticket instead.`,
      });
    }

    const target = db.employees.find((e) => e.id === emp.id);
    if (!target) return res.status(404).json({ error: 'Employee not found.' });

    if (typeof phone === 'string' && phone.trim().length >= 8) target.phone = phone.trim();
    if (typeof email === 'string' && email.includes('@')) target.email = email.trim();
    if (typeof emergencyContactName === 'string' && emergencyContactName.trim()) {
      target.emergencyContactName = emergencyContactName.trim();
    }
    if (typeof emergencyContactPhone === 'string' && emergencyContactPhone.trim().length >= 8) {
      target.emergencyContactPhone = emergencyContactPhone.trim();
    }
    if (typeof emergencyContactRelation === 'string' && emergencyContactRelation.trim()) {
      target.emergencyContactRelation = emergencyContactRelation.trim();
    }

    logActivity(emp.id, 'PROFILE_UPDATE', 'employee', emp.id, 'Updated personal contact details');
    saveDb();
    res.json({ employee: target });
  });

  // Check-In with live selfie + GPS + server geofence verification + idempotency
  app.post('/api/attendance/check-in', requireEmployeeAuth, (req: AuthedRequest, res) => {
    const emp = req.employee!;
    const db = getDb();
    const { siteId, selfieDataUrl, captureSource, latitude, longitude, accuracyMeters, deviceTimestamp, idempotencyKey } =
      req.body || {};

    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      return res.status(400).json({ error: 'Missing idempotencyKey.' });
    }
    if (db.idempotencyKeys[idempotencyKey]) {
      return res.json(db.idempotencyKeys[idempotencyKey]);
    }

    // Check unresolved or active sessions
    const existingUnresolved = db.attendanceSessions.find(
      (s) => s.employeeId === emp.id && s.status === 'unresolved'
    );
    if (existingUnresolved) {
      return res.status(409).json({
        code: 'UNRESOLVED_SESSION',
        error: 'You have an unresolved attendance session from a previous shift. Please resolve it before starting a new check-in.',
        unresolvedSession: existingUnresolved,
      });
    }

    const existingActive = db.attendanceSessions.find(
      (s) => s.employeeId === emp.id && s.status === 'active'
    );
    if (existingActive) {
      return res.status(409).json({
        code: 'DUPLICATE_CHECK_IN',
        error: 'You are already checked in. Duplicate check-in sessions are not allowed.',
        activeSession: existingActive,
      });
    }

    const site = db.sites.find((s) => s.id === siteId && emp.authorizedSiteIds.includes(s.id));
    if (!site) {
      return res.status(403).json({
        code: 'MISSING_ASSIGNED_SITE',
        error: 'Selected site is missing or not authorized for your profile.',
      });
    }

    if (captureSource !== 'live_camera' || typeof selfieDataUrl !== 'string' || !selfieDataUrl.startsWith('data:image/')) {
      return res.status(400).json({
        code: 'INVALID_SELFIE',
        error: 'A fresh live selfie from the device camera is required. Gallery uploads are not allowed.',
      });
    }

    if (typeof latitude !== 'number' || typeof longitude !== 'number' || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return res.status(400).json({
        code: 'GPS_UNAVAILABLE',
        error: 'Valid GPS coordinates are required for attendance check-in.',
      });
    }

    // Timestamp sanity check (±2 hours from server clock)
    if (deviceTimestamp) {
      const diffMs = Math.abs(Date.now() - new Date(deviceTimestamp).getTime());
      if (Number.isNaN(diffMs) || diffMs > 2 * 60 * 60 * 1000) {
        return res.status(400).json({
          code: 'INVALID_TIMESTAMP',
          error: 'Device clock is out of sync with server time. Enable automatic network time and retry.',
        });
      }
    }

    const acc = typeof accuracyMeters === 'number' ? Math.round(accuracyMeters) : 50;
    const geofence = evaluateGeofence(
      latitude,
      longitude,
      acc,
      site.latitude,
      site.longitude,
      site.geofenceRadiusMeters,
      site.geofenceEnabled
    );

    if (geofence.statusLabel === 'Weak GPS Accuracy') {
      return res.status(422).json({
        code: 'WEAK_GPS',
        error: `GPS accuracy is too weak (±${acc}m). Move to an open sky area or submit an Attendance Exception request.`,
        geofence,
      });
    }

    if (!geofence.withinGeofence) {
      return res.status(422).json({
        code: 'OUTSIDE_GEOFENCE',
        error: `You are ${geofence.distanceMeters}m away from ${site.siteName} (allowed radius: ${site.geofenceRadiusMeters}m).`,
        geofence,
        allowException: site.allowGeofenceException,
      });
    }

    const nowIso = new Date().toISOString();
    const session: AttendanceSession = {
      id: `att-${crypto.randomUUID().slice(0, 8)}`,
      referenceId: `ATT-${nowIso.slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      organizationId: emp.organizationId,
      employeeId: emp.id,
      siteId: site.id,
      siteName: site.siteName,
      projectName: site.projectName,
      shiftDate: nowIso.slice(0, 10),
      shiftName: site.shiftName,
      status: 'active',
      approvalStatus: 'Pending Verification',
      checkInTime: nowIso,
      checkInSelfieDataUrl: selfieDataUrl,
      checkInLat: latitude,
      checkInLng: longitude,
      checkInAccuracyMeters: acc,
      checkInGeofence: geofence,
      trackingActive: true,
      lastLocationUpdateAt: nowIso,
      idempotencyKey,
    };

    const initialLog: LocationLog = {
      id: `loc-${crypto.randomUUID().slice(0, 8)}`,
      sessionId: session.id,
      employeeId: emp.id,
      latitude,
      longitude,
      accuracyMeters: acc,
      capturedAt: nowIso,
      syncedAt: nowIso,
      withinGeofence: geofence.withinGeofence,
      distanceMeters: geofence.distanceMeters,
      isStale: false,
      source: 'live',
    };

    db.attendanceSessions.unshift(session);
    db.locationLogs.unshift(initialLog);
    db.notifications.unshift({
      id: `not-${crypto.randomUUID().slice(0, 8)}`,
      employeeId: emp.id,
      title: 'Check-In Recorded',
      message: `Checked in at ${site.siteName} (${session.referenceId}). Live session tracking started.`,
      category: 'Attendance',
      timestamp: nowIso,
      read: false,
      projectSite: `${site.projectName} · ${site.siteName}`,
      targetRoute: '/attendance',
    });

    const responsePayload = { session, initialLog };
    db.idempotencyKeys[idempotencyKey] = responsePayload;
    logActivity(emp.id, 'CHECK_IN', 'attendance_session', session.id, `Checked in at ${site.siteName}`);
    saveDb();
    res.status(201).json(responsePayload);
  });

  // Check-Out with fresh live selfie + GPS + payable policy calculation
  app.post('/api/attendance/check-out', requireEmployeeAuth, (req: AuthedRequest, res) => {
    const emp = req.employee!;
    const db = getDb();
    const { sessionId, selfieDataUrl, captureSource, latitude, longitude, accuracyMeters, idempotencyKey } =
      req.body || {};

    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      return res.status(400).json({ error: 'Missing idempotencyKey.' });
    }
    if (db.idempotencyKeys[idempotencyKey]) {
      return res.json(db.idempotencyKeys[idempotencyKey]);
    }

    const session = db.attendanceSessions.find(
      (s) => s.id === sessionId && s.employeeId === emp.id && s.status === 'active'
    );
    if (!session) {
      return res.status(404).json({ error: 'No active attendance session found to check out.' });
    }

    if (captureSource !== 'live_camera' || typeof selfieDataUrl !== 'string' || !selfieDataUrl.startsWith('data:image/')) {
      return res.status(400).json({ error: 'A fresh live selfie is required to check out.' });
    }

    const site = db.sites.find((s) => s.id === session.siteId);
    const acc = typeof accuracyMeters === 'number' ? Math.round(accuracyMeters) : 50;
    const lat = typeof latitude === 'number' ? latitude : session.checkInLat;
    const lng = typeof longitude === 'number' ? longitude : session.checkInLng;

    const geofence = site
      ? evaluateGeofence(lat, lng, acc, site.latitude, site.longitude, site.geofenceRadiusMeters, site.geofenceEnabled)
      : session.checkInGeofence;

    const nowIso = new Date().toISOString();
    const totalMinutes = Math.max(
      1,
      Math.round((new Date(nowIso).getTime() - new Date(session.checkInTime).getTime()) / 60000)
    );
    const breakApplied = site && totalMinutes > 240 ? site.breakMinutes : 0;
    const payableMinutes = Math.max(0, totalMinutes - breakApplied);

    session.status = 'completed';
    session.checkOutTime = nowIso;
    session.checkOutSelfieDataUrl = selfieDataUrl;
    session.checkOutLat = lat;
    session.checkOutLng = lng;
    session.checkOutAccuracyMeters = acc;
    session.checkOutGeofence = geofence;
    session.totalDurationMinutes = totalMinutes;
    session.breakMinutesApplied = breakApplied;
    session.payableMinutes = payableMinutes;
    session.trackingActive = false;
    session.approvalStatus = geofence.withinGeofence ? 'Pending Verification' : 'Exception Pending';

    db.notifications.unshift({
      id: `not-${crypto.randomUUID().slice(0, 8)}`,
      employeeId: emp.id,
      title: 'Check-Out Successful',
      message: `Session ${session.referenceId} completed (${totalMinutes} mins logged; tracking stopped).`,
      category: 'Attendance',
      timestamp: nowIso,
      read: false,
      projectSite: `${session.projectName} · ${session.siteName}`,
      targetRoute: '/attendance',
    });

    const responsePayload = { session };
    db.idempotencyKeys[idempotencyKey] = responsePayload;
    logActivity(emp.id, 'CHECK_OUT', 'attendance_session', session.id, `Checked out (${totalMinutes} mins)`);
    saveDb();
    res.json(responsePayload);
  });

  // Resolve an unresolved previous attendance session
  app.post('/api/attendance/resolve-session', requireEmployeeAuth, (req: AuthedRequest, res) => {
    const emp = req.employee!;
    const db = getDb();
    const { sessionId, estimatedEndTime, reason, idempotencyKey } = req.body || {};
    if (!idempotencyKey) return res.status(400).json({ error: 'Missing idempotencyKey.' });
    if (db.idempotencyKeys[idempotencyKey]) return res.json(db.idempotencyKeys[idempotencyKey]);

    const session = db.attendanceSessions.find(
      (s) => s.id === sessionId && s.employeeId === emp.id && s.status === 'unresolved'
    );
    if (!session) return res.status(404).json({ error: 'Unresolved session not found.' });

    const nowIso = new Date().toISOString();
    session.status = 'completed';
    session.approvalStatus = 'Exception Pending';
    session.checkOutTime = estimatedEndTime || `${session.shiftDate}T17:30:00.000Z`;
    session.trackingActive = false;

    const ex: AttendanceException = {
      id: `ex-${crypto.randomUUID().slice(0, 8)}`,
      employeeId: emp.id,
      siteId: session.siteId,
      siteName: session.siteName,
      reasonType: 'Unresolved Session Recovery',
      notes: reason || 'Forgot to check out before leaving site; requested supervisor confirmation.',
      requestedAt: nowIso,
      status: 'Submitted',
      idempotencyKey,
    };
    db.attendanceExceptions.unshift(ex);

    const payload = { session, exception: ex };
    db.idempotencyKeys[idempotencyKey] = payload;
    logActivity(emp.id, 'RESOLVE_SESSION', 'attendance_session', session.id, 'Submitted unresolved session recovery');
    saveDb();
    res.json(payload);
  });

  // Attendance Exception Request (geofence fail, camera denied, GPS unavailable, offline check-in)
  app.post('/api/attendance/exception', requireEmployeeAuth, (req: AuthedRequest, res) => {
    const emp = req.employee!;
    const db = getDb();
    const { siteId, reasonType, notes, latitude, longitude, accuracyMeters, idempotencyKey } = req.body || {};

    if (!idempotencyKey) return res.status(400).json({ error: 'Missing idempotencyKey.' });
    if (db.idempotencyKeys[idempotencyKey]) return res.json(db.idempotencyKeys[idempotencyKey]);

    const site = db.sites.find((s) => s.id === siteId && emp.authorizedSiteIds.includes(s.id));
    if (!site) return res.status(403).json({ error: 'Invalid or unauthorized site.' });
    if (!notes || typeof notes !== 'string' || notes.trim().length < 5) {
      return res.status(400).json({ error: 'Please explain the reason for this exception request.' });
    }

    const nowIso = new Date().toISOString();
    const ex: AttendanceException = {
      id: `ex-${crypto.randomUUID().slice(0, 8)}`,
      employeeId: emp.id,
      siteId: site.id,
      siteName: site.siteName,
      reasonType: reasonType || 'Outside Geofence',
      notes: notes.trim(),
      latitude: typeof latitude === 'number' ? latitude : undefined,
      longitude: typeof longitude === 'number' ? longitude : undefined,
      accuracyMeters: typeof accuracyMeters === 'number' ? accuracyMeters : undefined,
      requestedAt: nowIso,
      status: 'Submitted',
      idempotencyKey,
    };

    db.attendanceExceptions.unshift(ex);
    db.notifications.unshift({
      id: `not-${crypto.randomUUID().slice(0, 8)}`,
      employeeId: emp.id,
      title: 'Attendance Exception Sent',
      message: `${ex.reasonType} exception for ${site.siteName} sent to supervisor for review.`,
      category: 'Attendance',
      timestamp: nowIso,
      read: false,
      projectSite: `${site.projectName} · ${site.siteName}`,
      targetRoute: '/attendance',
    });

    const payload = { exception: ex };
    db.idempotencyKeys[idempotencyKey] = payload;
    logActivity(emp.id, 'ATTENDANCE_EXCEPTION', 'attendance_exception', ex.id, ex.reasonType);
    saveDb();
    res.status(201).json(payload);
  });

  // Live GPS location ping (ONLY allowed during an active checked-in session)
  app.post('/api/attendance/location-ping', requireEmployeeAuth, (req: AuthedRequest, res) => {
    const emp = req.employee!;
    const db = getDb();
    const { sessionId, latitude, longitude, accuracyMeters, capturedAt, source } = req.body || {};

    const session = db.attendanceSessions.find(
      (s) => s.id === sessionId && s.employeeId === emp.id && s.status === 'active'
    );
    if (!session) {
      return res.status(403).json({
        error: 'Location tracking is strictly inactive outside an authorized active check-in session.',
      });
    }

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'Valid GPS latitude and longitude required.' });
    }

    const site = db.sites.find((s) => s.id === session.siteId);
    const acc = typeof accuracyMeters === 'number' ? Math.round(accuracyMeters) : 35;
    const distanceMeters = site ? haversineMeters(latitude, longitude, site.latitude, site.longitude) : 0;
    const withinGeofence = site ? !site.geofenceEnabled || distanceMeters <= site.geofenceRadiusMeters : true;
    const nowIso = new Date().toISOString();
    const capturedIso = capturedAt || nowIso;
    const ageMs = Date.now() - new Date(capturedIso).getTime();

    const log: LocationLog = {
      id: `loc-${crypto.randomUUID().slice(0, 8)}`,
      sessionId: session.id,
      employeeId: emp.id,
      latitude,
      longitude,
      accuracyMeters: acc,
      capturedAt: capturedIso,
      syncedAt: nowIso,
      withinGeofence,
      distanceMeters,
      isStale: ageMs > 10 * 60 * 1000,
      source: source === 'offline_queue' ? 'offline_queue' : 'live',
    };

    session.lastLocationUpdateAt = nowIso;
    db.locationLogs.unshift(log);
    if (db.locationLogs.length > 500) db.locationLogs.length = 500;
    saveDb();
    res.status(201).json({ log });
  });

  // Work assignments actions (worker cannot self-approve Completed)
  app.post('/api/work/:id/action', requireEmployeeAuth, (req: AuthedRequest, res) => {
    const emp = req.employee!;
    const db = getDb();
    const { action, completedQuantity, notes, photoDataUrls, idempotencyKey } = req.body || {};

    if (!idempotencyKey) return res.status(400).json({ error: 'Missing idempotencyKey.' });
    if (db.idempotencyKeys[idempotencyKey]) return res.json(db.idempotencyKeys[idempotencyKey]);

    const work = db.workAssignments.find((w) => w.id === req.params.id);
    if (!work) return res.status(404).json({ error: 'Work assignment not found.' });
    if (work.employeeId !== emp.id) {
      return res.status(403).json({ error: 'Access denied. You can only update your own assigned work.' });
    }

    if (action === 'mark_approved_self') {
      return res.status(403).json({ error: 'Employees cannot officially approve their own submitted work.' });
    }

    const nowIso = new Date().toISOString();
    let updateType: WorkProgressUpdate['updateType'] = 'progress';

    switch (action) {
      case 'accept':
        work.status = 'Acknowledged';
        updateType = 'status_change';
        break;
      case 'start':
        work.status = 'In Progress';
        updateType = 'status_change';
        break;
      case 'progress':
        work.status = 'In Progress';
        updateType = 'progress';
        if (work.measurable && typeof completedQuantity === 'number' && completedQuantity >= 0) {
          work.completedQuantity = completedQuantity;
        }
        break;
      case 'submit':
        work.status = 'Submitted for Review';
        updateType = 'submission';
        if (work.measurable && typeof completedQuantity === 'number' && completedQuantity >= 0) {
          work.completedQuantity = completedQuantity;
        }
        break;
      case 'blocker':
        work.status = 'On Hold';
        updateType = 'blocker';
        break;
      case 'clarification':
        updateType = 'clarification';
        break;
      default:
        return res.status(400).json({ error: 'Unsupported work action.' });
    }

    const update: WorkProgressUpdate = {
      id: `upd-${crypto.randomUUID().slice(0, 8)}`,
      workId: work.id,
      employeeId: emp.id,
      updateType,
      completedQuantity: typeof completedQuantity === 'number' ? completedQuantity : undefined,
      notes: typeof notes === 'string' && notes.trim() ? notes.trim() : `Action: ${action}`,
      photoDataUrls: Array.isArray(photoDataUrls) ? photoDataUrls.slice(0, 4) : [],
      createdAt: nowIso,
      idempotencyKey,
    };

    work.updates.unshift(update);
    const payload = { work };
    db.idempotencyKeys[idempotencyKey] = payload;
    logActivity(emp.id, `WORK_${action.toUpperCase()}`, 'work_assignment', work.id, update.notes);
    saveDb();
    res.json(payload);
  });

  // Payslip secure download / printable view (strict employee ownership check)
  app.get('/api/payslips/:id', requireEmployeeAuth, (req: AuthedRequest, res) => {
    const emp = req.employee!;
    const db = getDb();
    const slip = db.payslips.find((p) => p.id === req.params.id);
    if (!slip) return res.status(404).json({ error: 'Payslip not found.' });
    if (slip.employeeId !== emp.id) {
      return res.status(403).json({ error: 'Access denied. You cannot view another worker’s payslip.' });
    }
    res.json({ payslip: slip, employee: emp });
  });

  // Leave request submission (checks employee eligibility)
  app.post('/api/leaves', requireEmployeeAuth, (req: AuthedRequest, res) => {
    const emp = req.employee!;
    const db = getDb();
    if (!emp.leaveEligible) {
      return res.status(403).json({
        error: 'Paid leave requests are not configured for your employment category. Contact site supervisor or raise a Help Desk ticket.',
      });
    }

    const { leaveTypeId, startDate, endDate, durationType, reason, contactDuringLeave, supportingDocName, idempotencyKey } =
      req.body || {};

    if (!idempotencyKey) return res.status(400).json({ error: 'Missing idempotencyKey.' });
    if (db.idempotencyKeys[idempotencyKey]) return res.json(db.idempotencyKeys[idempotencyKey]);

    const balances = db.leaveBalances[emp.id] || [];
    const bal = balances.find((b) => b.leaveTypeId === leaveTypeId);
    if (!bal) return res.status(400).json({ error: 'Invalid leave category for your profile.' });

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return res.status(400).json({ error: 'Please select a valid date range.' });
    }

    // Count working days excluding Sundays
    let workingDays = 0;
    const cursor = new Date(start);
    while (cursor <= end) {
      if (cursor.getDay() !== 0) workingDays += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
    if (durationType === 'First Half' || durationType === 'Second Half') {
      workingDays = 0.5;
    }
    if (workingDays <= 0) {
      return res.status(400).json({ error: 'Selected dates only contain non-working holidays/Sundays.' });
    }
    if (workingDays > bal.available) {
      return res.status(400).json({
        error: `Insufficient ${bal.leaveTypeName} balance (${bal.available} days available, requested ${workingDays}).`,
      });
    }

    const nowIso = new Date().toISOString();
    const lr: LeaveRequest = {
      id: `lv-${crypto.randomUUID().slice(0, 8)}`,
      employeeId: emp.id,
      leaveTypeId: bal.leaveTypeId,
      leaveTypeName: bal.leaveTypeName,
      startDate,
      endDate,
      durationType: durationType || 'Full Day',
      workingDaysCount: workingDays,
      reason: String(reason || '').trim(),
      contactDuringLeave: contactDuringLeave ? String(contactDuringLeave).trim() : undefined,
      supportingDocName: supportingDocName ? String(supportingDocName).trim() : undefined,
      status: 'Submitted',
      submittedAt: nowIso,
      idempotencyKey,
    };

    bal.pending += workingDays;
    bal.available = Math.max(0, bal.allocated - bal.used - bal.pending);
    db.leaveRequests.unshift(lr);

    const payload = { leaveRequest: lr, leaveBalances: balances };
    db.idempotencyKeys[idempotencyKey] = payload;
    logActivity(emp.id, 'LEAVE_SUBMIT', 'leave_request', lr.id, `${lr.leaveTypeName} (${workingDays}d)`);
    saveDb();
    res.status(201).json(payload);
  });

  app.post('/api/leaves/:id/cancel', requireEmployeeAuth, (req: AuthedRequest, res) => {
    const emp = req.employee!;
    const db = getDb();
    const lr = db.leaveRequests.find((l) => l.id === req.params.id);
    if (!lr) return res.status(404).json({ error: 'Leave request not found.' });
    if (lr.employeeId !== emp.id) return res.status(403).json({ error: 'Access denied.' });
    if (!['Submitted', 'Under Review', 'Draft'].includes(lr.status)) {
      return res.status(400).json({ error: 'Only pending leave requests can be cancelled.' });
    }
    lr.status = 'Cancelled';
    const balances = db.leaveBalances[emp.id] || [];
    const bal = balances.find((b) => b.leaveTypeId === lr.leaveTypeId);
    if (bal) {
      bal.pending = Math.max(0, bal.pending - lr.workingDaysCount);
      bal.available = Math.max(0, bal.allocated - bal.used - bal.pending);
    }
    saveDb();
    res.json({ leaveRequest: lr, leaveBalances: balances });
  });

  // Advance / Loan requests
  app.post('/api/advances', requireEmployeeAuth, (req: AuthedRequest, res) => {
    const emp = req.employee!;
    const db = getDb();
    const { requestType, requestedAmount, reason, repaymentMonths, idempotencyKey } = req.body || {};

    if (!idempotencyKey) return res.status(400).json({ error: 'Missing idempotencyKey.' });
    if (db.idempotencyKeys[idempotencyKey]) return res.json(db.idempotencyKeys[idempotencyKey]);

    const amount = Number(requestedAmount);
    const months = Math.max(1, Math.min(12, Number(repaymentMonths) || 2));
    if (!amount || amount < 200 || amount > 50000) {
      return res.status(400).json({ error: 'Requested advance amount must be between ₹200 and ₹50,000.' });
    }

    const nowIso = new Date().toISOString();
    const installmentPaise = Math.floor(toPaise(amount) / months);
    const remainderPaise = toPaise(amount) - installmentPaise * months;

    const schedule = Array.from({ length: months }).map((_, idx) => {
      const d = new Date();
      d.setMonth(d.getMonth() + idx + 1);
      const amt = fromPaise(installmentPaise + (idx === months - 1 ? remainderPaise : 0));
      return {
        id: `rep-${crypto.randomUUID().slice(0, 6)}`,
        installmentNumber: idx + 1,
        dueDate: d.toISOString().slice(0, 10),
        payrollPeriod: d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        amount: amt,
        status: 'Scheduled' as const,
      };
    });

    const adv = {
      id: `adv-${crypto.randomUUID().slice(0, 8)}`,
      employeeId: emp.id,
      requestType: requestType || 'Salary Advance',
      requestedAmount: amount,
      reason: String(reason || '').trim(),
      repaymentMonths: months,
      status: 'Submitted' as const,
      submittedAt: nowIso,
      repaidAmount: 0,
      remainingBalance: amount,
      repaymentSchedule: schedule,
      idempotencyKey,
    };

    db.advanceRequests.unshift(adv);
    const payload = { advance: adv };
    db.idempotencyKeys[idempotencyKey] = payload;
    logActivity(emp.id, 'ADVANCE_SUBMIT', 'employee_advance', adv.id, `₹${amount} (${months} installments)`);
    saveDb();
    res.status(201).json(payload);
  });

  // Workflow A: Purchase Request (asking company to buy materials)
  app.post('/api/purchases/requests', requireEmployeeAuth, (req: AuthedRequest, res) => {
    const emp = req.employee!;
    const db = getDb();
    const {
      siteId,
      materialCategory,
      materialName,
      requiredQuantity,
      unit,
      estimatedUnitPrice,
      priority,
      requiredDeliveryDate,
      reason,
      workTaskCode,
      photoDataUrl,
      idempotencyKey,
    } = req.body || {};

    if (!idempotencyKey) return res.status(400).json({ error: 'Missing idempotencyKey.' });
    if (db.idempotencyKeys[idempotencyKey]) return res.json(db.idempotencyKeys[idempotencyKey]);

    const site = db.sites.find((s) => s.id === siteId && emp.authorizedSiteIds.includes(s.id));
    if (!site) return res.status(403).json({ error: 'Invalid or unauthorized site.' });

    const qty = Number(requiredQuantity);
    const unitPrice = Number(estimatedUnitPrice) || 0;
    if (!materialName || qty <= 0) {
      return res.status(400).json({ error: 'Material name and positive quantity are required.' });
    }

    const total = fromPaise(Math.round(qty * toPaise(unitPrice)));
    const nowIso = new Date().toISOString();
    const pr: PurchaseRequest = {
      id: `pr-${crypto.randomUUID().slice(0, 8)}`,
      requestCode: `PR-2026-${Math.floor(500 + Math.random() * 499)}`,
      employeeId: emp.id,
      projectName: site.projectName,
      siteId: site.id,
      siteName: site.siteName,
      materialCategory: materialCategory || 'General Construction',
      materialName: String(materialName).trim(),
      requiredQuantity: qty,
      unit: unit || 'nos',
      estimatedUnitPrice: unitPrice,
      estimatedTotal: total,
      priority: priority || 'Standard',
      requiredDeliveryDate: requiredDeliveryDate || nowIso.slice(0, 10),
      reason: String(reason || '').trim(),
      workTaskCode: workTaskCode || undefined,
      photoDataUrl: typeof photoDataUrl === 'string' ? photoDataUrl : undefined,
      status: 'Submitted',
      submittedAt: nowIso,
      idempotencyKey,
    };

    db.purchaseRequests.unshift(pr);
    const payload = { purchaseRequest: pr };
    db.idempotencyKeys[idempotencyKey] = payload;
    logActivity(emp.id, 'PURCHASE_REQUEST', 'purchase_request', pr.id, `${pr.materialName} (${qty} ${pr.unit})`);
    saveDb();
    res.status(201).json(payload);
  });

  // Workflow B: Purchase Expense Submission (already bought; strictly separate from material receipt & reimbursement)
  app.post('/api/purchases/expenses', requireEmployeeAuth, (req: AuthedRequest, res) => {
    const emp = req.employee!;
    const db = getDb();
    const {
      siteId,
      supplierName,
      supplierContact,
      purchaseDate,
      items,
      gstPercent,
      paymentMethod,
      paidBy,
      reason,
      invoiceNumber,
      supplierGstin,
      billPhotoDataUrls,
      materialPhotoDataUrls,
      gpsLat,
      gpsLng,
      capturedAt,
      remarks,
      workTaskCode,
      idempotencyKey,
    } = req.body || {};

    if (!idempotencyKey) return res.status(400).json({ error: 'Missing idempotencyKey.' });
    if (db.idempotencyKeys[idempotencyKey]) return res.json(db.idempotencyKeys[idempotencyKey]);

    const site = db.sites.find((s) => s.id === siteId && emp.authorizedSiteIds.includes(s.id));
    if (!site) return res.status(403).json({ error: 'Invalid or unauthorized site.' });

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one purchased material line item is required.' });
    }

    let subtotalPaise = 0;
    const sanitizedItems: PurchaseExpenseItem[] = [];
    for (const raw of items) {
      const qty = Number(raw.quantity);
      const price = Number(raw.unitPrice);
      if (!raw.materialName || qty <= 0 || price < 0) {
        return res.status(400).json({ error: 'Each material item requires a valid name, quantity, and unit price.' });
      }
      const linePaise = Math.round(qty * toPaise(price));
      subtotalPaise += linePaise;
      sanitizedItems.push({
        id: `itm-${crypto.randomUUID().slice(0, 6)}`,
        materialCategory: String(raw.materialCategory || 'Consumables'),
        materialName: String(raw.materialName).trim(),
        quantity: qty,
        unit: String(raw.unit || 'nos'),
        unitPrice: price,
        lineTotal: fromPaise(linePaise),
      });
    }

    const gstRate = Number(gstPercent) || 0;
    const taxPaise = Math.round((subtotalPaise * gstRate) / 100);
    const totalPaise = subtotalPaise + taxPaise;
    const nowIso = new Date().toISOString();

    const expense: PurchaseExpense = {
      id: `pe-${crypto.randomUUID().slice(0, 8)}`,
      expenseReference: `EXP-2026-${Math.floor(810 + Math.random() * 189)}`,
      employeeId: emp.id,
      supplierName: String(supplierName || '').trim(),
      supplierContact: supplierContact ? String(supplierContact).trim() : undefined,
      purchaseDate: purchaseDate || nowIso.slice(0, 10),
      projectName: site.projectName,
      siteId: site.id,
      siteName: site.siteName,
      items: sanitizedItems,
      subtotal: fromPaise(subtotalPaise),
      gstPercent: gstRate,
      taxAmount: fromPaise(taxPaise),
      totalAmount: fromPaise(totalPaise),
      paymentMethod: paymentMethod || 'UPI',
      paidBy: paidBy || 'Employee Personal Funds',
      reason: String(reason || '').trim(),
      invoiceNumber: String(invoiceNumber || '').trim(),
      supplierGstin: supplierGstin ? String(supplierGstin).trim().toUpperCase() : undefined,
      billPhotoDataUrls: Array.isArray(billPhotoDataUrls) ? billPhotoDataUrls.slice(0, 3) : [],
      materialPhotoDataUrls: Array.isArray(materialPhotoDataUrls) ? materialPhotoDataUrls.slice(0, 6) : [],
      gpsLat: typeof gpsLat === 'number' ? gpsLat : undefined,
      gpsLng: typeof gpsLng === 'number' ? gpsLng : undefined,
      capturedAt: capturedAt || nowIso,
      submittedAt: nowIso,
      remarks: remarks ? String(remarks).trim() : undefined,
      workTaskCode: workTaskCode || undefined,
      status: 'Submitted',
      // Crucial business rule: uploading a bill NEVER marks material received or reimbursed
      receiptStatus: 'Material Receipt Pending',
      idempotencyKey,
    };

    db.purchaseExpenses.unshift(expense);
    const payload = { purchaseExpense: expense };
    db.idempotencyKeys[idempotencyKey] = payload;
    logActivity(
      emp.id,
      'PURCHASE_EXPENSE_SUBMIT',
      'purchase_expense',
      expense.id,
      `${expense.expenseReference} (₹${expense.totalAmount})`
    );
    saveDb();
    res.status(201).json(payload);
  });

  // Upload requested employee document
  app.post('/api/documents/:id/upload', requireEmployeeAuth, (req: AuthedRequest, res) => {
    const emp = req.employee!;
    const db = getDb();
    const doc = db.documents.find((d) => d.id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });
    if (doc.employeeId !== emp.id) return res.status(403).json({ error: 'Access denied.' });

    const { fileName } = req.body || {};
    doc.status = 'Uploaded';
    doc.fileName = fileName || 'uploaded-document.pdf';
    doc.uploadedAt = new Date().toISOString();
    logActivity(emp.id, 'DOCUMENT_UPLOAD', 'employee_document', doc.id, doc.fileName || doc.title);
    saveDb();
    res.json({ document: doc });
  });

  // Acknowledge safety notice
  app.post('/api/safety/notices/:id/acknowledge', requireEmployeeAuth, (req: AuthedRequest, res) => {
    const emp = req.employee!;
    const db = getDb();
    const notice = db.safetyNotices.find((s) => s.id === req.params.id && emp.authorizedSiteIds.includes(s.siteId));
    if (!notice) return res.status(404).json({ error: 'Safety notice not found.' });
    notice.acknowledged = true;
    notice.acknowledgedAt = new Date().toISOString();
    logActivity(emp.id, 'SAFETY_ACK', 'safety_notice', notice.id, notice.title);
    saveDb();
    res.json({ notice });
  });

  // Safety incident / unsafe condition reporting
  app.post('/api/safety/incidents', requireEmployeeAuth, (req: AuthedRequest, res) => {
    const emp = req.employee!;
    const db = getDb();
    const { incidentType, siteId, locationDetail, description, peopleInvolved, immediateActionTaken, photoDataUrls, idempotencyKey } =
      req.body || {};

    if (!idempotencyKey) return res.status(400).json({ error: 'Missing idempotencyKey.' });
    if (db.idempotencyKeys[idempotencyKey]) return res.json(db.idempotencyKeys[idempotencyKey]);

    const site = db.sites.find((s) => s.id === siteId && emp.authorizedSiteIds.includes(s.id));
    if (!site) return res.status(403).json({ error: 'Unauthorized site.' });

    const nowIso = new Date().toISOString();
    const isCritical = incidentType === 'Critical Incident' || incidentType === 'Minor Injury';
    const incident: SafetyIncident = {
      id: `inc-${crypto.randomUUID().slice(0, 8)}`,
      employeeId: emp.id,
      incidentType: incidentType || 'Unsafe Condition',
      siteId: site.id,
      siteName: site.siteName,
      locationDetail: String(locationDetail || '').trim(),
      occurredAt: nowIso,
      description: String(description || '').trim(),
      peopleInvolved: peopleInvolved ? String(peopleInvolved).trim() : undefined,
      immediateActionTaken: String(immediateActionTaken || '').trim(),
      photoDataUrls: Array.isArray(photoDataUrls) ? photoDataUrls.slice(0, 4) : [],
      criticalEscalated: isCritical,
      status: 'Submitted',
      idempotencyKey,
    };

    db.safetyIncidents.unshift(incident);
    if (isCritical) {
      db.notifications.unshift({
        id: `not-${crypto.randomUUID().slice(0, 8)}`,
        employeeId: emp.id,
        title: 'Critical Safety Report Escalated',
        message: `Immediate alert dispatched to Site Manager & Safety Officer for ${site.siteName}.`,
        category: 'Safety',
        timestamp: nowIso,
        read: false,
        projectSite: `${site.projectName} · ${site.siteName}`,
        targetRoute: '/safety',
      });
    }

    const payload = { incident };
    db.idempotencyKeys[idempotencyKey] = payload;
    logActivity(emp.id, 'SAFETY_INCIDENT', 'safety_incident', incident.id, incident.incidentType);
    saveDb();
    res.status(201).json(payload);
  });

  // Help desk support ticket creation
  app.post('/api/support/tickets', requireEmployeeAuth, (req: AuthedRequest, res) => {
    const emp = req.employee!;
    const db = getDb();
    const { category, description, attachmentNames, idempotencyKey } = req.body || {};

    if (!idempotencyKey) return res.status(400).json({ error: 'Missing idempotencyKey.' });
    if (db.idempotencyKeys[idempotencyKey]) return res.json(db.idempotencyKeys[idempotencyKey]);

    const deptMap: Record<string, string> = {
      'Attendance Correction Request': 'Site Supervisor & HR',
      'Salary Discrepancy': 'Payroll & Finance',
      'Missing Payslip': 'Payroll & Finance',
      'Leave Issue': 'HR Operations',
      'Work Assignment Issue': 'Site Engineering',
      'Purchase Reimbursement Issue': 'Procurement & Finance',
      'Safety Concern': 'HSE Safety Team',
      'Other Workplace Concern': 'Employee Relations',
    };

    const nowIso = new Date().toISOString();
    const ticket: SupportTicket = {
      id: `tkt-${crypto.randomUUID().slice(0, 8)}`,
      ticketNumber: `HLP-2026-${Math.floor(200 + Math.random() * 799)}`,
      employeeId: emp.id,
      category: category || 'Other Workplace Concern',
      description: String(description || '').trim(),
      attachmentNames: Array.isArray(attachmentNames) ? attachmentNames : [],
      submittedAt: nowIso,
      status: 'Submitted',
      assignedDepartment: deptMap[category] || 'Employee Relations',
      idempotencyKey,
    };

    db.supportTickets.unshift(ticket);
    const payload = { ticket };
    db.idempotencyKeys[idempotencyKey] = payload;
    logActivity(emp.id, 'SUPPORT_TICKET', 'support_ticket', ticket.id, ticket.ticketNumber);
    saveDb();
    res.status(201).json(payload);
  });

  // Notifications read state
  app.post('/api/notifications/:id/read', requireEmployeeAuth, (req: AuthedRequest, res) => {
    const emp = req.employee!;
    const db = getDb();
    if (req.params.id === 'all') {
      db.notifications.filter((n) => n.employeeId === emp.id).forEach((n) => (n.read = true));
      saveDb();
      return res.json({ ok: true });
    }
    const item = db.notifications.find((n) => n.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Notification not found.' });
    if (item.employeeId !== emp.id) return res.status(403).json({ error: 'Access denied.' });
    item.read = true;
    saveDb();
    res.json({ notification: item });
  });

  // Vite dev middleware or static dist serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BuildFlow Workforce server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
