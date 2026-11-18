import type {
  AdvanceRequest,
  AttendanceException,
  AttendanceSession,
  EmployeeDocument,
  EmployeeProfile,
  LeaveBalance,
  LeaveRequest,
  LocationLog,
  NotificationItem,
  PaymentTransaction,
  Payslip,
  ProjectSite,
  PurchaseExpense,
  PurchaseRequest,
  SafetyIncident,
  SafetyNotice,
  SalaryProfile,
  SupportTicket,
  WorkAssignment,
} from '../types/buildflow';

export interface SampleWorkerSummary {
  employeeCode: string;
  fullName: string;
  designation: string;
  employmentCategory: string;
  payModel: string;
  primaryProjectName: string;
  primarySiteName: string;
  avatarUrl: string;
}

export interface BootstrapResponse {
  serverTime: string;
  employee: EmployeeProfile;
  authorizedSites: ProjectSite[];
  activeSession: AttendanceSession | null;
  unresolvedSession: AttendanceSession | null;
  recentAttendance: AttendanceSession[];
  attendanceExceptions: AttendanceException[];
  locationLogs: LocationLog[];
  workAssignments: WorkAssignment[];
  salaryProfile: SalaryProfile | null;
  payslips: Payslip[];
  paymentTransactions: PaymentTransaction[];
  leaveBalances: LeaveBalance[];
  leaveRequests: LeaveRequest[];
  advanceRequests: AdvanceRequest[];
  purchaseRequests: PurchaseRequest[];
  purchaseExpenses: PurchaseExpense[];
  documents: EmployeeDocument[];
  safetyNotices: SafetyNotice[];
  safetyIncidents: SafetyIncident[];
  supportTickets: SupportTicket[];
  notifications: NotificationItem[];
}

export class ApiError extends Error {
  status: number;
  code?: string;
  data?: Record<string, unknown>;

  constructor(message: string, status: number, code?: string, data?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    token?: string | null;
    body?: unknown;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers['x-session-token'] = options.token;
  }

  const res = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      payload?.error || `Request failed (${res.status})`,
      res.status,
      payload?.code,
      payload
    );
  }
  return payload as T;
}
