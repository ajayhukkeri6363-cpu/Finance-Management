import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCsv,
  computeDepartmentAggregates,
  computeProjectTotals,
  escapeCsvCell,
  evaluateSpendingReviewFlags,
  subtractMoney,
  sumMoney,
  validateAllocationAmount,
} from './financeRules.ts';
import type {
  Budget,
  Department,
  Expenditure,
  Project,
  ProjectAllocation,
  Revenue,
} from './types.ts';

test('decimal-safe money arithmetic avoids floating point drift', () => {
  assert.equal(sumMoney([0.1, 0.2, 100.55]), 100.85);
  assert.equal(subtractMoney(1000.0, 333.33), 666.67);
});

test('validateAllocationAmount enforces approved status and remaining balance', () => {
  const draftBudget: Budget = {
    id: 1,
    departmentId: 10,
    fiscalYear: 2026,
    title: 'Draft Roads Budget',
    amount: 500000,
    currency: 'USD',
    notes: '',
    status: 'draft',
    isPublic: false,
    isDemo: true,
    createdBy: 1,
    approvedBy: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const draftCheck = validateAllocationAmount({
    budget: draftBudget,
    existingAllocationsForBudget: [],
    requestedAmount: 10000,
  });
  assert.equal(draftCheck.valid, false);

  const approvedBudget: Budget = { ...draftBudget, status: 'approved', approvedBy: 1 };
  const existing: ProjectAllocation[] = [
    {
      id: 1,
      budgetId: 1,
      projectId: 100,
      amount: 350000,
      notes: 'Phase 1',
      isArchived: false,
      isDemo: true,
      createdBy: 1,
      createdAt: '2026-01-02',
    },
    {
      id: 2,
      budgetId: 1,
      projectId: 101,
      amount: 100000,
      notes: 'Archived allocation should be ignored',
      isArchived: true,
      isDemo: true,
      createdBy: 1,
      createdAt: '2026-01-02',
    },
  ];

  const overCheck = validateAllocationAmount({
    budget: approvedBudget,
    existingAllocationsForBudget: existing,
    requestedAmount: 160000,
  });
  assert.equal(overCheck.valid, false);
  assert.equal(overCheck.remainingBefore, 150000);

  const validCheck = validateAllocationAmount({
    budget: approvedBudget,
    existingAllocationsForBudget: existing,
    requestedAmount: 150000,
  });
  assert.equal(validCheck.valid, true);
});

test('computeDepartmentAggregates and computeProjectTotals never double-count across joins', () => {
  const departments: Department[] = [
    {
      id: 1,
      code: 'TRN',
      name: 'Demo Transit',
      description: 'Test',
      isArchived: false,
      isDemo: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];
  const budgets: Budget[] = [
    {
      id: 1,
      departmentId: 1,
      fiscalYear: 2026,
      title: 'FY26 Roads',
      amount: 100000,
      currency: 'USD',
      notes: '',
      status: 'approved',
      isPublic: true,
      isDemo: true,
      createdBy: 1,
      approvedBy: 1,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];
  const allocations: ProjectAllocation[] = [
    {
      id: 1,
      budgetId: 1,
      projectId: 1,
      amount: 40000,
      notes: '',
      isArchived: false,
      isDemo: true,
      createdBy: 1,
      createdAt: '2026-01-05',
    },
    {
      id: 2,
      budgetId: 1,
      projectId: 1,
      amount: 20000,
      notes: '',
      isArchived: false,
      isDemo: true,
      createdBy: 1,
      createdAt: '2026-01-06',
    },
  ];
  const projects: Project[] = [
    {
      id: 1,
      departmentId: 1,
      fiscalYear: 2026,
      title: 'Maple Bridge Demo',
      description: 'Demo',
      location: 'District 1',
      startDate: '2026-01-01',
      targetEndDate: '2026-12-31',
      status: 'active',
      progressPercent: 50,
      isPublic: true,
      isArchived: false,
      isDemo: true,
      createdBy: 1,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];
  const expenditures: Expenditure[] = [
    {
      id: 1,
      projectId: 1,
      departmentId: 1,
      vendorId: null,
      fiscalYear: 2026,
      amount: 15000,
      expenseDate: '2026-02-01',
      category: 'Materials',
      description: 'Asphalt',
      referenceNumber: 'INV-100',
      status: 'paid',
      isArchived: false,
      isDemo: true,
      createdBy: 1,
      createdAt: '2026-02-01',
      updatedAt: '2026-02-01',
    },
    {
      id: 2,
      projectId: 1,
      departmentId: 1,
      vendorId: null,
      fiscalYear: 2026,
      amount: 5000,
      expenseDate: '2026-02-10',
      category: 'Labor',
      description: 'Crew',
      referenceNumber: 'INV-101',
      status: 'approved',
      isArchived: false,
      isDemo: true,
      createdBy: 1,
      createdAt: '2026-02-10',
      updatedAt: '2026-02-10',
    },
  ];
  const revenues: Revenue[] = [
    {
      id: 1,
      departmentId: 1,
      fiscalYear: 2026,
      source: 'Road Levy',
      category: 'Tax',
      amount: 80000,
      receivedDate: '2026-01-15',
      notes: '',
      status: 'received',
      isPublic: true,
      isArchived: false,
      isDemo: true,
      createdBy: 1,
      createdAt: '2026-01-15',
      updatedAt: '2026-01-15',
    },
  ];

  const projTotals = computeProjectTotals({
    projectId: 1,
    allocations,
    expenditures,
  });
  // Must be 60000 & 20000, NOT multiplied by 2x2=4
  assert.equal(projTotals.approvedBudget, 60000);
  assert.equal(projTotals.recordedExpenditure, 20000);

  const deptAggs = computeDepartmentAggregates({
    departments,
    budgets,
    allocations,
    projects,
    expenditures,
    revenues,
    fiscalYear: 2026,
  });
  assert.equal(deptAggs[0].approvedBudget, 100000);
  assert.equal(deptAggs[0].allocatedToProjects, 60000);
  assert.equal(deptAggs[0].recordedExpenditure, 20000);
  assert.equal(deptAggs[0].remainingBudget, 80000);
  assert.equal(deptAggs[0].revenue, 80000);
});

test('evaluateSpendingReviewFlags detects threshold, duplicate ref, spike, and delayed project', () => {
  const departments: Department[] = [
    {
      id: 1,
      code: 'TRN',
      name: 'Demo Transit',
      description: '',
      isArchived: false,
      isDemo: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];
  const projects: Project[] = [
    {
      id: 1,
      departmentId: 1,
      fiscalYear: 2026,
      title: 'Delayed Culvert Demo',
      description: '',
      location: 'North Zone',
      startDate: '2026-01-01',
      targetEndDate: '2026-06-01',
      status: 'delayed',
      progressPercent: 40,
      isPublic: true,
      isArchived: false,
      isDemo: true,
      createdBy: 1,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];
  const allocations: ProjectAllocation[] = [
    {
      id: 1,
      budgetId: 1,
      projectId: 1,
      amount: 10000,
      notes: '',
      isArchived: false,
      isDemo: true,
      createdBy: 1,
      createdAt: '2026-01-01',
    },
  ];
  const expenditures: Expenditure[] = [
    {
      id: 1,
      projectId: 1,
      departmentId: 1,
      vendorId: null,
      fiscalYear: 2026,
      amount: 1000,
      expenseDate: '2026-02-01',
      category: 'Supplies',
      description: 'Pipe A',
      referenceNumber: 'DUP-55',
      status: 'paid',
      isArchived: false,
      isDemo: true,
      createdBy: 1,
      createdAt: '2026-02-01',
      updatedAt: '2026-02-01',
    },
    {
      id: 2,
      projectId: 1,
      departmentId: 1,
      vendorId: null,
      fiscalYear: 2026,
      amount: 1000,
      expenseDate: '2026-02-02',
      category: 'Supplies',
      description: 'Pipe B',
      referenceNumber: 'DUP-55',
      status: 'paid',
      isArchived: false,
      isDemo: true,
      createdBy: 1,
      createdAt: '2026-02-02',
      updatedAt: '2026-02-02',
    },
    {
      id: 3,
      projectId: 1,
      departmentId: 1,
      vendorId: null,
      fiscalYear: 2026,
      amount: 1000,
      expenseDate: '2026-02-03',
      category: 'Supplies',
      description: 'Pipe C',
      referenceNumber: 'REF-03',
      status: 'paid',
      isArchived: false,
      isDemo: true,
      createdBy: 1,
      createdAt: '2026-02-03',
      updatedAt: '2026-02-03',
    },
    {
      id: 4,
      projectId: 1,
      departmentId: 1,
      vendorId: null,
      fiscalYear: 2026,
      amount: 6000,
      expenseDate: '2026-02-04',
      category: 'Equipment',
      description: 'Crane Rental',
      referenceNumber: 'REF-04',
      status: 'approved',
      isArchived: false,
      isDemo: true,
      createdBy: 1,
      createdAt: '2026-02-04',
      updatedAt: '2026-02-04',
    },
  ];

  // Total spent = 9000 / 10000 = 90% => BUDGET_NEARING_THRESHOLD
  const flags = evaluateSpendingReviewFlags({
    departments,
    projects,
    allocations,
    expenditures,
    reviews: [
      {
        flagId: 'DELAYED_PROJECT:project:1',
        reviewedBy: 1,
        reviewedByName: 'Demo Admin',
        reviewNote: 'Weather delay documented',
        reviewedAt: '2026-06-15T10:00:00Z',
      },
    ],
    referenceDateIso: '2026-07-01',
  });

  const codes = new Set(flags.map((f) => f.ruleCode));
  assert.equal(codes.has('BUDGET_NEARING_THRESHOLD'), true);
  assert.equal(codes.has('DELAYED_PROJECT'), true);
  assert.equal(codes.has('DUPLICATE_REFERENCE'), true);
  assert.equal(codes.has('SHARP_EXPENSE_SPIKE'), true);

  const delayedFlag = flags.find((f) => f.ruleCode === 'DELAYED_PROJECT');
  assert.equal(delayedFlag?.isReviewed, true);
  assert.equal(delayedFlag?.reviewNote, 'Weather delay documented');
  assert.match(delayedFlag?.requiresHumanReviewNotice ?? '', /not proof of fraud/i);
});

test('CSV escaping protects formulas and quotes properly', () => {
  assert.equal(escapeCsvCell('=SUM(A1:A2)'), "'=SUM(A1:A2)");
  assert.equal(escapeCsvCell('Road, North "Phase 1"'), '"Road, North ""Phase 1"""');
  const csv = buildCsv(['Col A', 'Col B'], [['Hello', 123.45]]);
  assert.equal(csv, 'Col A,Col B\r\nHello,123.45');
});
