import type {
  Budget,
  Department,
  Expenditure,
  FlagRuleCode,
  FlagSeverity,
  Project,
  ProjectAllocation,
  Revenue,
  ReviewFlagRecord,
} from './types.ts';

export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

export function sumMoney(values: number[]): number {
  const totalCents = values.reduce((acc, v) => acc + toCents(v), 0);
  return fromCents(totalCents);
}

export function subtractMoney(a: number, b: number): number {
  return fromCents(toCents(a) - toCents(b));
}

export function validateAllocationAmount(params: {
  budget: Budget;
  existingAllocationsForBudget: ProjectAllocation[];
  requestedAmount: number;
}): { valid: boolean; reason?: string; remainingBefore: number } {
  const { budget, existingAllocationsForBudget, requestedAmount } = params;

  if (budget.status !== 'approved') {
    return {
      valid: false,
      reason: 'Funds can only be allocated from an approved budget.',
      remainingBefore: 0,
    };
  }
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    return {
      valid: false,
      reason: 'Allocation amount must be greater than zero.',
      remainingBefore: 0,
    };
  }

  const alreadyAllocatedCents = existingAllocationsForBudget
    .filter((a) => !a.isArchived)
    .reduce((acc, a) => acc + toCents(a.amount), 0);

  const budgetCents = toCents(budget.amount);
  const remainingCents = budgetCents - alreadyAllocatedCents;
  const requestedCents = toCents(requestedAmount);

  if (requestedCents > remainingCents) {
    return {
      valid: false,
      reason: `Requested allocation (${fromCents(requestedCents).toFixed(2)}) exceeds remaining approved budget (${fromCents(Math.max(0, remainingCents)).toFixed(2)}).`,
      remainingBefore: fromCents(Math.max(0, remainingCents)),
    };
  }

  return {
    valid: true,
    remainingBefore: fromCents(remainingCents),
  };
}

/**
 * Computes department & project aggregates without double-counting from SQL joins.
 * Each entity set is summed independently by foreign key.
 */
export function computeDepartmentAggregates(params: {
  departments: Department[];
  budgets: Budget[];
  allocations: ProjectAllocation[];
  projects: Project[];
  expenditures: Expenditure[];
  revenues: Revenue[];
  fiscalYear: number | 'all';
}) {
  const { departments, budgets, allocations, projects, expenditures, revenues, fiscalYear } = params;
  const activeDepartments = departments.filter((d) => !d.isArchived);

  const projectById = new Map<number, Project>();
  for (const p of projects) {
    projectById.set(p.id, p);
  }

  const budgetById = new Map<number, Budget>();
  for (const b of budgets) {
    budgetById.set(b.id, b);
  }

  return activeDepartments.map((dept) => {
    const deptBudgets = budgets.filter(
      (b) =>
        b.departmentId === dept.id &&
        b.status === 'approved' &&
        (fiscalYear === 'all' || b.fiscalYear === fiscalYear)
    );
    const approvedBudget = sumMoney(deptBudgets.map((b) => b.amount));

    const deptBudgetIds = new Set(deptBudgets.map((b) => b.id));
    const deptAllocations = allocations.filter(
      (a) => !a.isArchived && deptBudgetIds.has(a.budgetId)
    );
    const allocatedToProjects = sumMoney(deptAllocations.map((a) => a.amount));

    const deptExpenditures = expenditures.filter(
      (e) =>
        !e.isArchived &&
        e.status !== 'archived' &&
        e.departmentId === dept.id &&
        (fiscalYear === 'all' || e.fiscalYear === fiscalYear)
    );
    const recordedExpenditure = sumMoney(deptExpenditures.map((e) => e.amount));

    const deptRevenues = revenues.filter(
      (r) =>
        !r.isArchived &&
        r.status === 'received' &&
        r.departmentId === dept.id &&
        (fiscalYear === 'all' || r.fiscalYear === fiscalYear)
    );
    const revenue = sumMoney(deptRevenues.map((r) => r.amount));

    return {
      departmentId: dept.id,
      departmentName: dept.name,
      approvedBudget,
      allocatedToProjects,
      recordedExpenditure,
      remainingBudget: subtractMoney(approvedBudget, recordedExpenditure),
      revenue,
    };
  });
}

export function computeProjectTotals(params: {
  projectId: number;
  allocations: ProjectAllocation[];
  expenditures: Expenditure[];
}): { approvedBudget: number; recordedExpenditure: number } {
  const { projectId, allocations, expenditures } = params;

  const approvedBudget = sumMoney(
    allocations
      .filter((a) => !a.isArchived && a.projectId === projectId)
      .map((a) => a.amount)
  );

  const recordedExpenditure = sumMoney(
    expenditures
      .filter((e) => !e.isArchived && e.status !== 'archived' && e.projectId === projectId)
      .map((e) => e.amount)
  );

  return { approvedBudget, recordedExpenditure };
}

export interface SavedFlagReview {
  flagId: string;
  reviewedBy: number;
  reviewedByName: string;
  reviewNote: string;
  reviewedAt: string;
}

const HUMAN_REVIEW_NOTICE =
  'Rule-based indicator for human review only. This is not proof of fraud, waste, or wrongdoing.';

export function evaluateSpendingReviewFlags(params: {
  departments: Department[];
  projects: Project[];
  allocations: ProjectAllocation[];
  expenditures: Expenditure[];
  reviews: SavedFlagReview[];
  referenceDateIso?: string;
}): ReviewFlagRecord[] {
  const {
    departments,
    projects,
    allocations,
    expenditures,
    reviews,
    referenceDateIso = new Date().toISOString().slice(0, 10),
  } = params;

  const deptMap = new Map(departments.map((d) => [d.id, d.name]));
  const reviewMap = new Map(reviews.map((r) => [r.flagId, r]));
  const flags: ReviewFlagRecord[] = [];

  const addFlag = (
    raw: Omit<
      ReviewFlagRecord,
      'requiresHumanReviewNotice' | 'isReviewed' | 'reviewedBy' | 'reviewedByName' | 'reviewNote' | 'reviewedAt'
    >
  ) => {
    const rev = reviewMap.get(raw.id);
    flags.push({
      ...raw,
      requiresHumanReviewNotice: HUMAN_REVIEW_NOTICE,
      isReviewed: Boolean(rev),
      reviewedBy: rev ? rev.reviewedBy : null,
      reviewedByName: rev ? rev.reviewedByName : null,
      reviewNote: rev ? rev.reviewNote : null,
      reviewedAt: rev ? rev.reviewedAt : null,
    });
  };

  // 1 & 2. Project spending nearing (>= 85%) or exceeding (> 100%) approved allocation
  // 5. Delayed project (status === 'delayed' OR past targetEndDate while active/planned & < 100%)
  for (const project of projects) {
    if (project.isArchived || project.status === 'archived') continue;
    const deptName = deptMap.get(project.departmentId) ?? 'Unknown Department';
    const { approvedBudget, recordedExpenditure } = computeProjectTotals({
      projectId: project.id,
      allocations,
      expenditures,
    });

    if (approvedBudget > 0) {
      const ratio = toCents(recordedExpenditure) / toCents(approvedBudget);
      const pct = Math.round(ratio * 1000) / 10;

      if (toCents(recordedExpenditure) > toCents(approvedBudget)) {
        addFlag({
          id: `BUDGET_EXCEEDED:project:${project.id}`,
          ruleCode: 'BUDGET_EXCEEDED',
          ruleTitle: 'Project expenditure exceeds approved allocation',
          severity: 'attention',
          entityType: 'project',
          entityId: project.id,
          departmentId: project.departmentId,
          departmentName: deptName,
          fiscalYear: project.fiscalYear,
          explanation: `Recorded project spending ($${recordedExpenditure.toLocaleString('en-US', { minimumFractionDigits: 2 })}) exceeds approved project allocation ($${approvedBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}).`,
          metricSummary: `${pct}% utilized ($${recordedExpenditure.toFixed(2)} / $${approvedBudget.toFixed(2)})`,
        });
      } else if (ratio >= 0.85) {
        addFlag({
          id: `BUDGET_NEARING_THRESHOLD:project:${project.id}`,
          ruleCode: 'BUDGET_NEARING_THRESHOLD',
          ruleTitle: 'Project expenditure nearing approved limit (>= 85%)',
          severity: 'warning',
          entityType: 'project',
          entityId: project.id,
          departmentId: project.departmentId,
          departmentName: deptName,
          fiscalYear: project.fiscalYear,
          explanation: `Recorded spending for "${project.title}" has reached ${pct}% of its approved allocation.`,
          metricSummary: `${pct}% utilized ($${recordedExpenditure.toFixed(2)} / $${approvedBudget.toFixed(2)})`,
        });
      }
    }

    const isPastDue =
      project.targetEndDate < referenceDateIso &&
      project.status !== 'completed' &&
      project.progressPercent < 100;
    if (project.status === 'delayed' || isPastDue) {
      addFlag({
        id: `DELAYED_PROJECT:project:${project.id}`,
        ruleCode: 'DELAYED_PROJECT',
        ruleTitle: 'Project schedule delayed or past target date',
        severity: 'warning',
        entityType: 'project',
        entityId: project.id,
        departmentId: project.departmentId,
        departmentName: deptName,
        fiscalYear: project.fiscalYear,
        explanation:
          project.status === 'delayed'
            ? `"${project.title}" is marked Delayed at ${project.progressPercent}% completion (target ${project.targetEndDate}).`
            : `"${project.title}" passed target completion date ${project.targetEndDate} at ${project.progressPercent}% completion.`,
        metricSummary: `Target ${project.targetEndDate} · Progress ${project.progressPercent}%`,
      });
    }
  }

  // 3. Duplicate reference numbers across non-archived expenditures
  const activeExpenditures = expenditures.filter(
    (e) => !e.isArchived && e.status !== 'archived'
  );
  const byRef = new Map<string, Expenditure[]>();
  for (const exp of activeExpenditures) {
    const normRef = exp.referenceNumber.trim().toUpperCase();
    if (!normRef) continue;
    const list = byRef.get(normRef) ?? [];
    list.push(exp);
    byRef.set(normRef, list);
  }

  for (const [normRef, group] of byRef.entries()) {
    if (group.length > 1) {
      for (const exp of group) {
        const deptName = deptMap.get(exp.departmentId) ?? 'Unknown Department';
        addFlag({
          id: `DUPLICATE_REFERENCE:expenditure:${exp.id}`,
          ruleCode: 'DUPLICATE_REFERENCE',
          ruleTitle: 'Possible duplicate expenditure reference number',
          severity: 'attention',
          entityType: 'expenditure',
          entityId: exp.id,
          departmentId: exp.departmentId,
          departmentName: deptName,
          fiscalYear: exp.fiscalYear,
          explanation: `Reference "${normRef}" appears on ${group.length} active expenditure entries (IDs: ${group.map((g) => `#${g.id}`).join(', ')}).`,
          metricSummary: `Ref ${normRef} · $${exp.amount.toFixed(2)} (${exp.expenseDate})`,
        });
      }
    }
  }

  // 4. Sharp expense spike when sufficient history exists (>= 3 prior/peer entries in department)
  const expByDept = new Map<number, Expenditure[]>();
  for (const exp of activeExpenditures) {
    const list = expByDept.get(exp.departmentId) ?? [];
    list.push(exp);
    expByDept.set(exp.departmentId, list);
  }

  for (const [deptId, deptExps] of expByDept.entries()) {
    if (deptExps.length < 4) continue; // need >= 3 peers for baseline
    const deptName = deptMap.get(deptId) ?? 'Unknown Department';
    for (const exp of deptExps) {
      const peers = deptExps.filter((p) => p.id !== exp.id);
      if (peers.length < 3) continue;
      const peerAvg =
        peers.reduce((acc, p) => acc + p.amount, 0) / peers.length;
      if (peerAvg > 0 && exp.amount >= peerAvg * 2.5) {
        const multiplier = Math.round((exp.amount / peerAvg) * 10) / 10;
        addFlag({
          id: `SHARP_EXPENSE_SPIKE:expenditure:${exp.id}`,
          ruleCode: 'SHARP_EXPENSE_SPIKE',
          ruleTitle: 'Single expenditure significantly above department baseline',
          severity: 'info',
          entityType: 'expenditure',
          entityId: exp.id,
          departmentId: exp.departmentId,
          departmentName: deptName,
          fiscalYear: exp.fiscalYear,
          explanation: `Entry "${exp.description}" ($${exp.amount.toFixed(2)}) is ${multiplier}x the peer average ($${peerAvg.toFixed(2)}) across ${peers.length} other department entries.`,
          metricSummary: `${multiplier}x baseline ($${exp.amount.toFixed(2)} vs avg $${peerAvg.toFixed(2)})`,
        });
      }
    }
  }

  return flags;
}

export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Prevent CSV formula injection in spreadsheet tools
  const safeStr = /^[=+\-@]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(safeStr)) {
    return `"${safeStr.replace(/"/g, '""')}"`;
  }
  return safeStr;
}

export function buildCsv(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>): string {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) => r.map(escapeCsvCell).join(',')),
  ];
  return lines.join('\r\n');
}

export const RULE_LABELS: Record<FlagRuleCode, string> = {
  BUDGET_NEARING_THRESHOLD: 'Budget Nearing Threshold',
  BUDGET_EXCEEDED: 'Budget Exceeded',
  DUPLICATE_REFERENCE: 'Duplicate Reference',
  SHARP_EXPENSE_SPIKE: 'Sharp Expense Change',
  DELAYED_PROJECT: 'Delayed Project',
};

export const SEVERITY_LABELS: Record<FlagSeverity, string> = {
  info: 'Informational',
  warning: 'Warning',
  attention: 'Needs Review',
};
