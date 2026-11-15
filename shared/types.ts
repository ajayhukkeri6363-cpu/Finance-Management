export type UserRole = 'admin' | 'department_staff' | 'auditor' | 'citizen';

export type BudgetStatus = 'draft' | 'approved' | 'archived';
export type ProjectStatus = 'planned' | 'active' | 'delayed' | 'completed' | 'archived';
export type ExpenditureStatus = 'pending' | 'approved' | 'paid' | 'archived';
export type RevenueStatus = 'expected' | 'received' | 'archived';
export type ProcurementStatus = 'open' | 'evaluating' | 'awarded' | 'cancelled' | 'archived';

export type FlagSeverity = 'info' | 'warning' | 'attention';
export type FlagRuleCode =
  | 'BUDGET_NEARING_THRESHOLD'
  | 'BUDGET_EXCEEDED'
  | 'DUPLICATE_REFERENCE'
  | 'SHARP_EXPENSE_SPIKE'
  | 'DELAYED_PROJECT';

export interface UserRecord {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  departmentId: number | null;
  departmentName?: string | null;
  isActive: boolean;
  isDemo: boolean;
  createdAt: string;
}

export interface Department {
  id: number;
  code: string;
  name: string;
  description: string;
  isArchived: boolean;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: number;
  departmentId: number;
  departmentName?: string;
  fiscalYear: number;
  title: string;
  amount: number;
  currency: string;
  notes: string;
  status: BudgetStatus;
  isPublic: boolean;
  isDemo: boolean;
  createdBy: number | null;
  approvedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectAllocation {
  id: number;
  budgetId: number;
  projectId: number;
  amount: number;
  notes: string;
  isArchived: boolean;
  isDemo: boolean;
  createdBy: number | null;
  createdAt: string;
}

export interface Project {
  id: number;
  departmentId: number;
  departmentName?: string;
  fiscalYear: number;
  title: string;
  description: string;
  location: string;
  startDate: string;
  targetEndDate: string;
  status: ProjectStatus;
  progressPercent: number;
  isPublic: boolean;
  isArchived: boolean;
  isDemo: boolean;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  approvedAllocatedBudget?: number;
  recordedExpenditure?: number;
}

export interface Vendor {
  id: number;
  name: string;
  registrationCode: string;
  category: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  isArchived: boolean;
  isDemo: boolean;
  createdAt: string;
}

export interface Expenditure {
  id: number;
  projectId: number;
  projectTitle?: string;
  departmentId: number;
  departmentName?: string;
  vendorId: number | null;
  vendorName?: string | null;
  fiscalYear: number;
  amount: number;
  expenseDate: string;
  category: string;
  description: string;
  referenceNumber: string;
  status: ExpenditureStatus;
  isArchived: boolean;
  isDemo: boolean;
  createdBy: number | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Revenue {
  id: number;
  departmentId: number | null;
  departmentName?: string | null;
  fiscalYear: number;
  source: string;
  category: string;
  amount: number;
  receivedDate: string;
  notes: string;
  status: RevenueStatus;
  isPublic: boolean;
  isArchived: boolean;
  isDemo: boolean;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Procurement {
  id: number;
  departmentId: number;
  departmentName?: string;
  projectId: number | null;
  projectTitle?: string | null;
  vendorId: number | null;
  vendorName?: string | null;
  fiscalYear: number;
  title: string;
  referenceNumber: string;
  estimatedAmount: number;
  awardedAmount: number | null;
  status: ProcurementStatus;
  awardDate: string | null;
  notes: string;
  isArchived: boolean;
  isDemo: boolean;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: number;
  actorUserId: number | null;
  actorName: string;
  actorRole: string;
  departmentId: number | null;
  action: string;
  entityType: string;
  entityId: number | null;
  summary: string;
  detailsJson: string | null;
  createdAt: string;
}

export interface ReviewFlagRecord {
  id: string;
  ruleCode: FlagRuleCode;
  ruleTitle: string;
  severity: FlagSeverity;
  entityType: 'project' | 'expenditure';
  entityId: number;
  departmentId: number;
  departmentName: string;
  fiscalYear: number;
  explanation: string;
  metricSummary: string;
  requiresHumanReviewNotice: string;
  isReviewed: boolean;
  reviewedBy: number | null;
  reviewedByName: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
}

export interface DashboardSummary {
  fiscalYear: number | 'all';
  totalApprovedBudget: number;
  totalAllocatedToProjects: number;
  totalRecordedExpenditure: number;
  remainingApprovedBudget: number;
  totalRevenue: number;
  byDepartment: Array<{
    departmentId: number;
    departmentName: string;
    approvedBudget: number;
    allocatedToProjects: number;
    recordedExpenditure: number;
    remainingBudget: number;
    revenue: number;
  }>;
  expenditureByCategory: Array<{
    category: string;
    total: number;
  }>;
  revenueByCategory: Array<{
    category: string;
    total: number;
  }>;
  availableFiscalYears: number[];
}

export interface PublicProjectSummary {
  id: number;
  departmentName: string;
  fiscalYear: number;
  title: string;
  description: string;
  location: string;
  startDate: string;
  targetEndDate: string;
  status: ProjectStatus;
  progressPercent: number;
  approvedBudget: number;
  recordedExpenditure: number;
  isDemo: boolean;
}

export interface PublicBudgetSummary {
  id: number;
  departmentName: string;
  fiscalYear: number;
  title: string;
  amount: number;
  currency: string;
  allocatedAmount: number;
  recordedExpenditure: number;
  isDemo: boolean;
}
