export type EmploymentCategory =
  | 'Permanent Employee'
  | 'Contract Employee'
  | 'Daily-Wage Labourer'
  | 'Skilled Labourer'
  | 'Unskilled Labourer'
  | 'Hourly Worker'
  | 'Weekly-Wage Worker'
  | 'Piece-Rate Worker'
  | 'Temporary Worker'
  | 'Project-Based Worker'
  | 'Supervisor / Foreman';

export type PayModel = 'monthly_salaried' | 'daily_wage' | 'hourly' | 'piece_rate';

export interface ProjectSite {
  id: string;
  organizationId: string;
  projectId: string;
  projectName: string;
  siteName: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  geofenceRadiusMeters: number;
  geofenceEnabled: boolean;
  allowGeofenceException: boolean;
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  breakMinutes: number;
}

export interface EmployeeProfile {
  id: string;
  organizationId: string;
  organizationName: string;
  employeeCode: string;
  fullName: string;
  phone: string;
  email: string;
  avatarUrl: string;
  designation: string;
  department: string;
  employmentCategory: EmploymentCategory;
  payModel: PayModel;
  joiningDate: string;
  primaryProjectId: string;
  primaryProjectName: string;
  primarySiteId: string;
  primarySiteName: string;
  authorizedSiteIds: string[];
  reportingSupervisorName: string;
  reportingSupervisorPhone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  aadhaarMasked: string;
  bankAccountMasked: string;
  leaveEligible: boolean;
  advanceEligible: boolean;
  purchaseEligible: boolean;
  isSampleData: boolean;
}

export type AttendanceStatus =
  | 'not_checked_in'
  | 'checked_in'
  | 'checked_out'
  | 'unresolved_previous'
  | 'pending_offline_validation';

export interface GeofenceCheckResult {
  withinGeofence: boolean;
  distanceMeters: number;
  allowedRadiusMeters: number;
  geofenceEnabled: boolean;
  accuracyMeters: number;
  statusLabel: 'Verified Inside Site' | 'Outside Geofence' | 'Geofence Disabled' | 'Weak GPS Accuracy';
}

export interface LocationLog {
  id: string;
  sessionId: string;
  employeeId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
  syncedAt: string;
  withinGeofence: boolean;
  distanceMeters: number;
  isStale: boolean;
  source: 'live' | 'offline_queue';
}

export interface AttendanceSession {
  id: string;
  referenceId: string;
  organizationId: string;
  employeeId: string;
  siteId: string;
  siteName: string;
  projectName: string;
  shiftDate: string;
  shiftName: string;
  status: 'active' | 'completed' | 'unresolved' | 'pending_validation';
  approvalStatus: 'Pending Verification' | 'Approved' | 'Exception Pending' | 'Rejected';
  checkInTime: string;
  checkInSelfieDataUrl: string;
  checkInLat: number;
  checkInLng: number;
  checkInAccuracyMeters: number;
  checkInGeofence: GeofenceCheckResult;
  checkOutTime?: string;
  checkOutSelfieDataUrl?: string;
  checkOutLat?: number;
  checkOutLng?: number;
  checkOutAccuracyMeters?: number;
  checkOutGeofence?: GeofenceCheckResult;
  totalDurationMinutes?: number;
  payableMinutes?: number;
  breakMinutesApplied?: number;
  trackingActive: boolean;
  lastLocationUpdateAt?: string;
  idempotencyKey: string;
}

export interface AttendanceException {
  id: string;
  employeeId: string;
  siteId: string;
  siteName: string;
  reasonType: 'Outside Geofence' | 'Camera Unavailable' | 'GPS Unavailable' | 'Weak GPS' | 'Unresolved Session Recovery' | 'Network Offline';
  notes: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  requestedAt: string;
  status: 'Submitted' | 'Under Review' | 'Approved' | 'Rejected';
  reviewerRemarks?: string;
  idempotencyKey: string;
}

export type WorkStatus =
  | 'Assigned'
  | 'Acknowledged'
  | 'In Progress'
  | 'Submitted for Review'
  | 'Completed'
  | 'Rework Required'
  | 'On Hold';

export interface WorkProgressUpdate {
  id: string;
  workId: string;
  employeeId: string;
  updateType: 'status_change' | 'progress' | 'submission' | 'blocker' | 'clarification';
  completedQuantity?: number;
  notes: string;
  photoDataUrls: string[];
  createdAt: string;
  idempotencyKey: string;
}

export interface WorkAssignment {
  id: string;
  taskCode: string;
  employeeId: string;
  projectName: string;
  siteId: string;
  siteName: string;
  locationFloor: string;
  title: string;
  description: string;
  instructions: string[];
  safetyInstructions: string[];
  requiredEquipment: string[];
  supervisorName: string;
  supervisorPhone: string;
  priority: 'Urgent' | 'High' | 'Normal';
  startDate: string;
  dueDate: string;
  measurable: boolean;
  expectedQuantity?: number;
  completedQuantity?: number;
  approvedQuantity?: number;
  unit?: string;
  pieceRatePerUnit?: number;
  status: WorkStatus;
  referencePhotoUrl?: string;
  drawingTitle?: string;
  reworkReason?: string;
  updates: WorkProgressUpdate[];
}

export interface SalaryProfile {
  employeeId: string;
  payModel: PayModel;
  monthlyGross?: number;
  allowances?: number;
  dailyWageRate?: number;
  hourlyRate?: number;
  pieceRateUnit?: string;
  pieceRatePerUnit?: number;
  nextPayday?: string;
  currency: 'INR';
  isSampleData: boolean;
}

export interface PayrollBreakdownItem {
  label: string;
  amount: number;
  type: 'earning' | 'deduction';
}

export interface Payslip {
  id: string;
  employeeId: string;
  companyName: string;
  payrollPeriod: string;
  periodStart: string;
  periodEnd: string;
  attendanceDays: number;
  approvedOvertimeHours: number;
  approvedQuantity?: number;
  grossEarnings: number;
  allowances: number;
  overtimePay: number;
  totalDeductions: number;
  statutoryDeductions: number;
  netPay: number;
  paymentStatus: 'Processing' | 'Paid' | 'Failed' | 'Reversed' | 'On Hold';
  paymentDate?: string;
  paymentReference?: string;
  lineItems: PayrollBreakdownItem[];
  isSampleData: boolean;
}

export interface PaymentTransaction {
  id: string;
  employeeId: string;
  payslipId: string;
  periodLabel: string;
  paymentDate: string;
  amount: number;
  paymentMethod: 'Bank Transfer (NEFT/IMPS)' | 'UPI' | 'Cash Voucher';
  transactionReference: string;
  status: 'Processing' | 'Paid' | 'Failed' | 'Reversed' | 'On Hold';
  isSampleData: boolean;
}

export interface LeaveBalance {
  leaveTypeId: string;
  leaveTypeName: string;
  allocated: number;
  used: number;
  pending: number;
  available: number;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  durationType: 'Full Day' | 'First Half' | 'Second Half';
  workingDaysCount: number;
  reason: string;
  contactDuringLeave?: string;
  supportingDocName?: string;
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Cancelled';
  submittedAt: string;
  reviewerName?: string;
  reviewerRemarks?: string;
  idempotencyKey: string;
}

export interface AdvanceRepayment {
  id: string;
  installmentNumber: number;
  dueDate: string;
  payrollPeriod: string;
  amount: number;
  status: 'Scheduled' | 'Deducted' | 'Skipped';
}

export interface AdvanceRequest {
  id: string;
  employeeId: string;
  requestType: 'Salary Advance' | 'Wage Advance' | 'Emergency Medical Loan' | 'Festival Advance';
  requestedAmount: number;
  approvedAmount?: number;
  reason: string;
  repaymentMonths: number;
  status:
    | 'Submitted'
    | 'Under Review'
    | 'Approved'
    | 'Rejected'
    | 'Disbursement Pending'
    | 'Disbursed'
    | 'Partially Repaid'
    | 'Fully Repaid';
  submittedAt: string;
  repaidAmount: number;
  remainingBalance: number;
  reviewerRemarks?: string;
  repaymentSchedule: AdvanceRepayment[];
  idempotencyKey: string;
}

export type PurchaseRequestStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Supervisor Review'
  | 'Under Site Manager Review'
  | 'Under Procurement Review'
  | 'Approved'
  | 'Rejected';

export interface PurchaseRequest {
  id: string;
  requestCode: string;
  employeeId: string;
  projectName: string;
  siteId: string;
  siteName: string;
  materialCategory: string;
  materialName: string;
  requiredQuantity: number;
  unit: string;
  estimatedUnitPrice: number;
  estimatedTotal: number;
  priority: 'Urgent' | 'High' | 'Standard';
  requiredDeliveryDate: string;
  reason: string;
  workTaskCode?: string;
  photoDataUrl?: string;
  status: PurchaseRequestStatus;
  rejectionReason?: string;
  submittedAt: string;
  idempotencyKey: string;
}

export type PurchaseExpenseStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Supervisor Review'
  | 'Under Site Manager Review'
  | 'Under Procurement Review'
  | 'Under Finance Review'
  | 'Approved'
  | 'Rejected'
  | 'Reimbursement Pending'
  | 'Reimbursed';

export type MaterialReceiptStatus = 'Material Receipt Pending' | 'Material Received';

export interface PurchaseExpenseItem {
  id: string;
  materialCategory: string;
  materialName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}

export interface PurchaseExpense {
  id: string;
  expenseReference: string;
  employeeId: string;
  supplierName: string;
  supplierContact?: string;
  purchaseDate: string;
  projectName: string;
  siteId: string;
  siteName: string;
  items: PurchaseExpenseItem[];
  subtotal: number;
  gstPercent: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: 'Cash' | 'UPI' | 'Personal Card' | 'Company Imprest';
  paidBy: 'Employee Personal Funds' | 'Company Imprest Cash';
  reason: string;
  invoiceNumber: string;
  supplierGstin?: string;
  billPhotoDataUrls: string[];
  materialPhotoDataUrls: string[];
  gpsLat?: number;
  gpsLng?: number;
  capturedAt: string;
  submittedAt: string;
  remarks?: string;
  workTaskCode?: string;
  status: PurchaseExpenseStatus;
  receiptStatus: MaterialReceiptStatus;
  receiptVerifiedBy?: string;
  receiptVerifiedAt?: string;
  reimbursementReference?: string;
  rejectionReason?: string;
  idempotencyKey: string;
}

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  category:
    | 'Employee ID'
    | 'Employment Letter'
    | 'Appointment Letter'
    | 'Identity Documents'
    | 'Training Certificates'
    | 'Safety Certificates'
    | 'Salary Slips'
    | 'Attendance Records'
    | 'Other';
  title: string;
  documentNumber?: string;
  status: 'Requested' | 'Uploaded' | 'Under Review' | 'Verified' | 'Rejected' | 'Expired';
  issuedDate?: string;
  expiryDate?: string;
  uploadedAt?: string;
  fileName?: string;
  rejectionReason?: string;
  downloadAllowed: boolean;
}

export interface SafetyNotice {
  id: string;
  siteId: string;
  siteName: string;
  title: string;
  category: 'Safety Instruction' | 'Site Rule' | 'Required PPE' | 'Toolbox Talk' | 'Safety Notice';
  summary: string;
  requiredPpe: string[];
  acknowledged: boolean;
  acknowledgedAt?: string;
  publishedAt: string;
}

export interface SafetyIncident {
  id: string;
  employeeId: string;
  incidentType: 'Unsafe Condition' | 'Near Miss' | 'Minor Injury' | 'Equipment Hazard' | 'Critical Incident';
  siteId: string;
  siteName: string;
  locationDetail: string;
  occurredAt: string;
  description: string;
  peopleInvolved?: string;
  immediateActionTaken: string;
  photoDataUrls: string[];
  criticalEscalated: boolean;
  status: 'Submitted' | 'Acknowledged by Safety Officer' | 'Action In Progress' | 'Closed';
  idempotencyKey: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  employeeId: string;
  category:
    | 'Attendance Correction Request'
    | 'Salary Discrepancy'
    | 'Missing Payslip'
    | 'Leave Issue'
    | 'Work Assignment Issue'
    | 'Purchase Reimbursement Issue'
    | 'Safety Concern'
    | 'Other Workplace Concern';
  description: string;
  attachmentNames: string[];
  submittedAt: string;
  status: 'Submitted' | 'Assigned' | 'Under Review' | 'Waiting for Employee' | 'Resolved' | 'Closed';
  assignedDepartment: string;
  resolutionRemarks?: string;
  idempotencyKey: string;
}

export interface NotificationItem {
  id: string;
  employeeId: string;
  title: string;
  message: string;
  category: 'Attendance' | 'Work' | 'Salary' | 'Leave' | 'Advance' | 'Purchase' | 'Safety' | 'Supervisor';
  timestamp: string;
  read: boolean;
  projectSite: string;
  targetRoute: string;
}

export type SyncStatus =
  | 'Saved on Device'
  | 'Waiting to Sync'
  | 'Uploading'
  | 'Synced Successfully'
  | 'Sync Failed';

export interface OfflineQueueItem {
  id: string;
  employeeId: string;
  kind: 'attendance_exception' | 'pending_offline_checkin' | 'work_progress' | 'purchase_expense' | 'safety_incident' | 'location_ping';
  title: string;
  endpoint: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: string;
  status: SyncStatus;
  retryCount: number;
  lastError?: string;
}
