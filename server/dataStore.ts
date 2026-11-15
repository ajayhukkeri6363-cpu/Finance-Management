import mysql from 'mysql2/promise';
import {
  createFictionalSeedState,
  type DemoDatabaseState,
  type StoredUser,
} from './seedData.ts';
import {
  validateAllocationAmount,
  type SavedFlagReview,
} from '../shared/financeRules.ts';
import type {
  AuditLogEntry,
  Budget,
  BudgetStatus,
  Department,
  Expenditure,
  ExpenditureStatus,
  Procurement,
  ProcurementStatus,
  Project,
  ProjectAllocation,
  ProjectStatus,
  Revenue,
  RevenueStatus,
  UserRecord,
  UserRole,
  Vendor,
} from '../shared/types.ts';
import { ValidationError } from './auth.ts';

export type StoreMode = 'mysql' | 'local-demo';

export interface ComputeSnapshot {
  departments: Department[];
  budgets: Budget[];
  allocations: ProjectAllocation[];
  projects: Project[];
  expenditures: Expenditure[];
  revenues: Revenue[];
  flagReviews: SavedFlagReview[];
}

export interface IDataStore {
  readonly mode: StoreMode;
  countAdmins(): Promise<number>;
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserById(id: number): Promise<UserRecord | null>;
  listUsers(): Promise<UserRecord[]>;
  createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    departmentId: number | null;
    isActive?: boolean;
  }): Promise<UserRecord>;
  updateUser(
    id: number,
    input: {
      name?: string;
      role?: UserRole;
      departmentId?: number | null;
      isActive?: boolean;
    }
  ): Promise<UserRecord | null>;

  listDepartments(): Promise<Department[]>;
  getDepartmentById(id: number): Promise<Department | null>;
  createDepartment(input: {
    code: string;
    name: string;
    description: string;
  }): Promise<Department>;
  updateDepartment(
    id: number,
    input: { code?: string; name?: string; description?: string }
  ): Promise<Department | null>;
  archiveDepartment(id: number): Promise<Department | null>;

  listBudgets(): Promise<Budget[]>;
  getBudgetById(id: number): Promise<Budget | null>;
  createBudget(input: {
    departmentId: number;
    fiscalYear: number;
    title: string;
    amount: number;
    currency: string;
    notes: string;
    status: BudgetStatus;
    isPublic: boolean;
    createdBy: number;
  }): Promise<Budget>;
  updateBudget(
    id: number,
    input: {
      title?: string;
      amount?: number;
      currency?: string;
      notes?: string;
      fiscalYear?: number;
      isPublic?: boolean;
    }
  ): Promise<Budget | null>;
  setBudgetStatus(
    id: number,
    status: BudgetStatus,
    approvedBy: number | null
  ): Promise<Budget | null>;

  listAllocations(): Promise<ProjectAllocation[]>;
  getAllocationById(id: number): Promise<ProjectAllocation | null>;
  createAllocation(input: {
    budgetId: number;
    projectId: number;
    amount: number;
    notes: string;
    createdBy: number;
  }): Promise<ProjectAllocation>;
  archiveAllocation(id: number): Promise<ProjectAllocation | null>;

  listProjects(): Promise<Project[]>;
  getProjectById(id: number): Promise<Project | null>;
  createProject(input: {
    departmentId: number;
    fiscalYear: number;
    title: string;
    description: string;
    location: string;
    startDate: string;
    targetEndDate: string;
    status: ProjectStatus;
    progressPercent: number;
    isPublic: boolean;
    createdBy: number;
  }): Promise<Project>;
  updateProject(
    id: number,
    input: {
      title?: string;
      description?: string;
      location?: string;
      startDate?: string;
      targetEndDate?: string;
      status?: ProjectStatus;
      progressPercent?: number;
      isPublic?: boolean;
    }
  ): Promise<Project | null>;
  archiveProject(id: number): Promise<Project | null>;

  listVendors(): Promise<Vendor[]>;
  getVendorById(id: number): Promise<Vendor | null>;
  createVendor(input: {
    name: string;
    registrationCode: string;
    category: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
  }): Promise<Vendor>;
  updateVendor(
    id: number,
    input: {
      name?: string;
      category?: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
    }
  ): Promise<Vendor | null>;
  archiveVendor(id: number): Promise<Vendor | null>;

  listExpenditures(): Promise<Expenditure[]>;
  getExpenditureById(id: number): Promise<Expenditure | null>;
  createExpenditure(input: {
    projectId: number;
    departmentId: number;
    vendorId: number | null;
    fiscalYear: number;
    amount: number;
    expenseDate: string;
    category: string;
    description: string;
    referenceNumber: string;
    status: ExpenditureStatus;
    createdBy: number;
  }): Promise<Expenditure>;
  updateExpenditure(
    id: number,
    input: {
      vendorId?: number | null;
      amount?: number;
      expenseDate?: string;
      category?: string;
      description?: string;
      referenceNumber?: string;
      status?: ExpenditureStatus;
    }
  ): Promise<Expenditure | null>;
  archiveExpenditure(id: number): Promise<Expenditure | null>;

  listRevenues(): Promise<Revenue[]>;
  getRevenueById(id: number): Promise<Revenue | null>;
  createRevenue(input: {
    departmentId: number | null;
    fiscalYear: number;
    source: string;
    category: string;
    amount: number;
    receivedDate: string;
    notes: string;
    status: RevenueStatus;
    isPublic: boolean;
    createdBy: number;
  }): Promise<Revenue>;
  updateRevenue(
    id: number,
    input: {
      departmentId?: number | null;
      fiscalYear?: number;
      source?: string;
      category?: string;
      amount?: number;
      receivedDate?: string;
      notes?: string;
      status?: RevenueStatus;
      isPublic?: boolean;
    }
  ): Promise<Revenue | null>;
  archiveRevenue(id: number): Promise<Revenue | null>;

  listProcurements(): Promise<Procurement[]>;
  getProcurementById(id: number): Promise<Procurement | null>;
  createProcurement(input: {
    departmentId: number;
    projectId: number | null;
    vendorId: number | null;
    fiscalYear: number;
    title: string;
    referenceNumber: string;
    estimatedAmount: number;
    notes: string;
    createdBy: number;
  }): Promise<Procurement>;
  updateProcurement(
    id: number,
    input: {
      projectId?: number | null;
      vendorId?: number | null;
      title?: string;
      estimatedAmount?: number;
      status?: ProcurementStatus;
      notes?: string;
    }
  ): Promise<Procurement | null>;
  awardProcurement(
    id: number,
    input: { vendorId: number; awardedAmount: number; awardDate: string }
  ): Promise<Procurement | null>;
  archiveProcurement(id: number): Promise<Procurement | null>;

  listAuditLogs(): Promise<AuditLogEntry[]>;
  appendAuditLog(input: {
    actorUserId: number | null;
    actorName: string;
    actorRole: string;
    departmentId: number | null;
    action: string;
    entityType: string;
    entityId: number | null;
    summary: string;
    details?: Record<string, unknown>;
  }): Promise<AuditLogEntry>;

  saveFlagReview(input: {
    flagId: string;
    reviewedBy: number;
    reviewedByName: string;
    reviewNote: string;
  }): Promise<SavedFlagReview>;

  getComputeSnapshot(): Promise<ComputeSnapshot>;
}

function sanitizeUser(u: StoredUser, departments: Department[]): UserRecord {
  const dept = u.departmentId
    ? departments.find((d) => d.id === u.departmentId)
    : undefined;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    departmentId: u.departmentId,
    departmentName: dept ? dept.name : null,
    isActive: u.isActive,
    isDemo: u.isDemo,
    createdAt: u.createdAt,
  };
}

export class DemoDataStore implements IDataStore {
  readonly mode: StoreMode = 'local-demo';
  private state: DemoDatabaseState;

  constructor() {
    this.state = createFictionalSeedState();
  }

  private nextId(list: Array<{ id: number }>): number {
    return list.length === 0 ? 1 : Math.max(...list.map((i) => i.id)) + 1;
  }

  async countAdmins(): Promise<number> {
    return this.state.users.filter((u) => u.role === 'admin' && u.isActive).length;
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const norm = email.trim().toLowerCase();
    return this.state.users.find((u) => u.email.toLowerCase() === norm) ?? null;
  }

  async findUserById(id: number): Promise<UserRecord | null> {
    const u = this.state.users.find((x) => x.id === id);
    return u ? sanitizeUser(u, this.state.departments) : null;
  }

  async listUsers(): Promise<UserRecord[]> {
    return this.state.users.map((u) => sanitizeUser(u, this.state.departments));
  }

  async createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    departmentId: number | null;
    isActive?: boolean;
  }): Promise<UserRecord> {
    const normEmail = input.email.trim().toLowerCase();
    if (this.state.users.some((u) => u.email.toLowerCase() === normEmail)) {
      throw new ValidationError('An account with this email already exists.');
    }
    const created: StoredUser = {
      id: this.nextId(this.state.users),
      name: input.name,
      email: normEmail,
      passwordHash: input.passwordHash,
      role: input.role,
      departmentId: input.departmentId,
      isActive: input.isActive ?? true,
      isDemo: true,
      createdAt: new Date().toISOString(),
    };
    this.state.users.push(created);
    return sanitizeUser(created, this.state.departments);
  }

  async updateUser(
    id: number,
    input: {
      name?: string;
      role?: UserRole;
      departmentId?: number | null;
      isActive?: boolean;
    }
  ): Promise<UserRecord | null> {
    const u = this.state.users.find((x) => x.id === id);
    if (!u) return null;
    if (input.name !== undefined) u.name = input.name;
    if (input.role !== undefined) u.role = input.role;
    if (input.departmentId !== undefined) u.departmentId = input.departmentId;
    if (input.isActive !== undefined) u.isActive = input.isActive;
    return sanitizeUser(u, this.state.departments);
  }

  async listDepartments(): Promise<Department[]> {
    return [...this.state.departments];
  }

  async getDepartmentById(id: number): Promise<Department | null> {
    return this.state.departments.find((d) => d.id === id) ?? null;
  }

  async createDepartment(input: {
    code: string;
    name: string;
    description: string;
  }): Promise<Department> {
    const normCode = input.code.trim().toUpperCase();
    if (this.state.departments.some((d) => d.code.toUpperCase() === normCode)) {
      throw new ValidationError(`Department code "${normCode}" already exists.`);
    }
    const now = new Date().toISOString();
    const dept: Department = {
      id: this.nextId(this.state.departments),
      code: normCode,
      name: input.name,
      description: input.description,
      isArchived: false,
      isDemo: true,
      createdAt: now,
      updatedAt: now,
    };
    this.state.departments.push(dept);
    return dept;
  }

  async updateDepartment(
    id: number,
    input: { code?: string; name?: string; description?: string }
  ): Promise<Department | null> {
    const dept = this.state.departments.find((d) => d.id === id);
    if (!dept) return null;
    if (input.code !== undefined) {
      const normCode = input.code.trim().toUpperCase();
      if (
        this.state.departments.some(
          (d) => d.id !== id && d.code.toUpperCase() === normCode
        )
      ) {
        throw new ValidationError(`Department code "${normCode}" already exists.`);
      }
      dept.code = normCode;
    }
    if (input.name !== undefined) dept.name = input.name;
    if (input.description !== undefined) dept.description = input.description;
    dept.updatedAt = new Date().toISOString();
    return dept;
  }

  async archiveDepartment(id: number): Promise<Department | null> {
    const dept = this.state.departments.find((d) => d.id === id);
    if (!dept) return null;
    dept.isArchived = true;
    dept.updatedAt = new Date().toISOString();
    return dept;
  }

  private enrichBudget(b: Budget): Budget {
    const dept = this.state.departments.find((d) => d.id === b.departmentId);
    return { ...b, departmentName: dept?.name ?? 'Unknown' };
  }

  async listBudgets(): Promise<Budget[]> {
    return this.state.budgets.map((b) => this.enrichBudget(b));
  }

  async getBudgetById(id: number): Promise<Budget | null> {
    const b = this.state.budgets.find((x) => x.id === id);
    return b ? this.enrichBudget(b) : null;
  }

  async createBudget(input: {
    departmentId: number;
    fiscalYear: number;
    title: string;
    amount: number;
    currency: string;
    notes: string;
    status: BudgetStatus;
    isPublic: boolean;
    createdBy: number;
  }): Promise<Budget> {
    const now = new Date().toISOString();
    const created: Budget = {
      id: this.nextId(this.state.budgets),
      departmentId: input.departmentId,
      fiscalYear: input.fiscalYear,
      title: input.title,
      amount: input.amount,
      currency: input.currency.toUpperCase(),
      notes: input.notes,
      status: input.status,
      isPublic: input.isPublic,
      isDemo: true,
      createdBy: input.createdBy,
      approvedBy: input.status === 'approved' ? input.createdBy : null,
      createdAt: now,
      updatedAt: now,
    };
    this.state.budgets.push(created);
    return this.enrichBudget(created);
  }

  async updateBudget(
    id: number,
    input: {
      title?: string;
      amount?: number;
      currency?: string;
      notes?: string;
      fiscalYear?: number;
      isPublic?: boolean;
    }
  ): Promise<Budget | null> {
    const b = this.state.budgets.find((x) => x.id === id);
    if (!b) return null;
    if (input.title !== undefined) b.title = input.title;
    if (input.amount !== undefined) b.amount = input.amount;
    if (input.currency !== undefined) b.currency = input.currency.toUpperCase();
    if (input.notes !== undefined) b.notes = input.notes;
    if (input.fiscalYear !== undefined) b.fiscalYear = input.fiscalYear;
    if (input.isPublic !== undefined) b.isPublic = input.isPublic;
    b.updatedAt = new Date().toISOString();
    return this.enrichBudget(b);
  }

  async setBudgetStatus(
    id: number,
    status: BudgetStatus,
    approvedBy: number | null
  ): Promise<Budget | null> {
    const b = this.state.budgets.find((x) => x.id === id);
    if (!b) return null;
    b.status = status;
    if (status === 'approved') {
      b.approvedBy = approvedBy;
    }
    b.updatedAt = new Date().toISOString();
    return this.enrichBudget(b);
  }

  async listAllocations(): Promise<ProjectAllocation[]> {
    return [...this.state.allocations];
  }

  async getAllocationById(id: number): Promise<ProjectAllocation | null> {
    return this.state.allocations.find((a) => a.id === id) ?? null;
  }

  async createAllocation(input: {
    budgetId: number;
    projectId: number;
    amount: number;
    notes: string;
    createdBy: number;
  }): Promise<ProjectAllocation> {
    const budget = this.state.budgets.find((b) => b.id === input.budgetId);
    if (!budget) throw new ValidationError('Budget not found.');
    const project = this.state.projects.find((p) => p.id === input.projectId);
    if (!project || project.isArchived) throw new ValidationError('Active project not found.');
    if (budget.departmentId !== project.departmentId) {
      throw new ValidationError(
        'Budget and target project must belong to the same department.'
      );
    }

    const existingForBudget = this.state.allocations.filter(
      (a) => a.budgetId === input.budgetId
    );
    const check = validateAllocationAmount({
      budget,
      existingAllocationsForBudget: existingForBudget,
      requestedAmount: input.amount,
    });
    if (!check.valid) {
      throw new ValidationError(check.reason || 'Invalid allocation amount.');
    }

    const created: ProjectAllocation = {
      id: this.nextId(this.state.allocations),
      budgetId: input.budgetId,
      projectId: input.projectId,
      amount: input.amount,
      notes: input.notes,
      isArchived: false,
      isDemo: true,
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
    };
    this.state.allocations.push(created);
    return created;
  }

  async archiveAllocation(id: number): Promise<ProjectAllocation | null> {
    const a = this.state.allocations.find((x) => x.id === id);
    if (!a) return null;
    a.isArchived = true;
    return a;
  }

  private enrichProject(p: Project): Project {
    const dept = this.state.departments.find((d) => d.id === p.departmentId);
    return { ...p, departmentName: dept?.name ?? 'Unknown' };
  }

  async listProjects(): Promise<Project[]> {
    return this.state.projects.map((p) => this.enrichProject(p));
  }

  async getProjectById(id: number): Promise<Project | null> {
    const p = this.state.projects.find((x) => x.id === id);
    return p ? this.enrichProject(p) : null;
  }

  async createProject(input: {
    departmentId: number;
    fiscalYear: number;
    title: string;
    description: string;
    location: string;
    startDate: string;
    targetEndDate: string;
    status: ProjectStatus;
    progressPercent: number;
    isPublic: boolean;
    createdBy: number;
  }): Promise<Project> {
    const now = new Date().toISOString();
    const created: Project = {
      id: this.nextId(this.state.projects),
      departmentId: input.departmentId,
      fiscalYear: input.fiscalYear,
      title: input.title,
      description: input.description,
      location: input.location,
      startDate: input.startDate,
      targetEndDate: input.targetEndDate,
      status: input.status,
      progressPercent: input.progressPercent,
      isPublic: input.isPublic,
      isArchived: false,
      isDemo: true,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    this.state.projects.push(created);
    return this.enrichProject(created);
  }

  async updateProject(
    id: number,
    input: {
      title?: string;
      description?: string;
      location?: string;
      startDate?: string;
      targetEndDate?: string;
      status?: ProjectStatus;
      progressPercent?: number;
      isPublic?: boolean;
    }
  ): Promise<Project | null> {
    const p = this.state.projects.find((x) => x.id === id);
    if (!p) return null;
    if (input.title !== undefined) p.title = input.title;
    if (input.description !== undefined) p.description = input.description;
    if (input.location !== undefined) p.location = input.location;
    if (input.startDate !== undefined) p.startDate = input.startDate;
    if (input.targetEndDate !== undefined) p.targetEndDate = input.targetEndDate;
    if (input.status !== undefined) p.status = input.status;
    if (input.progressPercent !== undefined) p.progressPercent = input.progressPercent;
    if (input.isPublic !== undefined) p.isPublic = input.isPublic;
    p.updatedAt = new Date().toISOString();
    return this.enrichProject(p);
  }

  async archiveProject(id: number): Promise<Project | null> {
    const p = this.state.projects.find((x) => x.id === id);
    if (!p) return null;
    p.isArchived = true;
    p.status = 'archived';
    p.isPublic = false;
    p.updatedAt = new Date().toISOString();
    return this.enrichProject(p);
  }

  async listVendors(): Promise<Vendor[]> {
    return [...this.state.vendors];
  }

  async getVendorById(id: number): Promise<Vendor | null> {
    return this.state.vendors.find((v) => v.id === id) ?? null;
  }

  async createVendor(input: {
    name: string;
    registrationCode: string;
    category: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
  }): Promise<Vendor> {
    const code = input.registrationCode.trim().toUpperCase();
    if (this.state.vendors.some((v) => v.registrationCode.toUpperCase() === code)) {
      throw new ValidationError(`Vendor registration code "${code}" already exists.`);
    }
    const created: Vendor = {
      id: this.nextId(this.state.vendors),
      name: input.name,
      registrationCode: code,
      category: input.category,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      isArchived: false,
      isDemo: true,
      createdAt: new Date().toISOString(),
    };
    this.state.vendors.push(created);
    return created;
  }

  async updateVendor(
    id: number,
    input: {
      name?: string;
      category?: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
    }
  ): Promise<Vendor | null> {
    const v = this.state.vendors.find((x) => x.id === id);
    if (!v) return null;
    if (input.name !== undefined) v.name = input.name;
    if (input.category !== undefined) v.category = input.category;
    if (input.contactName !== undefined) v.contactName = input.contactName;
    if (input.contactEmail !== undefined) v.contactEmail = input.contactEmail;
    if (input.contactPhone !== undefined) v.contactPhone = input.contactPhone;
    return v;
  }

  async archiveVendor(id: number): Promise<Vendor | null> {
    const v = this.state.vendors.find((x) => x.id === id);
    if (!v) return null;
    v.isArchived = true;
    return v;
  }

  private enrichExpenditure(e: Expenditure): Expenditure {
    const project = this.state.projects.find((p) => p.id === e.projectId);
    const dept = this.state.departments.find((d) => d.id === e.departmentId);
    const vendor = e.vendorId
      ? this.state.vendors.find((v) => v.id === e.vendorId)
      : undefined;
    const creator = e.createdBy
      ? this.state.users.find((u) => u.id === e.createdBy)
      : undefined;
    return {
      ...e,
      projectTitle: project?.title ?? 'Unknown Project',
      departmentName: dept?.name ?? 'Unknown Department',
      vendorName: vendor?.name ?? null,
      createdByName: creator?.name ?? null,
    };
  }

  async listExpenditures(): Promise<Expenditure[]> {
    return this.state.expenditures.map((e) => this.enrichExpenditure(e));
  }

  async getExpenditureById(id: number): Promise<Expenditure | null> {
    const e = this.state.expenditures.find((x) => x.id === id);
    return e ? this.enrichExpenditure(e) : null;
  }

  async createExpenditure(input: {
    projectId: number;
    departmentId: number;
    vendorId: number | null;
    fiscalYear: number;
    amount: number;
    expenseDate: string;
    category: string;
    description: string;
    referenceNumber: string;
    status: ExpenditureStatus;
    createdBy: number;
  }): Promise<Expenditure> {
    const now = new Date().toISOString();
    const created: Expenditure = {
      id: this.nextId(this.state.expenditures),
      projectId: input.projectId,
      departmentId: input.departmentId,
      vendorId: input.vendorId,
      fiscalYear: input.fiscalYear,
      amount: input.amount,
      expenseDate: input.expenseDate,
      category: input.category,
      description: input.description,
      referenceNumber: input.referenceNumber,
      status: input.status,
      isArchived: false,
      isDemo: true,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    this.state.expenditures.push(created);
    return this.enrichExpenditure(created);
  }

  async updateExpenditure(
    id: number,
    input: {
      vendorId?: number | null;
      amount?: number;
      expenseDate?: string;
      category?: string;
      description?: string;
      referenceNumber?: string;
      status?: ExpenditureStatus;
    }
  ): Promise<Expenditure | null> {
    const e = this.state.expenditures.find((x) => x.id === id);
    if (!e) return null;
    if (input.vendorId !== undefined) e.vendorId = input.vendorId;
    if (input.amount !== undefined) e.amount = input.amount;
    if (input.expenseDate !== undefined) e.expenseDate = input.expenseDate;
    if (input.category !== undefined) e.category = input.category;
    if (input.description !== undefined) e.description = input.description;
    if (input.referenceNumber !== undefined) e.referenceNumber = input.referenceNumber;
    if (input.status !== undefined) e.status = input.status;
    e.updatedAt = new Date().toISOString();
    return this.enrichExpenditure(e);
  }

  async archiveExpenditure(id: number): Promise<Expenditure | null> {
    const e = this.state.expenditures.find((x) => x.id === id);
    if (!e) return null;
    e.isArchived = true;
    e.status = 'archived';
    e.updatedAt = new Date().toISOString();
    return this.enrichExpenditure(e);
  }

  private enrichRevenue(r: Revenue): Revenue {
    const dept = r.departmentId
      ? this.state.departments.find((d) => d.id === r.departmentId)
      : undefined;
    return { ...r, departmentName: dept?.name ?? 'General Fund' };
  }

  async listRevenues(): Promise<Revenue[]> {
    return this.state.revenues.map((r) => this.enrichRevenue(r));
  }

  async getRevenueById(id: number): Promise<Revenue | null> {
    const r = this.state.revenues.find((x) => x.id === id);
    return r ? this.enrichRevenue(r) : null;
  }

  async createRevenue(input: {
    departmentId: number | null;
    fiscalYear: number;
    source: string;
    category: string;
    amount: number;
    receivedDate: string;
    notes: string;
    status: RevenueStatus;
    isPublic: boolean;
    createdBy: number;
  }): Promise<Revenue> {
    const now = new Date().toISOString();
    const created: Revenue = {
      id: this.nextId(this.state.revenues),
      departmentId: input.departmentId,
      fiscalYear: input.fiscalYear,
      source: input.source,
      category: input.category,
      amount: input.amount,
      receivedDate: input.receivedDate,
      notes: input.notes,
      status: input.status,
      isPublic: input.isPublic,
      isArchived: false,
      isDemo: true,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    this.state.revenues.push(created);
    return this.enrichRevenue(created);
  }

  async updateRevenue(
    id: number,
    input: {
      departmentId?: number | null;
      fiscalYear?: number;
      source?: string;
      category?: string;
      amount?: number;
      receivedDate?: string;
      notes?: string;
      status?: RevenueStatus;
      isPublic?: boolean;
    }
  ): Promise<Revenue | null> {
    const r = this.state.revenues.find((x) => x.id === id);
    if (!r) return null;
    if (input.departmentId !== undefined) r.departmentId = input.departmentId;
    if (input.fiscalYear !== undefined) r.fiscalYear = input.fiscalYear;
    if (input.source !== undefined) r.source = input.source;
    if (input.category !== undefined) r.category = input.category;
    if (input.amount !== undefined) r.amount = input.amount;
    if (input.receivedDate !== undefined) r.receivedDate = input.receivedDate;
    if (input.notes !== undefined) r.notes = input.notes;
    if (input.status !== undefined) r.status = input.status;
    if (input.isPublic !== undefined) r.isPublic = input.isPublic;
    r.updatedAt = new Date().toISOString();
    return this.enrichRevenue(r);
  }

  async archiveRevenue(id: number): Promise<Revenue | null> {
    const r = this.state.revenues.find((x) => x.id === id);
    if (!r) return null;
    r.isArchived = true;
    r.status = 'archived';
    r.isPublic = false;
    r.updatedAt = new Date().toISOString();
    return this.enrichRevenue(r);
  }

  private enrichProcurement(p: Procurement): Procurement {
    const dept = this.state.departments.find((d) => d.id === p.departmentId);
    const project = p.projectId
      ? this.state.projects.find((x) => x.id === p.projectId)
      : undefined;
    const vendor = p.vendorId
      ? this.state.vendors.find((v) => v.id === p.vendorId)
      : undefined;
    return {
      ...p,
      departmentName: dept?.name ?? 'Unknown',
      projectTitle: project?.title ?? null,
      vendorName: vendor?.name ?? null,
    };
  }

  async listProcurements(): Promise<Procurement[]> {
    return this.state.procurements.map((p) => this.enrichProcurement(p));
  }

  async getProcurementById(id: number): Promise<Procurement | null> {
    const p = this.state.procurements.find((x) => x.id === id);
    return p ? this.enrichProcurement(p) : null;
  }

  async createProcurement(input: {
    departmentId: number;
    projectId: number | null;
    vendorId: number | null;
    fiscalYear: number;
    title: string;
    referenceNumber: string;
    estimatedAmount: number;
    notes: string;
    createdBy: number;
  }): Promise<Procurement> {
    const ref = input.referenceNumber.trim().toUpperCase();
    if (
      this.state.procurements.some((p) => p.referenceNumber.toUpperCase() === ref)
    ) {
      throw new ValidationError(`Procurement reference "${ref}" already exists.`);
    }
    const now = new Date().toISOString();
    const created: Procurement = {
      id: this.nextId(this.state.procurements),
      departmentId: input.departmentId,
      projectId: input.projectId,
      vendorId: input.vendorId,
      fiscalYear: input.fiscalYear,
      title: input.title,
      referenceNumber: ref,
      estimatedAmount: input.estimatedAmount,
      awardedAmount: null,
      status: 'open',
      awardDate: null,
      notes: input.notes,
      isArchived: false,
      isDemo: true,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    this.state.procurements.push(created);
    return this.enrichProcurement(created);
  }

  async updateProcurement(
    id: number,
    input: {
      projectId?: number | null;
      vendorId?: number | null;
      title?: string;
      estimatedAmount?: number;
      status?: ProcurementStatus;
      notes?: string;
    }
  ): Promise<Procurement | null> {
    const p = this.state.procurements.find((x) => x.id === id);
    if (!p) return null;
    if (input.projectId !== undefined) p.projectId = input.projectId;
    if (input.vendorId !== undefined) p.vendorId = input.vendorId;
    if (input.title !== undefined) p.title = input.title;
    if (input.estimatedAmount !== undefined) p.estimatedAmount = input.estimatedAmount;
    if (input.status !== undefined) p.status = input.status;
    if (input.notes !== undefined) p.notes = input.notes;
    p.updatedAt = new Date().toISOString();
    return this.enrichProcurement(p);
  }

  async awardProcurement(
    id: number,
    input: { vendorId: number; awardedAmount: number; awardDate: string }
  ): Promise<Procurement | null> {
    const p = this.state.procurements.find((x) => x.id === id);
    if (!p) return null;
    if (p.isArchived || p.status === 'archived' || p.status === 'cancelled') {
      throw new ValidationError('Archived or cancelled procurements cannot be awarded.');
    }
    p.vendorId = input.vendorId;
    p.awardedAmount = input.awardedAmount;
    p.awardDate = input.awardDate;
    p.status = 'awarded';
    p.updatedAt = new Date().toISOString();
    // Explicitly does NOT create any expenditure record
    return this.enrichProcurement(p);
  }

  async archiveProcurement(id: number): Promise<Procurement | null> {
    const p = this.state.procurements.find((x) => x.id === id);
    if (!p) return null;
    p.isArchived = true;
    p.status = 'archived';
    p.updatedAt = new Date().toISOString();
    return this.enrichProcurement(p);
  }

  async listAuditLogs(): Promise<AuditLogEntry[]> {
    return [...this.state.auditLogs].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }

  async appendAuditLog(input: {
    actorUserId: number | null;
    actorName: string;
    actorRole: string;
    departmentId: number | null;
    action: string;
    entityType: string;
    entityId: number | null;
    summary: string;
    details?: Record<string, unknown>;
  }): Promise<AuditLogEntry> {
    const entry: AuditLogEntry = {
      id: this.nextId(this.state.auditLogs),
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      departmentId: input.departmentId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      detailsJson: input.details ? JSON.stringify(input.details) : null,
      createdAt: new Date().toISOString(),
    };
    this.state.auditLogs.push(entry);
    return entry;
  }

  async saveFlagReview(input: {
    flagId: string;
    reviewedBy: number;
    reviewedByName: string;
    reviewNote: string;
  }): Promise<SavedFlagReview> {
    const saved: SavedFlagReview = {
      flagId: input.flagId,
      reviewedBy: input.reviewedBy,
      reviewedByName: input.reviewedByName,
      reviewNote: input.reviewNote,
      reviewedAt: new Date().toISOString(),
    };
    const idx = this.state.flagReviews.findIndex((r) => r.flagId === input.flagId);
    if (idx >= 0) {
      this.state.flagReviews[idx] = saved;
    } else {
      this.state.flagReviews.push(saved);
    }
    return saved;
  }

  async getComputeSnapshot(): Promise<ComputeSnapshot> {
    return {
      departments: await this.listDepartments(),
      budgets: await this.listBudgets(),
      allocations: await this.listAllocations(),
      projects: await this.listProjects(),
      expenditures: await this.listExpenditures(),
      revenues: await this.listRevenues(),
      flagReviews: [...this.state.flagReviews],
    };
  }
}

function isoDateStr(val: unknown): string {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const str = String(val);
  return str.slice(0, 10);
}

function isoTsStr(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

export class MySqlDataStore implements IDataStore {
  readonly mode: StoreMode = 'mysql';
  private pool: mysql.Pool;

  constructor() {
    const rawPort = process.env.MYSQL_PORT?.trim();
    const port = rawPort ? Number(rawPort) : 3306;
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid MYSQL_PORT value: "${rawPort}". Expected an integer port between 1 and 65535.`);
    }

    this.pool = mysql.createPool({
      host: process.env.MYSQL_HOST?.trim(),
      port,
      user: process.env.MYSQL_USER?.trim(),
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE?.trim(),
      waitForConnections: true,
      connectionLimit: 10,
      connectTimeout: 4000,
      decimalNumbers: true,
      ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    });
  }

  async verifyConnection(): Promise<void> {
    await this.pool.query('SELECT 1');
    const [tables] = await this.pool.query<mysql.RowDataPacket[]>(
      `SHOW TABLES LIKE 'users'`
    );
    if (tables.length === 0) {
      throw new Error(
        'MySQL database is reachable, but GovTrack AI schema tables are missing. Run "npm run db:migrate" first.'
      );
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async countAdmins(): Promise<number> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin' AND is_active = 1`
    );
    return Number(rows[0]?.cnt || 0);
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT u.*, d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE LOWER(u.email) = LOWER(?) LIMIT 1`,
      [email.trim()]
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: Number(r.id),
      name: String(r.name),
      email: String(r.email),
      passwordHash: String(r.password_hash),
      role: r.role as UserRole,
      departmentId: r.department_id !== null ? Number(r.department_id) : null,
      departmentName: r.department_name ? String(r.department_name) : null,
      isActive: Boolean(r.is_active),
      isDemo: Boolean(r.is_demo),
      createdAt: isoTsStr(r.created_at),
    };
  }

  async findUserById(id: number): Promise<UserRecord | null> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT u.id, u.name, u.email, u.role, u.department_id, u.is_active, u.is_demo, u.created_at,
              d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.id = ? LIMIT 1`,
      [id]
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: Number(r.id),
      name: String(r.name),
      email: String(r.email),
      role: r.role as UserRole,
      departmentId: r.department_id !== null ? Number(r.department_id) : null,
      departmentName: r.department_name ? String(r.department_name) : null,
      isActive: Boolean(r.is_active),
      isDemo: Boolean(r.is_demo),
      createdAt: isoTsStr(r.created_at),
    };
  }

  async listUsers(): Promise<UserRecord[]> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT u.id, u.name, u.email, u.role, u.department_id, u.is_active, u.is_demo, u.created_at,
              d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       ORDER BY u.id ASC`
    );
    return rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      email: String(r.email),
      role: r.role as UserRole,
      departmentId: r.department_id !== null ? Number(r.department_id) : null,
      departmentName: r.department_name ? String(r.department_name) : null,
      isActive: Boolean(r.is_active),
      isDemo: Boolean(r.is_demo),
      createdAt: isoTsStr(r.created_at),
    }));
  }

  async createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    departmentId: number | null;
    isActive?: boolean;
  }): Promise<UserRecord> {
    const existing = await this.findUserByEmail(input.email);
    if (existing) {
      throw new ValidationError('An account with this email already exists.');
    }
    const [res] = await this.pool.query<mysql.ResultSetHeader>(
      `INSERT INTO users (name, email, password_hash, role, department_id, is_active, is_demo)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [
        input.name,
        input.email.trim().toLowerCase(),
        input.passwordHash,
        input.role,
        input.departmentId,
        input.isActive ?? true ? 1 : 0,
      ]
    );
    const created = await this.findUserById(res.insertId);
    if (!created) throw new Error('User creation failed');
    return created;
  }

  async updateUser(
    id: number,
    input: {
      name?: string;
      role?: UserRole;
      departmentId?: number | null;
      isActive?: boolean;
    }
  ): Promise<UserRecord | null> {
    const current = await this.findUserById(id);
    if (!current) return null;
    await this.pool.query(
      `UPDATE users SET name = ?, role = ?, department_id = ?, is_active = ? WHERE id = ?`,
      [
        input.name ?? current.name,
        input.role ?? current.role,
        input.departmentId !== undefined ? input.departmentId : current.departmentId,
        (input.isActive !== undefined ? input.isActive : current.isActive) ? 1 : 0,
        id,
      ]
    );
    return this.findUserById(id);
  }

  async listDepartments(): Promise<Department[]> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT * FROM departments ORDER BY id ASC`
    );
    return rows.map((r) => ({
      id: Number(r.id),
      code: String(r.code),
      name: String(r.name),
      description: String(r.description),
      isArchived: Boolean(r.is_archived),
      isDemo: Boolean(r.is_demo),
      createdAt: isoTsStr(r.created_at),
      updatedAt: isoTsStr(r.updated_at),
    }));
  }

  async getDepartmentById(id: number): Promise<Department | null> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT * FROM departments WHERE id = ? LIMIT 1`,
      [id]
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: Number(r.id),
      code: String(r.code),
      name: String(r.name),
      description: String(r.description),
      isArchived: Boolean(r.is_archived),
      isDemo: Boolean(r.is_demo),
      createdAt: isoTsStr(r.created_at),
      updatedAt: isoTsStr(r.updated_at),
    };
  }

  async createDepartment(input: {
    code: string;
    name: string;
    description: string;
  }): Promise<Department> {
    const normCode = input.code.trim().toUpperCase();
    const [res] = await this.pool.query<mysql.ResultSetHeader>(
      `INSERT INTO departments (code, name, description, is_archived, is_demo)
       VALUES (?, ?, ?, 0, 0)`,
      [normCode, input.name, input.description]
    );
    const dept = await this.getDepartmentById(res.insertId);
    if (!dept) throw new Error('Department creation failed');
    return dept;
  }

  async updateDepartment(
    id: number,
    input: { code?: string; name?: string; description?: string }
  ): Promise<Department | null> {
    const cur = await this.getDepartmentById(id);
    if (!cur) return null;
    await this.pool.query(
      `UPDATE departments SET code = ?, name = ?, description = ? WHERE id = ?`,
      [
        input.code ? input.code.trim().toUpperCase() : cur.code,
        input.name ?? cur.name,
        input.description ?? cur.description,
        id,
      ]
    );
    return this.getDepartmentById(id);
  }

  async archiveDepartment(id: number): Promise<Department | null> {
    await this.pool.query(`UPDATE departments SET is_archived = 1 WHERE id = ?`, [id]);
    return this.getDepartmentById(id);
  }

  async listBudgets(): Promise<Budget[]> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT b.*, d.name AS department_name
       FROM budgets b
       JOIN departments d ON d.id = b.department_id
       ORDER BY b.fiscal_year DESC, b.id DESC`
    );
    return rows.map((r) => ({
      id: Number(r.id),
      departmentId: Number(r.department_id),
      departmentName: String(r.department_name),
      fiscalYear: Number(r.fiscal_year),
      title: String(r.title),
      amount: Number(r.amount),
      currency: String(r.currency),
      notes: String(r.notes),
      status: r.status as BudgetStatus,
      isPublic: Boolean(r.is_public),
      isDemo: Boolean(r.is_demo),
      createdBy: r.created_by !== null ? Number(r.created_by) : null,
      approvedBy: r.approved_by !== null ? Number(r.approved_by) : null,
      createdAt: isoTsStr(r.created_at),
      updatedAt: isoTsStr(r.updated_at),
    }));
  }

  async getBudgetById(id: number): Promise<Budget | null> {
    const list = await this.listBudgets();
    return list.find((b) => b.id === id) ?? null;
  }

  async createBudget(input: {
    departmentId: number;
    fiscalYear: number;
    title: string;
    amount: number;
    currency: string;
    notes: string;
    status: BudgetStatus;
    isPublic: boolean;
    createdBy: number;
  }): Promise<Budget> {
    const [res] = await this.pool.query<mysql.ResultSetHeader>(
      `INSERT INTO budgets (department_id, fiscal_year, title, amount, currency, notes, status, is_public, is_demo, created_by, approved_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        input.departmentId,
        input.fiscalYear,
        input.title,
        input.amount,
        input.currency.toUpperCase(),
        input.notes,
        input.status,
        input.isPublic ? 1 : 0,
        input.createdBy,
        input.status === 'approved' ? input.createdBy : null,
      ]
    );
    const created = await this.getBudgetById(res.insertId);
    if (!created) throw new Error('Budget creation failed');
    return created;
  }

  async updateBudget(
    id: number,
    input: {
      title?: string;
      amount?: number;
      currency?: string;
      notes?: string;
      fiscalYear?: number;
      isPublic?: boolean;
    }
  ): Promise<Budget | null> {
    const cur = await this.getBudgetById(id);
    if (!cur) return null;
    await this.pool.query(
      `UPDATE budgets SET title = ?, amount = ?, currency = ?, notes = ?, fiscal_year = ?, is_public = ? WHERE id = ?`,
      [
        input.title ?? cur.title,
        input.amount ?? cur.amount,
        (input.currency ?? cur.currency).toUpperCase(),
        input.notes ?? cur.notes,
        input.fiscalYear ?? cur.fiscalYear,
        (input.isPublic !== undefined ? input.isPublic : cur.isPublic) ? 1 : 0,
        id,
      ]
    );
    return this.getBudgetById(id);
  }

  async setBudgetStatus(
    id: number,
    status: BudgetStatus,
    approvedBy: number | null
  ): Promise<Budget | null> {
    const cur = await this.getBudgetById(id);
    if (!cur) return null;
    await this.pool.query(
      `UPDATE budgets SET status = ?, approved_by = ? WHERE id = ?`,
      [status, status === 'approved' ? approvedBy : cur.approvedBy, id]
    );
    return this.getBudgetById(id);
  }

  async listAllocations(): Promise<ProjectAllocation[]> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT * FROM project_allocations ORDER BY id DESC`
    );
    return rows.map((r) => ({
      id: Number(r.id),
      budgetId: Number(r.budget_id),
      projectId: Number(r.project_id),
      amount: Number(r.amount),
      notes: String(r.notes),
      isArchived: Boolean(r.is_archived),
      isDemo: Boolean(r.is_demo),
      createdBy: r.created_by !== null ? Number(r.created_by) : null,
      createdAt: isoTsStr(r.created_at),
    }));
  }

  async getAllocationById(id: number): Promise<ProjectAllocation | null> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT * FROM project_allocations WHERE id = ? LIMIT 1`,
      [id]
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: Number(r.id),
      budgetId: Number(r.budget_id),
      projectId: Number(r.project_id),
      amount: Number(r.amount),
      notes: String(r.notes),
      isArchived: Boolean(r.is_archived),
      isDemo: Boolean(r.is_demo),
      createdBy: r.created_by !== null ? Number(r.created_by) : null,
      createdAt: isoTsStr(r.created_at),
    };
  }

  async createAllocation(input: {
    budgetId: number;
    projectId: number;
    amount: number;
    notes: string;
    createdBy: number;
  }): Promise<ProjectAllocation> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const [budgetRows] = await conn.query<mysql.RowDataPacket[]>(
        `SELECT * FROM budgets WHERE id = ? FOR UPDATE`,
        [input.budgetId]
      );
      const bRow = budgetRows[0];
      if (!bRow) throw new ValidationError('Budget not found.');

      const [projectRows] = await conn.query<mysql.RowDataPacket[]>(
        `SELECT * FROM projects WHERE id = ? LIMIT 1`,
        [input.projectId]
      );
      const pRow = projectRows[0];
      if (!pRow || Boolean(pRow.is_archived)) {
        throw new ValidationError('Active project not found.');
      }
      if (Number(bRow.department_id) !== Number(pRow.department_id)) {
        throw new ValidationError('Budget and project must belong to the same department.');
      }

      const [allocRows] = await conn.query<mysql.RowDataPacket[]>(
        `SELECT * FROM project_allocations WHERE budget_id = ? FOR UPDATE`,
        [input.budgetId]
      );
      const existingAllocs: ProjectAllocation[] = allocRows.map((r) => ({
        id: Number(r.id),
        budgetId: Number(r.budget_id),
        projectId: Number(r.project_id),
        amount: Number(r.amount),
        notes: String(r.notes),
        isArchived: Boolean(r.is_archived),
        isDemo: Boolean(r.is_demo),
        createdBy: r.created_by !== null ? Number(r.created_by) : null,
        createdAt: isoTsStr(r.created_at),
      }));

      const budgetObj: Budget = {
        id: Number(bRow.id),
        departmentId: Number(bRow.department_id),
        fiscalYear: Number(bRow.fiscal_year),
        title: String(bRow.title),
        amount: Number(bRow.amount),
        currency: String(bRow.currency),
        notes: String(bRow.notes),
        status: bRow.status as BudgetStatus,
        isPublic: Boolean(bRow.is_public),
        isDemo: Boolean(bRow.is_demo),
        createdBy: bRow.created_by !== null ? Number(bRow.created_by) : null,
        approvedBy: bRow.approved_by !== null ? Number(bRow.approved_by) : null,
        createdAt: isoTsStr(bRow.created_at),
        updatedAt: isoTsStr(bRow.updated_at),
      };

      const check = validateAllocationAmount({
        budget: budgetObj,
        existingAllocationsForBudget: existingAllocs,
        requestedAmount: input.amount,
      });
      if (!check.valid) {
        throw new ValidationError(check.reason || 'Invalid allocation amount.');
      }

      const [res] = await conn.query<mysql.ResultSetHeader>(
        `INSERT INTO project_allocations (budget_id, project_id, amount, notes, is_archived, is_demo, created_by)
         VALUES (?, ?, ?, ?, 0, 0, ?)`,
        [input.budgetId, input.projectId, input.amount, input.notes, input.createdBy]
      );
      await conn.commit();
      const created = await this.getAllocationById(res.insertId);
      if (!created) throw new Error('Allocation creation failed');
      return created;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async archiveAllocation(id: number): Promise<ProjectAllocation | null> {
    await this.pool.query(`UPDATE project_allocations SET is_archived = 1 WHERE id = ?`, [id]);
    return this.getAllocationById(id);
  }

  async listProjects(): Promise<Project[]> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT p.*, d.name AS department_name
       FROM projects p
       JOIN departments d ON d.id = p.department_id
       ORDER BY p.fiscal_year DESC, p.id DESC`
    );
    return rows.map((r) => ({
      id: Number(r.id),
      departmentId: Number(r.department_id),
      departmentName: String(r.department_name),
      fiscalYear: Number(r.fiscal_year),
      title: String(r.title),
      description: String(r.description),
      location: String(r.location),
      startDate: isoDateStr(r.start_date),
      targetEndDate: isoDateStr(r.target_end_date),
      status: r.status as ProjectStatus,
      progressPercent: Number(r.progress_percent),
      isPublic: Boolean(r.is_public),
      isArchived: Boolean(r.is_archived),
      isDemo: Boolean(r.is_demo),
      createdBy: r.created_by !== null ? Number(r.created_by) : null,
      createdAt: isoTsStr(r.created_at),
      updatedAt: isoTsStr(r.updated_at),
    }));
  }

  async getProjectById(id: number): Promise<Project | null> {
    const list = await this.listProjects();
    return list.find((p) => p.id === id) ?? null;
  }

  async createProject(input: {
    departmentId: number;
    fiscalYear: number;
    title: string;
    description: string;
    location: string;
    startDate: string;
    targetEndDate: string;
    status: ProjectStatus;
    progressPercent: number;
    isPublic: boolean;
    createdBy: number;
  }): Promise<Project> {
    const [res] = await this.pool.query<mysql.ResultSetHeader>(
      `INSERT INTO projects (department_id, fiscal_year, title, description, location, start_date, target_end_date, status, progress_percent, is_public, is_archived, is_demo, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
      [
        input.departmentId,
        input.fiscalYear,
        input.title,
        input.description,
        input.location,
        input.startDate,
        input.targetEndDate,
        input.status,
        input.progressPercent,
        input.isPublic ? 1 : 0,
        input.createdBy,
      ]
    );
    const created = await this.getProjectById(res.insertId);
    if (!created) throw new Error('Project creation failed');
    return created;
  }

  async updateProject(
    id: number,
    input: {
      title?: string;
      description?: string;
      location?: string;
      startDate?: string;
      targetEndDate?: string;
      status?: ProjectStatus;
      progressPercent?: number;
      isPublic?: boolean;
    }
  ): Promise<Project | null> {
    const cur = await this.getProjectById(id);
    if (!cur) return null;
    await this.pool.query(
      `UPDATE projects
       SET title = ?, description = ?, location = ?, start_date = ?, target_end_date = ?, status = ?, progress_percent = ?, is_public = ?
       WHERE id = ?`,
      [
        input.title ?? cur.title,
        input.description ?? cur.description,
        input.location ?? cur.location,
        input.startDate ?? cur.startDate,
        input.targetEndDate ?? cur.targetEndDate,
        input.status ?? cur.status,
        input.progressPercent ?? cur.progressPercent,
        (input.isPublic !== undefined ? input.isPublic : cur.isPublic) ? 1 : 0,
        id,
      ]
    );
    return this.getProjectById(id);
  }

  async archiveProject(id: number): Promise<Project | null> {
    await this.pool.query(
      `UPDATE projects SET is_archived = 1, status = 'archived', is_public = 0 WHERE id = ?`,
      [id]
    );
    return this.getProjectById(id);
  }

  async listVendors(): Promise<Vendor[]> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT * FROM vendors ORDER BY id ASC`
    );
    return rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      registrationCode: String(r.registration_code),
      category: String(r.category),
      contactName: String(r.contact_name),
      contactEmail: String(r.contact_email),
      contactPhone: String(r.contact_phone),
      isArchived: Boolean(r.is_archived),
      isDemo: Boolean(r.is_demo),
      createdAt: isoTsStr(r.created_at),
    }));
  }

  async getVendorById(id: number): Promise<Vendor | null> {
    const list = await this.listVendors();
    return list.find((v) => v.id === id) ?? null;
  }

  async createVendor(input: {
    name: string;
    registrationCode: string;
    category: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
  }): Promise<Vendor> {
    const [res] = await this.pool.query<mysql.ResultSetHeader>(
      `INSERT INTO vendors (name, registration_code, category, contact_name, contact_email, contact_phone, is_archived, is_demo)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0)`,
      [
        input.name,
        input.registrationCode.trim().toUpperCase(),
        input.category,
        input.contactName,
        input.contactEmail,
        input.contactPhone,
      ]
    );
    const created = await this.getVendorById(res.insertId);
    if (!created) throw new Error('Vendor creation failed');
    return created;
  }

  async updateVendor(
    id: number,
    input: {
      name?: string;
      category?: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
    }
  ): Promise<Vendor | null> {
    const cur = await this.getVendorById(id);
    if (!cur) return null;
    await this.pool.query(
      `UPDATE vendors SET name = ?, category = ?, contact_name = ?, contact_email = ?, contact_phone = ? WHERE id = ?`,
      [
        input.name ?? cur.name,
        input.category ?? cur.category,
        input.contactName ?? cur.contactName,
        input.contactEmail ?? cur.contactEmail,
        input.contactPhone ?? cur.contactPhone,
        id,
      ]
    );
    return this.getVendorById(id);
  }

  async archiveVendor(id: number): Promise<Vendor | null> {
    await this.pool.query(`UPDATE vendors SET is_archived = 1 WHERE id = ?`, [id]);
    return this.getVendorById(id);
  }

  async listExpenditures(): Promise<Expenditure[]> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT e.*, p.title AS project_title, d.name AS department_name,
              v.name AS vendor_name, u.name AS created_by_name
       FROM expenditures e
       JOIN projects p ON p.id = e.project_id
       JOIN departments d ON d.id = e.department_id
       LEFT JOIN vendors v ON v.id = e.vendor_id
       LEFT JOIN users u ON u.id = e.created_by
       ORDER BY e.expense_date DESC, e.id DESC`
    );
    return rows.map((r) => ({
      id: Number(r.id),
      projectId: Number(r.project_id),
      projectTitle: String(r.project_title),
      departmentId: Number(r.department_id),
      departmentName: String(r.department_name),
      vendorId: r.vendor_id !== null ? Number(r.vendor_id) : null,
      vendorName: r.vendor_name ? String(r.vendor_name) : null,
      fiscalYear: Number(r.fiscal_year),
      amount: Number(r.amount),
      expenseDate: isoDateStr(r.expense_date),
      category: String(r.category),
      description: String(r.description),
      referenceNumber: String(r.reference_number),
      status: r.status as ExpenditureStatus,
      isArchived: Boolean(r.is_archived),
      isDemo: Boolean(r.is_demo),
      createdBy: r.created_by !== null ? Number(r.created_by) : null,
      createdByName: r.created_by_name ? String(r.created_by_name) : null,
      createdAt: isoTsStr(r.created_at),
      updatedAt: isoTsStr(r.updated_at),
    }));
  }

  async getExpenditureById(id: number): Promise<Expenditure | null> {
    const list = await this.listExpenditures();
    return list.find((e) => e.id === id) ?? null;
  }

  async createExpenditure(input: {
    projectId: number;
    departmentId: number;
    vendorId: number | null;
    fiscalYear: number;
    amount: number;
    expenseDate: string;
    category: string;
    description: string;
    referenceNumber: string;
    status: ExpenditureStatus;
    createdBy: number;
  }): Promise<Expenditure> {
    const [res] = await this.pool.query<mysql.ResultSetHeader>(
      `INSERT INTO expenditures (project_id, department_id, vendor_id, fiscal_year, amount, expense_date, category, description, reference_number, status, is_archived, is_demo, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
      [
        input.projectId,
        input.departmentId,
        input.vendorId,
        input.fiscalYear,
        input.amount,
        input.expenseDate,
        input.category,
        input.description,
        input.referenceNumber,
        input.status,
        input.createdBy,
      ]
    );
    const created = await this.getExpenditureById(res.insertId);
    if (!created) throw new Error('Expenditure creation failed');
    return created;
  }

  async updateExpenditure(
    id: number,
    input: {
      vendorId?: number | null;
      amount?: number;
      expenseDate?: string;
      category?: string;
      description?: string;
      referenceNumber?: string;
      status?: ExpenditureStatus;
    }
  ): Promise<Expenditure | null> {
    const cur = await this.getExpenditureById(id);
    if (!cur) return null;
    await this.pool.query(
      `UPDATE expenditures
       SET vendor_id = ?, amount = ?, expense_date = ?, category = ?, description = ?, reference_number = ?, status = ?
       WHERE id = ?`,
      [
        input.vendorId !== undefined ? input.vendorId : cur.vendorId,
        input.amount ?? cur.amount,
        input.expenseDate ?? cur.expenseDate,
        input.category ?? cur.category,
        input.description ?? cur.description,
        input.referenceNumber ?? cur.referenceNumber,
        input.status ?? cur.status,
        id,
      ]
    );
    return this.getExpenditureById(id);
  }

  async archiveExpenditure(id: number): Promise<Expenditure | null> {
    await this.pool.query(
      `UPDATE expenditures SET is_archived = 1, status = 'archived' WHERE id = ?`,
      [id]
    );
    return this.getExpenditureById(id);
  }

  async listRevenues(): Promise<Revenue[]> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT r.*, d.name AS department_name
       FROM revenues r
       LEFT JOIN departments d ON d.id = r.department_id
       ORDER BY r.received_date DESC, r.id DESC`
    );
    return rows.map((r) => ({
      id: Number(r.id),
      departmentId: r.department_id !== null ? Number(r.department_id) : null,
      departmentName: r.department_name ? String(r.department_name) : 'General Fund',
      fiscalYear: Number(r.fiscal_year),
      source: String(r.source),
      category: String(r.category),
      amount: Number(r.amount),
      receivedDate: isoDateStr(r.received_date),
      notes: String(r.notes),
      status: r.status as RevenueStatus,
      isPublic: Boolean(r.is_public),
      isArchived: Boolean(r.is_archived),
      isDemo: Boolean(r.is_demo),
      createdBy: r.created_by !== null ? Number(r.created_by) : null,
      createdAt: isoTsStr(r.created_at),
      updatedAt: isoTsStr(r.updated_at),
    }));
  }

  async getRevenueById(id: number): Promise<Revenue | null> {
    const list = await this.listRevenues();
    return list.find((r) => r.id === id) ?? null;
  }

  async createRevenue(input: {
    departmentId: number | null;
    fiscalYear: number;
    source: string;
    category: string;
    amount: number;
    receivedDate: string;
    notes: string;
    status: RevenueStatus;
    isPublic: boolean;
    createdBy: number;
  }): Promise<Revenue> {
    const [res] = await this.pool.query<mysql.ResultSetHeader>(
      `INSERT INTO revenues (department_id, fiscal_year, source, category, amount, received_date, notes, status, is_public, is_archived, is_demo, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
      [
        input.departmentId,
        input.fiscalYear,
        input.source,
        input.category,
        input.amount,
        input.receivedDate,
        input.notes,
        input.status,
        input.isPublic ? 1 : 0,
        input.createdBy,
      ]
    );
    const created = await this.getRevenueById(res.insertId);
    if (!created) throw new Error('Revenue creation failed');
    return created;
  }

  async updateRevenue(
    id: number,
    input: {
      departmentId?: number | null;
      fiscalYear?: number;
      source?: string;
      category?: string;
      amount?: number;
      receivedDate?: string;
      notes?: string;
      status?: RevenueStatus;
      isPublic?: boolean;
    }
  ): Promise<Revenue | null> {
    const cur = await this.getRevenueById(id);
    if (!cur) return null;
    await this.pool.query(
      `UPDATE revenues
       SET department_id = ?, fiscal_year = ?, source = ?, category = ?, amount = ?, received_date = ?, notes = ?, status = ?, is_public = ?
       WHERE id = ?`,
      [
        input.departmentId !== undefined ? input.departmentId : cur.departmentId,
        input.fiscalYear ?? cur.fiscalYear,
        input.source ?? cur.source,
        input.category ?? cur.category,
        input.amount ?? cur.amount,
        input.receivedDate ?? cur.receivedDate,
        input.notes ?? cur.notes,
        input.status ?? cur.status,
        (input.isPublic !== undefined ? input.isPublic : cur.isPublic) ? 1 : 0,
        id,
      ]
    );
    return this.getRevenueById(id);
  }

  async archiveRevenue(id: number): Promise<Revenue | null> {
    await this.pool.query(
      `UPDATE revenues SET is_archived = 1, status = 'archived', is_public = 0 WHERE id = ?`,
      [id]
    );
    return this.getRevenueById(id);
  }

  async listProcurements(): Promise<Procurement[]> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT pr.*, d.name AS department_name, p.title AS project_title, v.name AS vendor_name
       FROM procurements pr
       JOIN departments d ON d.id = pr.department_id
       LEFT JOIN projects p ON p.id = pr.project_id
       LEFT JOIN vendors v ON v.id = pr.vendor_id
       ORDER BY pr.fiscal_year DESC, pr.id DESC`
    );
    return rows.map((r) => ({
      id: Number(r.id),
      departmentId: Number(r.department_id),
      departmentName: String(r.department_name),
      projectId: r.project_id !== null ? Number(r.project_id) : null,
      projectTitle: r.project_title ? String(r.project_title) : null,
      vendorId: r.vendor_id !== null ? Number(r.vendor_id) : null,
      vendorName: r.vendor_name ? String(r.vendor_name) : null,
      fiscalYear: Number(r.fiscal_year),
      title: String(r.title),
      referenceNumber: String(r.reference_number),
      estimatedAmount: Number(r.estimated_amount),
      awardedAmount: r.awarded_amount !== null ? Number(r.awarded_amount) : null,
      status: r.status as ProcurementStatus,
      awardDate: r.award_date ? isoDateStr(r.award_date) : null,
      notes: String(r.notes),
      isArchived: Boolean(r.is_archived),
      isDemo: Boolean(r.is_demo),
      createdBy: r.created_by !== null ? Number(r.created_by) : null,
      createdAt: isoTsStr(r.created_at),
      updatedAt: isoTsStr(r.updated_at),
    }));
  }

  async getProcurementById(id: number): Promise<Procurement | null> {
    const list = await this.listProcurements();
    return list.find((p) => p.id === id) ?? null;
  }

  async createProcurement(input: {
    departmentId: number;
    projectId: number | null;
    vendorId: number | null;
    fiscalYear: number;
    title: string;
    referenceNumber: string;
    estimatedAmount: number;
    notes: string;
    createdBy: number;
  }): Promise<Procurement> {
    const [res] = await this.pool.query<mysql.ResultSetHeader>(
      `INSERT INTO procurements (department_id, project_id, vendor_id, fiscal_year, title, reference_number, estimated_amount, status, notes, is_archived, is_demo, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, 0, 0, ?)`,
      [
        input.departmentId,
        input.projectId,
        input.vendorId,
        input.fiscalYear,
        input.title,
        input.referenceNumber.trim().toUpperCase(),
        input.estimatedAmount,
        input.notes,
        input.createdBy,
      ]
    );
    const created = await this.getProcurementById(res.insertId);
    if (!created) throw new Error('Procurement creation failed');
    return created;
  }

  async updateProcurement(
    id: number,
    input: {
      projectId?: number | null;
      vendorId?: number | null;
      title?: string;
      estimatedAmount?: number;
      status?: ProcurementStatus;
      notes?: string;
    }
  ): Promise<Procurement | null> {
    const cur = await this.getProcurementById(id);
    if (!cur) return null;
    await this.pool.query(
      `UPDATE procurements
       SET project_id = ?, vendor_id = ?, title = ?, estimated_amount = ?, status = ?, notes = ?
       WHERE id = ?`,
      [
        input.projectId !== undefined ? input.projectId : cur.projectId,
        input.vendorId !== undefined ? input.vendorId : cur.vendorId,
        input.title ?? cur.title,
        input.estimatedAmount ?? cur.estimatedAmount,
        input.status ?? cur.status,
        input.notes ?? cur.notes,
        id,
      ]
    );
    return this.getProcurementById(id);
  }

  async awardProcurement(
    id: number,
    input: { vendorId: number; awardedAmount: number; awardDate: string }
  ): Promise<Procurement | null> {
    const cur = await this.getProcurementById(id);
    if (!cur) return null;
    if (cur.isArchived || cur.status === 'archived' || cur.status === 'cancelled') {
      throw new ValidationError('Archived or cancelled procurements cannot be awarded.');
    }
    await this.pool.query(
      `UPDATE procurements SET vendor_id = ?, awarded_amount = ?, award_date = ?, status = 'awarded' WHERE id = ?`,
      [input.vendorId, input.awardedAmount, input.awardDate, id]
    );
    return this.getProcurementById(id);
  }

  async archiveProcurement(id: number): Promise<Procurement | null> {
    await this.pool.query(
      `UPDATE procurements SET is_archived = 1, status = 'archived' WHERE id = ?`,
      [id]
    );
    return this.getProcurementById(id);
  }

  async listAuditLogs(): Promise<AuditLogEntry[]> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      `SELECT * FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT 500`
    );
    return rows.map((r) => ({
      id: Number(r.id),
      actorUserId: r.actor_user_id !== null ? Number(r.actor_user_id) : null,
      actorName: String(r.actor_name),
      actorRole: String(r.actor_role),
      departmentId: r.department_id !== null ? Number(r.department_id) : null,
      action: String(r.action),
      entityType: String(r.entity_type),
      entityId: r.entity_id !== null ? Number(r.entity_id) : null,
      summary: String(r.summary),
      detailsJson: r.details_json ? JSON.stringify(r.details_json) : null,
      createdAt: isoTsStr(r.created_at),
    }));
  }

  async appendAuditLog(input: {
    actorUserId: number | null;
    actorName: string;
    actorRole: string;
    departmentId: number | null;
    action: string;
    entityType: string;
    entityId: number | null;
    summary: string;
    details?: Record<string, unknown>;
  }): Promise<AuditLogEntry> {
    const [res] = await this.pool.query<mysql.ResultSetHeader>(
      `INSERT INTO audit_logs (actor_user_id, actor_name, actor_role, department_id, action, entity_type, entity_id, summary, details_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.actorUserId,
        input.actorName,
        input.actorRole,
        input.departmentId,
        input.action,
        input.entityType,
        input.entityId,
        input.summary,
        input.details ? JSON.stringify(input.details) : null,
      ]
    );
    return {
      id: res.insertId,
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      departmentId: input.departmentId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      detailsJson: input.details ? JSON.stringify(input.details) : null,
      createdAt: new Date().toISOString(),
    };
  }

  async saveFlagReview(input: {
    flagId: string;
    reviewedBy: number;
    reviewedByName: string;
    reviewNote: string;
  }): Promise<SavedFlagReview> {
    const now = new Date();
    await this.pool.query(
      `INSERT INTO review_flag_reviews (flag_id, reviewed_by, reviewed_by_name, review_note, reviewed_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         reviewed_by = VALUES(reviewed_by),
         reviewed_by_name = VALUES(reviewed_by_name),
         review_note = VALUES(review_note),
         reviewed_at = VALUES(reviewed_at)`,
      [input.flagId, input.reviewedBy, input.reviewedByName, input.reviewNote, now]
    );
    return {
      flagId: input.flagId,
      reviewedBy: input.reviewedBy,
      reviewedByName: input.reviewedByName,
      reviewNote: input.reviewNote,
      reviewedAt: now.toISOString(),
    };
  }

  async getComputeSnapshot(): Promise<ComputeSnapshot> {
    const [
      departments,
      budgets,
      allocations,
      projects,
      expenditures,
      revenues,
      flagReviewRows,
    ] = await Promise.all([
      this.listDepartments(),
      this.listBudgets(),
      this.listAllocations(),
      this.listProjects(),
      this.listExpenditures(),
      this.listRevenues(),
      this.pool.query<mysql.RowDataPacket[]>(
        `SELECT * FROM review_flag_reviews`
      ),
    ]);

    const flagReviews: SavedFlagReview[] = flagReviewRows[0].map((r) => ({
      flagId: String(r.flag_id),
      reviewedBy: Number(r.reviewed_by),
      reviewedByName: String(r.reviewed_by_name),
      reviewNote: String(r.review_note),
      reviewedAt: isoTsStr(r.reviewed_at),
    }));

    return {
      departments,
      budgets,
      allocations,
      projects,
      expenditures,
      revenues,
      flagReviews,
    };
  }
}

export function isMysqlConfigured(): boolean {
  const host = process.env.MYSQL_HOST?.trim();
  const user = process.env.MYSQL_USER?.trim();
  const database = process.env.MYSQL_DATABASE?.trim();
  const password = process.env.MYSQL_PASSWORD?.trim();
  const rawPort = process.env.MYSQL_PORT?.trim();

  if (!host || !user || !database) return false;
  if (
    host === 'MY_MYSQL_HOST' ||
    host.startsWith('REPLACE_WITH_') ||
    host === 'your-mysql8-host' ||
    password === 'REPLACE_WITH_MYSQL_PASSWORD'
  ) {
    return false;
  }

  // Reject clearly invalid port strings (e.g. a non-numeric placeholder pasted into MYSQL_PORT)
  if (rawPort) {
    const parsedPort = Number(rawPort);
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      return false;
    }
  }

  // Reject accidentally duplicated secret value pasted across host/user/database/password fields
  if (password && host === password && user === password && database === password) {
    return false;
  }

  return true;
}

export async function createDataStore(): Promise<IDataStore> {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isMysqlConfigured()) {
    if (isProd) {
      throw new Error(
        'Production startup aborted: valid MySQL 8 configuration (MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE) is required in production.'
      );
    }
    if (process.env.MYSQL_HOST || process.env.MYSQL_USER || process.env.MYSQL_DATABASE) {
      console.warn(
        '[GovTrack AI] Partial or invalid MySQL configuration detected in development mode; falling back to local fictional demonstration data.'
      );
    }
    return new DemoDataStore();
  }

  const mysqlStore = new MySqlDataStore();
  try {
    await mysqlStore.verifyConnection();
    return mysqlStore;
  } catch (err) {
    await mysqlStore.close().catch(() => {});
    if (isProd) {
      throw err;
    }
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(
      `[GovTrack AI] MySQL 8 connection unavailable in development (${reason}). Falling back to local fictional demonstration data.`
    );
    return new DemoDataStore();
  }
}
