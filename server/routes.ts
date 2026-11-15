import express, { type Request, type Response, type NextFunction } from 'express';
import {
  assertDepartmentReadAccess,
  assertDepartmentWriteAccess,
  clearSessionCookie,
  hashPassword,
  parseCookies,
  requireAuth,
  requireRoles,
  SESSION_COOKIE_NAME,
  setSessionCookie,
  signSessionToken,
  validateFiscalYear,
  validateIsoDate,
  validateNonEmptyString,
  validateOptionalString,
  validatePositiveMoney,
  ValidationError,
  verifyPassword,
  verifySessionToken,
  type AuthenticatedRequest,
} from './auth.ts';
import type { IDataStore } from './dataStore.ts';
import { DEMO_ACCOUNT_HINTS } from './seedData.ts';
import {
  buildCsv,
  computeDepartmentAggregates,
  computeProjectTotals,
  evaluateSpendingReviewFlags,
  subtractMoney,
  sumMoney,
} from '../shared/financeRules.ts';
import type {
  BudgetStatus,
  DashboardSummary,
  ExpenditureStatus,
  ProcurementStatus,
  ProjectStatus,
  PublicBudgetSummary,
  PublicProjectSummary,
  RevenueStatus,
  UserRole,
} from '../shared/types.ts';

function asyncHandler(
  fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as AuthenticatedRequest, res, next)).catch(next);
  };
}

function parseIdParam(raw: string | string[] | undefined, label = 'ID'): number {
  const val = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(val);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError(`Invalid ${label}.`);
  }
  return id;
}

function parseFiscalYearFilter(raw: unknown): number | 'all' {
  if (raw === undefined || raw === null || raw === '' || raw === 'all') {
    return 'all';
  }
  return validateFiscalYear(raw);
}

export function createApiRouter(store: IDataStore): express.Router {
  const router = express.Router();

  // Attach currentUser from signed HttpOnly cookie if valid
  router.use(
    asyncHandler(async (req, _res, next) => {
      const cookies = parseCookies(req.headers.cookie);
      const token = cookies[SESSION_COOKIE_NAME];
      const payload = verifySessionToken(token);
      if (payload) {
        const user = await store.findUserById(payload.userId);
        if (user && user.isActive) {
          req.currentUser = user;
        }
      }
      next();
    })
  );

  router.get(
    '/health',
    asyncHandler(async (_req, res) => {
      res.json({ ok: true, mode: store.mode });
    })
  );

  // Auth mode & setup status (never exposes secrets)
  router.get(
    '/auth/mode',
    asyncHandler(async (_req, res) => {
      const adminCount = await store.countAdmins();
      res.json({
        mode: store.mode,
        needsFirstAdmin: adminCount === 0,
        firstAdminTokenEnabled: Boolean(
          process.env.FIRST_ADMIN_SETUP_TOKEN &&
            !process.env.FIRST_ADMIN_SETUP_TOKEN.startsWith('REPLACE_WITH')
        ),
        demoAccounts: store.mode === 'local-demo' ? DEMO_ACCOUNT_HINTS : [],
      });
    })
  );

  router.get(
    '/auth/me',
    asyncHandler(async (req, res) => {
      res.json({ user: req.currentUser ?? null });
    })
  );

  router.post(
    '/auth/login',
    asyncHandler(async (req, res) => {
      const email = validateNonEmptyString(req.body?.email, 'Email', 190).toLowerCase();
      const password = validateNonEmptyString(req.body?.password, 'Password', 200);

      const user = await store.findUserByEmail(email);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }
      if (!user.isActive) {
        res.status(403).json({ error: 'This account has been deactivated.' });
        return;
      }

      const token = signSessionToken(user.id);
      setSessionCookie(res, req, token);
      const safeUser = await store.findUserById(user.id);

      await store.appendAuditLog({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        departmentId: user.departmentId,
        action: 'USER_LOGIN',
        entityType: 'user',
        entityId: user.id,
        summary: `Signed in (${user.role})`,
      });

      res.json({ user: safeUser });
    })
  );

  // Public self-registration ALWAYS creates citizen accounts only
  router.post(
    '/auth/register',
    asyncHandler(async (req, res) => {
      const name = validateNonEmptyString(req.body?.name, 'Full name', 120);
      const email = validateNonEmptyString(req.body?.email, 'Email', 190).toLowerCase();
      if (!email.includes('@')) {
        throw new ValidationError('Please provide a valid email address.');
      }
      const password = validateNonEmptyString(req.body?.password, 'Password', 200);
      if (password.length < 8) {
        throw new ValidationError('Password must be at least 8 characters long.');
      }

      const created = await store.createUser({
        name,
        email,
        passwordHash: hashPassword(password),
        role: 'citizen', // Forced server-side; client-supplied role/department ignored
        departmentId: null,
        isActive: true,
      });

      const token = signSessionToken(created.id);
      setSessionCookie(res, req, token);

      await store.appendAuditLog({
        actorUserId: created.id,
        actorName: created.name,
        actorRole: 'citizen',
        departmentId: null,
        action: 'CITIZEN_REGISTER',
        entityType: 'user',
        entityId: created.id,
        summary: `Public citizen account registered (${created.email})`,
      });

      res.status(201).json({ user: created });
    })
  );

  // Optional one-time First-Admin provisioning endpoint when 0 admins exist in MySQL
  router.post(
    '/auth/setup-first-admin',
    asyncHandler(async (req, res) => {
      const adminCount = await store.countAdmins();
      if (adminCount > 0) {
        res.status(403).json({ error: 'An administrator account already exists.' });
        return;
      }

      const configuredToken = process.env.FIRST_ADMIN_SETUP_TOKEN?.trim();
      if (!configuredToken || configuredToken.startsWith('REPLACE_WITH')) {
        res.status(403).json({
          error:
            'Web first-admin setup is disabled. Use `npm run create-admin` on the server or configure FIRST_ADMIN_SETUP_TOKEN.',
        });
        return;
      }

      const providedToken = validateNonEmptyString(req.body?.setupToken, 'Setup token', 200);
      if (providedToken !== configuredToken) {
        res.status(403).json({ error: 'Invalid setup token.' });
        return;
      }

      const name = validateNonEmptyString(req.body?.name, 'Admin full name', 120);
      const email = validateNonEmptyString(req.body?.email, 'Email', 190).toLowerCase();
      const password = validateNonEmptyString(req.body?.password, 'Password', 200);
      if (password.length < 10) {
        throw new ValidationError('Admin password must be at least 10 characters long.');
      }

      const created = await store.createUser({
        name,
        email,
        passwordHash: hashPassword(password),
        role: 'admin',
        departmentId: null,
        isActive: true,
      });

      const token = signSessionToken(created.id);
      setSessionCookie(res, req, token);

      await store.appendAuditLog({
        actorUserId: created.id,
        actorName: created.name,
        actorRole: 'admin',
        departmentId: null,
        action: 'CREATE_FIRST_ADMIN',
        entityType: 'user',
        entityId: created.id,
        summary: `First administrator created via setup token (${created.email})`,
      });

      res.status(201).json({ user: created });
    })
  );

  router.post(
    '/auth/logout',
    asyncHandler(async (_req, res) => {
      clearSessionCookie(res);
      res.json({ ok: true });
    })
  );

  // ============================================================
  // PUBLIC TRANSPARENCY PORTAL (Anonymous + Citizens)
  // Strictly exposes ONLY published public records; zero private notes or vendor contacts.
  // ============================================================

  router.get(
    '/public/overview',
    asyncHandler(async (req, res) => {
      const fyFilter = parseFiscalYearFilter(req.query.fiscalYear);
      const snapshot = await store.getComputeSnapshot();

      const publishedBudgets = snapshot.budgets.filter(
        (b) =>
          b.status === 'approved' &&
          b.isPublic &&
          (fyFilter === 'all' || b.fiscalYear === fyFilter)
      );

      const publishedProjects = snapshot.projects.filter(
        (p) =>
          !p.isArchived &&
          p.status !== 'archived' &&
          p.isPublic &&
          (fyFilter === 'all' || p.fiscalYear === fyFilter)
      );

      const publicRevenues = snapshot.revenues.filter(
        (r) =>
          !r.isArchived &&
          r.status === 'received' &&
          r.isPublic &&
          (fyFilter === 'all' || r.fiscalYear === fyFilter)
      );

      const deptMap = new Map(snapshot.departments.map((d) => [d.id, d.name]));

      const projectSummaries: PublicProjectSummary[] = publishedProjects.map((p) => {
        const totals = computeProjectTotals({
          projectId: p.id,
          allocations: snapshot.allocations,
          expenditures: snapshot.expenditures,
        });
        return {
          id: p.id,
          departmentName: deptMap.get(p.departmentId) ?? 'Department',
          fiscalYear: p.fiscalYear,
          title: p.title,
          description: p.description,
          location: p.location,
          startDate: p.startDate,
          targetEndDate: p.targetEndDate,
          status: p.status,
          progressPercent: p.progressPercent,
          approvedBudget: totals.approvedBudget,
          recordedExpenditure: totals.recordedExpenditure,
          isDemo: p.isDemo,
        };
      });

      const budgetSummaries: PublicBudgetSummary[] = publishedBudgets.map((b) => {
        const allocatedAmount = sumMoney(
          snapshot.allocations
            .filter((a) => !a.isArchived && a.budgetId === b.id)
            .map((a) => a.amount)
        );
        const linkedProjectIds = new Set(
          snapshot.allocations
            .filter((a) => !a.isArchived && a.budgetId === b.id)
            .map((a) => a.projectId)
        );
        const recordedExpenditure = sumMoney(
          snapshot.expenditures
            .filter(
              (e) =>
                !e.isArchived &&
                e.status !== 'archived' &&
                linkedProjectIds.has(e.projectId)
            )
            .map((e) => e.amount)
        );

        return {
          id: b.id,
          departmentName: deptMap.get(b.departmentId) ?? 'Department',
          fiscalYear: b.fiscalYear,
          title: b.title,
          amount: b.amount,
          currency: b.currency,
          allocatedAmount,
          recordedExpenditure,
          isDemo: b.isDemo,
        };
      });

      const totalPublishedBudget = sumMoney(publishedBudgets.map((b) => b.amount));
      const totalPublishedProjectSpend = sumMoney(
        projectSummaries.map((p) => p.recordedExpenditure)
      );
      const totalPublishedRevenue = sumMoney(publicRevenues.map((r) => r.amount));

      const availableYears = Array.from(
        new Set([
          ...snapshot.budgets.filter((b) => b.isPublic && b.status === 'approved').map((b) => b.fiscalYear),
          ...snapshot.projects.filter((p) => p.isPublic && !p.isArchived).map((p) => p.fiscalYear),
        ])
      ).sort((a, b) => b - a);

      // Aggregate by department cleanly for public chart
      const byDepartmentMap = new Map<
        string,
        { departmentName: string; publishedBudget: number; projectExpenditure: number }
      >();
      for (const b of budgetSummaries) {
        const cur = byDepartmentMap.get(b.departmentName) ?? {
          departmentName: b.departmentName,
          publishedBudget: 0,
          projectExpenditure: 0,
        };
        cur.publishedBudget = sumMoney([cur.publishedBudget, b.amount]);
        byDepartmentMap.set(b.departmentName, cur);
      }
      for (const p of projectSummaries) {
        const cur = byDepartmentMap.get(p.departmentName) ?? {
          departmentName: p.departmentName,
          publishedBudget: 0,
          projectExpenditure: 0,
        };
        cur.projectExpenditure = sumMoney([cur.projectExpenditure, p.recordedExpenditure]);
        byDepartmentMap.set(p.departmentName, cur);
      }

      res.json({
        mode: store.mode,
        fiscalYear: fyFilter,
        availableFiscalYears: availableYears,
        totals: {
          publishedBudget: totalPublishedBudget,
          publishedProjectExpenditure: totalPublishedProjectSpend,
          publishedRemaining: subtractMoney(totalPublishedBudget, totalPublishedProjectSpend),
          publishedRevenue: totalPublishedRevenue,
        },
        byDepartment: Array.from(byDepartmentMap.values()),
        projects: projectSummaries,
        budgets: budgetSummaries,
      });
    })
  );

  router.get(
    '/public/reports/export',
    asyncHandler(async (req, res) => {
      const fyFilter = parseFiscalYearFilter(req.query.fiscalYear);
      const snapshot = await store.getComputeSnapshot();
      const deptMap = new Map(snapshot.departments.map((d) => [d.id, d.name]));

      const publishedProjects = snapshot.projects.filter(
        (p) =>
          !p.isArchived &&
          p.status !== 'archived' &&
          p.isPublic &&
          (fyFilter === 'all' || p.fiscalYear === fyFilter)
      );

      const rows = publishedProjects.map((p) => {
        const totals = computeProjectTotals({
          projectId: p.id,
          allocations: snapshot.allocations,
          expenditures: snapshot.expenditures,
        });
        return [
          p.id,
          p.fiscalYear,
          deptMap.get(p.departmentId) ?? 'Department',
          p.title,
          p.location,
          p.status,
          `${p.progressPercent}%`,
          totals.approvedBudget.toFixed(2),
          totals.recordedExpenditure.toFixed(2),
          p.isDemo ? 'Demonstration Data' : 'Production',
        ];
      });

      const csv = buildCsv(
        [
          'Project ID',
          'Fiscal Year',
          'Department',
          'Project Title',
          'Location',
          'Status',
          'Progress',
          'Approved Project Budget',
          'Recorded Expenditure',
          'Data Notice',
        ],
        rows
      );

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="govtrack-public-projects-fy-${fyFilter}.csv"`
      );
      res.send(csv);
    })
  );

  // ============================================================
  // INTERNAL AUTHENTICATED ENDPOINTS (Admin, Department Staff, Auditor)
  // Citizens are explicitly denied access (403) to internal views.
  // ============================================================

  const requireInternal = requireRoles('admin', 'department_staff', 'auditor');

  router.get(
    '/dashboard',
    requireAuth,
    requireInternal,
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const fyFilter = parseFiscalYearFilter(req.query.fiscalYear);
      const snapshot = await store.getComputeSnapshot();

      const visibleDepts =
        user.role === 'department_staff'
          ? snapshot.departments.filter((d) => d.id === user.departmentId)
          : snapshot.departments;

      const byDepartment = computeDepartmentAggregates({
        departments: visibleDepts,
        budgets: snapshot.budgets,
        allocations: snapshot.allocations,
        projects: snapshot.projects,
        expenditures: snapshot.expenditures,
        revenues: snapshot.revenues,
        fiscalYear: fyFilter,
      });

      const totalApprovedBudget = sumMoney(byDepartment.map((d) => d.approvedBudget));
      const totalAllocatedToProjects = sumMoney(byDepartment.map((d) => d.allocatedToProjects));
      const totalRecordedExpenditure = sumMoney(byDepartment.map((d) => d.recordedExpenditure));
      const remainingApprovedBudget = subtractMoney(
        totalApprovedBudget,
        totalRecordedExpenditure
      );

      // Include general fund revenues (departmentId === null) for Admin/Auditor
      const visibleRevenues = snapshot.revenues.filter(
        (r) =>
          !r.isArchived &&
          r.status === 'received' &&
          (fyFilter === 'all' || r.fiscalYear === fyFilter) &&
          (user.role !== 'department_staff' || r.departmentId === user.departmentId)
      );
      const totalRevenue = sumMoney(visibleRevenues.map((r) => r.amount));

      const visibleExps = snapshot.expenditures.filter(
        (e) =>
          !e.isArchived &&
          e.status !== 'archived' &&
          (fyFilter === 'all' || e.fiscalYear === fyFilter) &&
          (user.role !== 'department_staff' || e.departmentId === user.departmentId)
      );

      const expCatMap = new Map<string, number>();
      for (const e of visibleExps) {
        expCatMap.set(e.category, sumMoney([expCatMap.get(e.category) ?? 0, e.amount]));
      }
      const revCatMap = new Map<string, number>();
      for (const r of visibleRevenues) {
        revCatMap.set(r.category, sumMoney([revCatMap.get(r.category) ?? 0, r.amount]));
      }

      const availableFiscalYears = Array.from(
        new Set([
          ...snapshot.budgets.map((b) => b.fiscalYear),
          ...snapshot.projects.map((p) => p.fiscalYear),
          ...snapshot.revenues.map((r) => r.fiscalYear),
        ])
      ).sort((a, b) => b - a);

      const summary: DashboardSummary = {
        fiscalYear: fyFilter,
        totalApprovedBudget,
        totalAllocatedToProjects,
        totalRecordedExpenditure,
        remainingApprovedBudget,
        totalRevenue,
        byDepartment,
        expenditureByCategory: Array.from(expCatMap.entries()).map(([category, total]) => ({
          category,
          total,
        })),
        revenueByCategory: Array.from(revCatMap.entries()).map(([category, total]) => ({
          category,
          total,
        })),
        availableFiscalYears,
      };

      res.json(summary);
    })
  );

  // ---- DEPARTMENTS ----
  router.get(
    '/departments',
    requireAuth,
    requireInternal,
    asyncHandler(async (_req, res) => {
      const list = await store.listDepartments();
      res.json({ departments: list });
    })
  );

  router.post(
    '/departments',
    requireAuth,
    requireRoles('admin'),
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const code = validateNonEmptyString(req.body?.code, 'Department code', 24);
      const name = validateNonEmptyString(req.body?.name, 'Department name', 160);
      const description = validateOptionalString(req.body?.description, 1000);

      const created = await store.createDepartment({ code, name, description });
      await store.appendAuditLog({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        departmentId: created.id,
        action: 'CREATE_DEPARTMENT',
        entityType: 'department',
        entityId: created.id,
        summary: `Created department "${created.name}" (${created.code})`,
      });
      res.status(201).json({ department: created });
    })
  );

  router.patch(
    '/departments/:id',
    requireAuth,
    requireRoles('admin'),
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const id = parseIdParam(req.params.id, 'department ID');
      const code =
        req.body?.code !== undefined
          ? validateNonEmptyString(req.body.code, 'Department code', 24)
          : undefined;
      const name =
        req.body?.name !== undefined
          ? validateNonEmptyString(req.body.name, 'Department name', 160)
          : undefined;
      const description =
        req.body?.description !== undefined
          ? validateOptionalString(req.body.description, 1000)
          : undefined;

      const updated = await store.updateDepartment(id, { code, name, description });
      if (!updated) {
        res.status(404).json({ error: 'Department not found.' });
        return;
      }

      await store.appendAuditLog({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        departmentId: updated.id,
        action: 'UPDATE_DEPARTMENT',
        entityType: 'department',
        entityId: updated.id,
        summary: `Updated department "${updated.name}"`,
      });
      res.json({ department: updated });
    })
  );

  router.post(
    '/departments/:id/archive',
    requireAuth,
    requireRoles('admin'),
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const id = parseIdParam(req.params.id, 'department ID');
      const archived = await store.archiveDepartment(id);
      if (!archived) {
        res.status(404).json({ error: 'Department not found.' });
        return;
      }
      await store.appendAuditLog({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        departmentId: archived.id,
        action: 'ARCHIVE_DEPARTMENT',
        entityType: 'department',
        entityId: archived.id,
        summary: `Archived department "${archived.name}"`,
      });
      res.json({ department: archived });
    })
  );

  // ---- BUDGETS & ALLOCATIONS ----
  router.get(
    '/budgets',
    requireAuth,
    requireInternal,
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const [budgets, allocations] = await Promise.all([
        store.listBudgets(),
        store.listAllocations(),
      ]);

      const scoped =
        user.role === 'department_staff'
          ? budgets.filter((b) => b.departmentId === user.departmentId)
          : budgets;

      const enriched = scoped.map((b) => {
        const allocatedAmount = sumMoney(
          allocations
            .filter((a) => !a.isArchived && a.budgetId === b.id)
            .map((a) => a.amount)
        );
        return {
          ...b,
          allocatedAmount,
          remainingAllocatable: subtractMoney(b.amount, allocatedAmount),
        };
      });

      res.json({ budgets: enriched });
    })
  );

  router.post(
    '/budgets',
    requireAuth,
    requireRoles('admin', 'department_staff'),
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const requestedDeptRaw = req.body?.departmentId;
      const departmentId =
        requestedDeptRaw !== undefined && requestedDeptRaw !== null && requestedDeptRaw !== ''
          ? parseIdParam(String(requestedDeptRaw), 'department ID')
          : user.role === 'department_staff' && user.departmentId !== null
            ? user.departmentId
            : parseIdParam('', 'department ID');

      const access = assertDepartmentWriteAccess(user, departmentId);
      if (!access.ok) {
        res.status(access.status).json({ error: access.error });
        return;
      }

      const dept = await store.getDepartmentById(departmentId);
      if (!dept || dept.isArchived) {
        throw new ValidationError('Target active department not found.');
      }

      const fiscalYear = validateFiscalYear(req.body?.fiscalYear);
      const title = validateNonEmptyString(req.body?.title, 'Budget title', 200);
      const amount = validatePositiveMoney(req.body?.amount, 'Budget amount');
      const currency = validateOptionalString(req.body?.currency || 'USD', 3) || 'USD';
      const notes = validateOptionalString(req.body?.notes, 1000);

      // Only Admin can directly approve or publish on creation
      const requestedStatus = req.body?.status === 'approved' ? 'approved' : 'draft';
      const status: BudgetStatus =
        user.role === 'admin' ? requestedStatus : 'draft';
      const isPublic = user.role === 'admin' ? Boolean(req.body?.isPublic) && status === 'approved' : false;

      const created = await store.createBudget({
        departmentId,
        fiscalYear,
        title,
        amount,
        currency,
        notes,
        status,
        isPublic,
        createdBy: user.id,
      });

      await store.appendAuditLog({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        departmentId,
        action: 'CREATE_BUDGET',
        entityType: 'budget',
        entityId: created.id,
        summary: `Created ${created.status} budget "${created.title}" ($${created.amount.toFixed(2)})`,
      });

      res.status(201).json({ budget: created });
    })
  );

  router.patch(
    '/budgets/:id',
    requireAuth,
    requireRoles('admin', 'department_staff'),
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const id = parseIdParam(req.params.id, 'budget ID');
      const existing = await store.getBudgetById(id);
      if (!existing) {
        res.status(404).json({ error: 'Budget not found.' });
        return;
      }

      const access = assertDepartmentWriteAccess(user, existing.departmentId);
      if (!access.ok) {
        res.status(access.status).json({ error: access.error });
        return;
      }
      if (user.role === 'department_staff' && existing.status !== 'draft') {
        res.status(403).json({
          error: 'Department staff can only edit budgets while in draft status.',
        });
        return;
      }

      const title =
        req.body?.title !== undefined
          ? validateNonEmptyString(req.body.title, 'Budget title', 200)
          : undefined;
      const amount =
        req.body?.amount !== undefined
          ? validatePositiveMoney(req.body.amount, 'Budget amount')
          : undefined;
      const fiscalYear =
        req.body?.fiscalYear !== undefined
          ? validateFiscalYear(req.body.fiscalYear)
          : undefined;
      const notes =
        req.body?.notes !== undefined
          ? validateOptionalString(req.body.notes, 1000)
          : undefined;
      const isPublic =
        user.role === 'admin' && req.body?.isPublic !== undefined
          ? Boolean(req.body.isPublic) && existing.status === 'approved'
          : undefined;

      const updated = await store.updateBudget(id, {
        title,
        amount,
        fiscalYear,
        notes,
        isPublic,
      });

      await store.appendAuditLog({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        departmentId: existing.departmentId,
        action: 'UPDATE_BUDGET',
        entityType: 'budget',
        entityId: id,
        summary: `Updated budget "${updated?.title}"`,
      });

      res.json({ budget: updated });
    })
  );

  router.post(
    '/budgets/:id/status',
    requireAuth,
    requireRoles('admin'),
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const id = parseIdParam(req.params.id, 'budget ID');
      const existing = await store.getBudgetById(id);
      if (!existing) {
        res.status(404).json({ error: 'Budget not found.' });
        return;
      }

      const nextStatus = req.body?.status as BudgetStatus;
      if (!['draft', 'approved', 'archived'].includes(nextStatus)) {
        throw new ValidationError('Invalid budget status.');
      }

      const updated = await store.setBudgetStatus(
        id,
        nextStatus,
        nextStatus === 'approved' ? user.id : null
      );
      if (nextStatus === 'archived' && updated) {
        await store.updateBudget(id, { isPublic: false });
      }

      await store.appendAuditLog({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        departmentId: existing.departmentId,
        action:
          nextStatus === 'approved'
            ? 'APPROVE_BUDGET'
            : nextStatus === 'archived'
              ? 'ARCHIVE_BUDGET'
              : 'REOPEN_BUDGET_DRAFT',
        entityType: 'budget',
        entityId: id,
        summary: `Changed budget "${existing.title}" status from ${existing.status} to ${nextStatus}`,
      });

      res.json({ budget: await store.getBudgetById(id) });
    })
  );

  router.get(
    '/allocations',
    requireAuth,
    requireInternal,
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const [allocations, budgets, projects] = await Promise.all([
        store.listAllocations(),
        store.listBudgets(),
        store.listProjects(),
      ]);

      const budgetMap = new Map(budgets.map((b) => [b.id, b]));
      const projectMap = new Map(projects.map((p) => [p.id, p]));

      const enriched = allocations
        .map((a) => {
          const b = budgetMap.get(a.budgetId);
          const p = projectMap.get(a.projectId);
          return {
            ...a,
            budgetTitle: b?.title ?? 'Budget',
            departmentId: b?.departmentId ?? p?.departmentId ?? 0,
            fiscalYear: b?.fiscalYear ?? p?.fiscalYear ?? 0,
            projectTitle: p?.title ?? 'Project',
          };
        })
        .filter(
          (a) =>
            user.role !== 'department_staff' || a.departmentId === user.departmentId
        );

      res.json({ allocations: enriched });
    })
  );

  router.post(
    '/allocations',
    requireAuth,
    requireRoles('admin', 'department_staff'),
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const budgetId = parseIdParam(String(req.body?.budgetId ?? ''), 'budget ID');
      const projectId = parseIdParam(String(req.body?.projectId ?? ''), 'project ID');
      const amount = validatePositiveMoney(req.body?.amount, 'Allocation amount');
      const notes = validateOptionalString(req.body?.notes, 500);

      const budget = await store.getBudgetById(budgetId);
      if (!budget) {
        res.status(404).json({ error: 'Budget not found.' });
        return;
      }

      const access = assertDepartmentWriteAccess(user, budget.departmentId);
      if (!access.ok) {
        res.status(access.status).json({ error: access.error });
        return;
      }

      const created = await store.createAllocation({
        budgetId,
        projectId,
        amount,
        notes,
        createdBy: user.id,
      });

      await store.appendAuditLog({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        departmentId: budget.departmentId,
        action: 'ALLOCATE_FUNDS',
        entityType: 'allocation',
        entityId: created.id,
        summary: `Allocated $${created.amount.toFixed(2)} from Budget #${budgetId} to Project #${projectId}`,
      });

      res.status(201).json({ allocation: created });
    })
  );

  router.post(
    '/allocations/:id/archive',
    requireAuth,
    requireRoles('admin'),
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const id = parseIdParam(req.params.id, 'allocation ID');
      const existing = await store.getAllocationById(id);
      if (!existing) {
        res.status(404).json({ error: 'Allocation not found.' });
        return;
      }
      const budget = await store.getBudgetById(existing.budgetId);
      const archived = await store.archiveAllocation(id);

      await store.appendAuditLog({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        departmentId: budget?.departmentId ?? null,
        action: 'ARCHIVE_ALLOCATION',
        entityType: 'allocation',
        entityId: id,
        summary: `Archived allocation #${id} ($${existing.amount.toFixed(2)})`,
      });

      res.json({ allocation: archived });
    })
  );

  // ---- PROJECTS ----
  router.get(
    '/projects',
    requireAuth,
    requireInternal,
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const snapshot = await store.getComputeSnapshot();

      const scoped = snapshot.projects.filter(
        (p) =>
          user.role !== 'department_staff' || p.departmentId === user.departmentId
      );

      const enriched = scoped.map((p) => {
        const totals = computeProjectTotals({
          projectId: p.id,
          allocations: snapshot.allocations,
          expenditures: snapshot.expenditures,
        });
        return {
          ...p,
          approvedAllocatedBudget: totals.approvedBudget,
          recordedExpenditure: totals.recordedExpenditure,
        };
      });

      res.json({ projects: enriched });
    })
  );

  router.post(
    '/projects',
    requireAuth,
    requireRoles('admin', 'department_staff'),
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const requestedDeptRaw = req.body?.departmentId;
      const departmentId =
        requestedDeptRaw !== undefined && requestedDeptRaw !== null && requestedDeptRaw !== ''
          ? parseIdParam(String(requestedDeptRaw), 'department ID')
          : user.role === 'department_staff' && user.departmentId !== null
            ? user.departmentId
            : parseIdParam('', 'department ID');

      const access = assertDepartmentWriteAccess(user, departmentId);
      if (!access.ok) {
        res.status(access.status).json({ error: access.error });
        return;
      }

      const dept = await store.getDepartmentById(departmentId);
      if (!dept || dept.isArchived) {
        throw new ValidationError('Active department not found.');
      }

      const fiscalYear = validateFiscalYear(req.body?.fiscalYear);
      const title = validateNonEmptyString(req.body?.title, 'Project title', 200);
      const description = validateNonEmptyString(req.body?.description, 'Project description', 2000);
      const location = validateNonEmptyString(req.body?.location, 'Location', 180);
      const startDate = validateIsoDate(req.body?.startDate, 'Start date');
      const targetEndDate = validateIsoDate(req.body?.targetEndDate, 'Target end date');
      if (targetEndDate < startDate) {
        throw new ValidationError('Target end date cannot be earlier than start date.');
      }

      const status = (req.body?.status ?? 'planned') as ProjectStatus;
      if (!['planned', 'active', 'delayed', 'completed'].includes(status)) {
        throw new ValidationError('Invalid project status.');
      }
      const progressRaw = Number(req.body?.progressPercent ?? 0);
      if (!Number.isFinite(progressRaw) || progressRaw < 0 || progressRaw > 100) {
        throw new ValidationError('Progress percentage must be between 0 and 100.');
      }

      const isPublic = user.role === 'admin' ? Boolean(req.body?.isPublic) : false;

      const created = await store.createProject({
        departmentId,
        fiscalYear,
        title,
        description,
        location,
        startDate,
        targetEndDate,
        status,
        progressPercent: Math.round(progressRaw),
        isPublic,
        createdBy: user.id,
      });

      await store.appendAuditLog({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        departmentId,
        action: 'CREATE_PROJECT',
        entityType: 'project',
        entityId: created.id,
        summary: `Created project "${created.title}" (FY${created.fiscalYear})`,
      });

      res.status(201).json({ project: created });
    })
  );

  router.patch(
    '/projects/:id',
    requireAuth,
    requireRoles('admin', 'department_staff'),
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const id = parseIdParam(req.params.id, 'project ID');
      const existing = await store.getProjectById(id);
      if (!existing) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }

      const access = assertDepartmentWriteAccess(user, existing.departmentId);
      if (!access.ok) {
        res.status(access.status).json({ error: access.error });
        return;
      }

      const title =
        req.body?.title !== undefined
          ? validateNonEmptyString(req.body.title, 'Project title', 200)
          : undefined;
      const description =
        req.body?.description !== undefined
          ? validateNonEmptyString(req.body.description, 'Description', 2000)
          : undefined;
      const location =
        req.body?.location !== undefined
          ? validateNonEmptyString(req.body.location, 'Location', 180)
          : undefined;
      const startDate =
        req.body?.startDate !== undefined
          ? validateIsoDate(req.body.startDate, 'Start date')
          : undefined;
      const targetEndDate =
        req.body?.targetEndDate !== undefined
          ? validateIsoDate(req.body.targetEndDate, 'Target end date')
          : undefined;
      const status = req.body?.status as ProjectStatus | undefined;
      if (status !== undefined && !['planned', 'active', 'delayed', 'completed'].includes(status)) {
        throw new ValidationError('Invalid project status.');
      }

      let progressPercent: number | undefined;
      if (req.body?.progressPercent !== undefined) {
        const val = Number(req.body.progressPercent);
        if (!Number.isFinite(val) || val < 0 || val > 100) {
          throw new ValidationError('Progress percentage must be between 0 and 100.');
        }
        progressPercent = Math.round(val);
      }

      // Only Admin can change public publication state
      let isPublic: boolean | undefined;
      if (req.body?.isPublic !== undefined) {
        if (user.role !== 'admin') {
          res.status(403).json({
            error: 'Only administrators can publish or unpublish projects on the public portal.',
          });
          return;
        }
        isPublic = Boolean(req.body.isPublic);
      }

      const updated = await store.updateProject(id, {
        title,
        description,
        location,
        startDate,
        targetEndDate,
        status,
        progressPercent,
        isPublic,
      });

      await store.appendAuditLog({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        departmentId: existing.departmentId,
        action:
          isPublic !== undefined && isPublic !== existing.isPublic
            ? isPublic
              ? 'PUBLISH_PROJECT'
              : 'UNPUBLISH_PROJECT'
            : 'UPDATE_PROJECT',
        entityType: 'project',
        entityId: id,
        summary: `Updated project "${updated?.title}"`,
      });

      res.json({ project: updated });
    })
  );

  router.post(
    '/projects/:id/archive',
    requireAuth,
    requireRoles('admin', 'department_staff'),
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const id = parseIdParam(req.params.id, 'project ID');
      const existing = await store.getProjectById(id);
      if (!existing) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }
      const access = assertDepartmentWriteAccess(user, existing.departmentId);
      if (!access.ok) {
        res.status(access.status).json({ error: access.error });
        return;
      }

      const archived = await store.archiveProject(id);
      await store.appendAuditLog({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        departmentId: existing.departmentId,
        action: 'ARCHIVE_PROJECT',
        entityType: 'project',
        entityId: id,
        summary: `Archived project "${existing.title}"`,
      });
      res.json({ project: archived });
    })
  );

  // ---- EXPENDITURES (Preserve financial history; archive only, never hard-delete) ----
  router.get(
    '/expenditures',
    requireAuth,
    requireInternal,
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const list = await store.listExpenditures();
      const scoped =
        user.role === 'department_staff'
          ? list.filter((e) => e.departmentId === user.departmentId)
          : list;
      res.json({ expenditures: scoped });
    })
  );

  router.post(
    '/expenditures',
    requireAuth,
    requireRoles('admin', 'department_staff'),
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const projectId = parseIdParam(String(req.body?.projectId ?? ''), 'project ID');
      const project = await store.getProjectById(projectId);
      if (!project || project.isArchived) {
        throw new ValidationError('Active project not found.');
      }

      const access = assertDepartmentWriteAccess(user, project.departmentId);
      if (!access.ok) {
        res.status(access.status).json({ error: access.error });
        return;
      }

      const vendorId =
        req.body?.vendorId !== undefined && req.body.vendorId !== null && req.body.vendorId !== ''
          ? parseIdParam(String(req.body.vendorId), 'vendor ID')
          : null;
      if (vendorId !== null) {
        const v = await store.getVendorById(vendorId);
        if (!v || v.isArchived) throw new ValidationError('Active vendor not found.');
      }

      const amount = validatePositiveMoney(req.body?.amount, 'Expenditure amount');
      const expenseDate = validateIsoDate(req.body?.expenseDate, 'Expense date');
      const category = validateNonEmptyString(req.body?.category, 'Category', 100);
      const description = validateNonEmptyString(req.body?.description, 'Description', 500);
      const referenceNumber = validateNonEmptyString(
        req.body?.referenceNumber,
        'Reference number',
        80
      );

      const requestedStatus = (req.body?.status ?? 'pending') as ExpenditureStatus;
      if (!['pending', 'approved', 'paid'].includes(requestedStatus)) {
        throw new ValidationError('Invalid expenditure status.');
      }
      // Department staff create pending expenditures unless admin approves/marks paid
      const status: ExpenditureStatus =
        user.role === 'admin' ? requestedStatus : 'pending';

      const created = await store.createExpenditure({
        projectId,
        departmentId: project.departmentId,
        vendorId,
        fiscalYear: project.fiscalYear,
        amount,
        expenseDate,
        category,
        description,
        referenceNumber,
        status,
        createdBy: user.id,
      });

      await store.appendAuditLog({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        departmentId: project.departmentId,
        action: 'RECORD_EXPENDITURE',
        entityType: 'expenditure',
        entityId: created.id,
        summary: `Recorded expenditure ${created.referenceNumber} ($${created.amount.toFixed(2)}) for "${project.title}"`,
      });

      res.status(201).json({ expenditure: created });
    })
  );

  router.patch(
    '/expenditures/:id',
    requireAuth,
    requireRoles('admin', 'department_staff'),
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const id = parseIdParam(req.params.id, 'expenditure ID');
      const existing = await store.getExpenditureById(id);
      if (!existing) {
        res.status(404).json({ error: 'Expenditure record not found.' });
        return;
      }
      if (existing.isArchived) {
        throw new ValidationError('Archived expenditure records cannot be edited.');
      }

      const access = assertDepartmentWriteAccess(user, existing.departmentId);
      if (!access.ok) {
        res.status(access.status).json({ error: access.error });
        return;
      }

      const status = req.body?.status as ExpenditureStatus | undefined;
      if (status !== undefined) {
        if (!['pending', 'approved', 'paid'].includes(status)) {
          throw new ValidationError('Invalid expenditure status.');
        }
        if (user.role === 'department_staff' && status !== 'pending') {
          res.status(403).json({
            error: 'Only administrators can approve or mark expenditures as paid.',
          });
          return;
        }
      }

      const amount =
        req.body?.amount !== undefined
          ? validatePositiveMoney(req.body.amount, 'Amount')
          : undefined;
      const expenseDate =
        req.body?.expenseDate !== undefined
          ? validateIsoDate(req.body.expenseDate, 'Expense date')
          : undefined;
      const category =
        req.body?.category !== undefined
          ? validateNonEmptyString(req.body.category, 'Category', 100)
          : undefined;
      const description =
        req.body?.description !== undefined
          ? validateNonEmptyString(req.body.description, 'Description', 500)
          : undefined;
      const referenceNumber =
        req.body?.referenceNumber !== undefined
          ? validateNonEmptyString(req.body.referenceNumber, 'Reference number', 80)
          : undefined;

      const updated = await store.updateExpenditure(id, {
        amount,
        expenseDate,
        category,
        description,
        referenceNumber,
        status,
      });

      await store.appendAuditLog({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        departmentId: existing.departmentId,
        action: status && status !== existing.status ? `EXPENDITURE_${status.toUpperCase()}` : 'UPDATE_EXPENDITURE',
        entityType: 'expenditure',
        entityId: id,
        summary: `Updated expenditure ${updated?.referenceNumber} ($${updated?.amount.toFixed(2)})`,
      });

      res.json({ expenditure: updated });
    })
  );

  router.post(
    '/expenditures/:id/archive',
    requireAuth,
    requireRoles('admin', 'department_staff'),
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const id = parseIdParam(req.params.id, 'expenditure ID');
      const existing = await store.getExpenditureById(id);
      if (!existing) {
        res.status(404).json({ error: 'Expenditure record not found.' });
        return;
      }

      const access = assertDepartmentWriteAccess(user, existing.departmentId);
      if (!access.ok) {
        res.status(access.status).json({ error: access.error });
        return;
      }
      if (user.role === 'department_staff' && existing.status === 'paid') {
        res.status(403).json({
          error: 'Paid expenditures can only be archived by an administrator.',
        });
        return;
      }

      const archived = await store.archiveExpenditure(id);
      await store.appendAuditLog({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        departmentId: existing.departmentId,
        action: 'ARCHIVE_EXPENDITURE',
        entityType: 'expenditure',
        entityId: id,
        summary: `Archived expenditure ${existing.referenceNumber} ($${existing.amount.toFixed(2)}) — history preserved`,
      });

      res.json({ expenditure: archived });
    })
  );

  // ---- REVENUES ----
  router.get(
    '/revenues',
    requireAuth,
    requireInternal,
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const list = await store.listRevenues();
      const scoped =
        user.role === 'department_staff'
          ? list.filter((r) => r.departmentId === user.departmentId)
          : list;
      res.json({ revenues: scoped });
    })
  );

  router.post(
    '/revenues',
    requireAuth,
    requireRoles('admin', 'department_staff'),
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      let departmentId: number | null = null;
      if (
        req.body?.departmentId !== undefined &&
        req.body.departmentId !== null &&
        req.body.departmentId !== ''
      ) {
        departmentId = parseIdParam(String(req.body.departmentId), 'department ID');
      } else if (user.role === 'department_staff') {
        departmentId = user.departmentId;
      }

      if (departmentId !== null) {
        const access = assertDepartmentWriteAccess(user, departmentId);
        if (!access.ok) {
          res.status(access.status).json({ error: access.error });
          return;
        }
      } else if (user.role !== 'admin') {
        res.status(403).json({ error: 'Only admins can record general fund revenue.' });
        return;
      }

      const fiscalYear = validateFiscalYear(req.body?.fiscalYear);
      const source = validateNonEmptyString(req.body?.source, 'Revenue source', 160);
      const category = validateNonEmptyString(req.body?.category, 'Category', 100);
      const amount = validatePositiveMoney(req.body?.amount, 'Revenue amount');
      const receivedDate = validateIsoDate(req.body?.receivedDate, 'Date');
      const notes = validateOptionalString(req.body?.notes, 1000);
      const status = (req.body?.status === 'received' ? 'received' : 'expected') as RevenueStatus;
      const isPublic = user.role === 'admin' ? Boolean(req.body?.isPublic) : false;

      const created = await store.createRevenue({
        departmentId,
        fiscalYear,
        source,
        category,
        amount,
        receivedDate,
        notes,
        status,
        isPublic,
        createdBy: user.id,
      });

      await store.appendAuditLog({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        departmentId,
        action: 'CREATE_REVENUE',
        entityType: 'revenue',
        entityId: created.id,
        summary: `Recorded ${created.status} revenue "${created.source}" ($${created.amount.toFixed(2)})`,
      });

      res.status(201).json({ revenue: created });
    })
  );

  router.patch(
    '/revenues/:id',
    requireAuth,
    requireRoles('admin', 'department_staff'),
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const id = parseIdParam(req.params.id, 'revenue ID');
      const existing = await store.getRevenueById(id);
      if (!existing) {
        res.status(404).json({ error: 'Revenue record not found.' });
        return;
      }
      if (existing.departmentId !== null) {
        const access = assertDepartmentWriteAccess(user, existing.departmentId);
        if (!access.ok) {
          res.status(access.status).json({ error: access.error });
          return;
        }
      } else if (user.role !== 'admin') {
        res.status(403).json({ error: 'Only admins can modify general fund revenue.' });
        return;
      }

      const status = req.body?.status as RevenueStatus | undefined;
      if (status !== undefined && !['expected', 'received'].includes(status)) {
        throw new ValidationError('Invalid revenue status.');
      }

      const isPublic =
        req.body?.isPublic !== undefined
          ? user.role === 'admin'
            ? Boolean(req.body.isPublic)
            : existing.isPublic
          : undefined;

      const updated = await store.updateRevenue(id, {
        source:
          req.body?.source !== undefined
            ? validateNonEmptyString(req.body.source, 'Source', 160)
            : undefined,
        category:
          req.body?.category !== undefined
            ? validateNonEmptyString(req.body.category, 'Category', 100)
            : undefined,
        amount:
          req.body?.amount !== undefined
            ? validatePositiveMoney(req.body.amount, 'Amount')
            : undefined,
        receivedDate:
          req.body?.receivedDate !== undefined
            ? validateIsoDate(req.body.receivedDate, 'Date')
            : undefined,
        notes:
          req.body?.notes !== undefined
            ? validateOptionalString(req.body.notes, 1000)
            : undefined,
        status,
        isPublic,
      });

      await store.appendAuditLog({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        departmentId: existing.departmentId,
        action: 'UPDATE_REVENUE',
        entityType: 'revenue',
        entityId: id,
        summary: `Updated revenue "${updated?.source}" ($${updated?.amount.toFixed(2)})`,
      });

      res.json({ revenue: updated });
    })
  );

  router.post(
    '/revenues/:id/archive',
    requireAuth,
    requireRoles('admin', 'department_staff'),
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const id = parseIdParam(req.params.id, 'revenue ID');
      const existing = await store.getRevenueById(id);
      if (!existing) {
        res.status(404).json({ error: 'Revenue record not found.' });
        return;
      }
      if (existing.departmentId !== null) {
        const access = assertDepartmentWriteAccess(user, existing.departmentId);
        if (!access.ok) {
          res.status(access.status).json({ error: access.error });
          return;
        }
      } else if (user.role !== 'admin') {
        res.status(403).json({ error: 'Only admins can archive general fund revenue.' });
        return;
      }

      const archived = await store.archiveRevenue(id);
      await store.appendAuditLog({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        departmentId: existing.departmentId,
        action: 'ARCHIVE_REVENUE',
        entityType: 'revenue',
        entityId: id,
        summary: `Archived revenue "${existing.source}" ($${existing.amount.toFixed(2)})`,
      });
      res.json({ revenue: archived });
    })
  );

  // ---- VENDORS & PROCUREMENTS ----
  router.get(
    '/vendors',
    requireAuth,
    requireInternal,
    asyncHandler(async (_req, res) => {
      const vendors = await store.listVendors();
      res.json({ vendors });
    })
  );

  router.post(
    '/vendors',
    requireAuth,
    requireRoles('admin', 'department_staff'),
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const name = validateNonEmptyString(req.body?.name, 'Vendor name', 180);
      const registrationCode = validateNonEmptyString(
        req.body?.registrationCode,
        'Registration code',
        64
      );
      const category = validateNonEmptyString(req.body?.category, 'Category', 120);
      const contactName = validateNonEmptyString(req.body?.contactName, 'Contact name', 120);
      const contactEmail = validateNonEmptyString(req.body?.contactEmail, 'Contact email', 190);
      const contactPhone = validateNonEmptyString(req.body?.contactPhone, 'Contact phone', 40);

      const created = await store.createVendor({
        name,
        registrationCode,
        category,
        contactName,
        contactEmail,
        contactPhone,
      });

      await store.appendAuditLog({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        departmentId: user.departmentId,
        action: 'CREATE_VENDOR',
        entityType: 'vendor',
        entityId: created.id,
        summary: `Registered vendor "${created.name}" (${created.registrationCode})`,
      });

      res.status(201).json({ vendor: created });
    })
  );

  router.post(
    '/vendors/:id/archive',
    requireAuth,
    requireRoles('admin'),
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const id = parseIdParam(req.params.id, 'vendor ID');
      const archived = await store.archiveVendor(id);
      if (!archived) {
        res.status(404).json({ error: 'Vendor not found.' });
        return;
      }
      await store.appendAuditLog({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        departmentId: null,
        action: 'ARCHIVE_VENDOR',
        entityType: 'vendor',
        entityId: id,
        summary: `Archived vendor "${archived.name}"`,
      });
      res.json({ vendor: archived });
    })
  );

  router.get(
    '/procurements',
    requireAuth,
    requireInternal,
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const list = await store.listProcurements();
      const scoped =
        user.role === 'department_staff'
          ? list.filter((p) => p.departmentId === user.departmentId)
          : list;
      res.json({ procurements: scoped });
    })
  );

  router.post(
    '/procurements',
    requireAuth,
    requireRoles('admin', 'department_staff'),
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const requestedDeptRaw = req.body?.departmentId;
      const departmentId =
        requestedDeptRaw !== undefined && requestedDeptRaw !== null && requestedDeptRaw !== ''
          ? parseIdParam(String(requestedDeptRaw), 'department ID')
          : user.role === 'department_staff' && user.departmentId !== null
            ? user.departmentId
            : parseIdParam('', 'department ID');

      const access = assertDepartmentWriteAccess(user, departmentId);
      if (!access.ok) {
        res.status(access.status).json({ error: access.error });
        return;
      }

      const projectId =
        req.body?.projectId !== undefined && req.body.projectId !== null && req.body.projectId !== ''
          ? parseIdParam(String(req.body.projectId), 'project ID')
          : null;
      if (projectId !== null) {
        const proj = await store.getProjectById(projectId);
        if (!proj || proj.departmentId !== departmentId) {
          throw new ValidationError('Linked project must belong to the same department.');
        }
      }

      const vendorId =
        req.body?.vendorId !== undefined && req.body.vendorId !== null && req.body.vendorId !== ''
          ? parseIdParam(String(req.body.vendorId), 'vendor ID')
          : null;

      const fiscalYear = validateFiscalYear(req.body?.fiscalYear);
      const title = validateNonEmptyString(req.body?.title, 'Procurement title', 200);
      const referenceNumber = validateNonEmptyString(
        req.body?.referenceNumber,
        'Reference number',
        80
      );
      const estimatedAmount = validatePositiveMoney(
        req.body?.estimatedAmount,
        'Estimated amount'
      );
      const notes = validateOptionalString(req.body?.notes, 1000);

      const created = await store.createProcurement({
        departmentId,
        projectId,
        vendorId,
        fiscalYear,
        title,
        referenceNumber,
        estimatedAmount,
        notes,
        createdBy: user.id,
      });

      await store.appendAuditLog({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        departmentId,
        action: 'CREATE_PROCUREMENT',
        entityType: 'procurement',
        entityId: created.id,
        summary: `Created procurement ${created.referenceNumber} "${created.title}"`,
      });

      res.status(201).json({ procurement: created });
    })
  );

  router.post(
    '/procurements/:id/award',
    requireAuth,
    requireRoles('admin', 'department_staff'),
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const id = parseIdParam(req.params.id, 'procurement ID');
      const existing = await store.getProcurementById(id);
      if (!existing) {
        res.status(404).json({ error: 'Procurement record not found.' });
        return;
      }

      const access = assertDepartmentWriteAccess(user, existing.departmentId);
      if (!access.ok) {
        res.status(access.status).json({ error: access.error });
        return;
      }

      const vendorId = parseIdParam(String(req.body?.vendorId ?? ''), 'vendor ID');
      const vendor = await store.getVendorById(vendorId);
      if (!vendor || vendor.isArchived) {
        throw new ValidationError('Active vendor must be selected to award a procurement.');
      }

      const awardedAmount = validatePositiveMoney(req.body?.awardedAmount, 'Awarded amount');
      const awardDate = validateIsoDate(req.body?.awardDate, 'Award date');

      const awarded = await store.awardProcurement(id, {
        vendorId,
        awardedAmount,
        awardDate,
      });

      await store.appendAuditLog({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        departmentId: existing.departmentId,
        action: 'AWARD_PROCUREMENT',
        entityType: 'procurement',
        entityId: id,
        summary: `Awarded procurement ${existing.referenceNumber} to ${vendor.name} ($${awardedAmount.toFixed(2)}) without auto-creating expenditure`,
      });

      res.json({ procurement: awarded });
    })
  );

  router.post(
    '/procurements/:id/archive',
    requireAuth,
    requireRoles('admin', 'department_staff'),
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const id = parseIdParam(req.params.id, 'procurement ID');
      const existing = await store.getProcurementById(id);
      if (!existing) {
        res.status(404).json({ error: 'Procurement not found.' });
        return;
      }
      const access = assertDepartmentWriteAccess(user, existing.departmentId);
      if (!access.ok) {
        res.status(access.status).json({ error: access.error });
        return;
      }

      const archived = await store.archiveProcurement(id);
      await store.appendAuditLog({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        departmentId: existing.departmentId,
        action: 'ARCHIVE_PROCUREMENT',
        entityType: 'procurement',
        entityId: id,
        summary: `Archived procurement ${existing.referenceNumber}`,
      });
      res.json({ procurement: archived });
    })
  );

  // ---- REPORTS & CSV EXPORTS (Same filters and permissions) ----
  router.get(
    '/reports',
    requireAuth,
    requireInternal,
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const fyFilter = parseFiscalYearFilter(req.query.fiscalYear);
      const deptParam = req.query.departmentId ? Number(req.query.departmentId) : null;
      const snapshot = await store.getComputeSnapshot();
      const procurements = await store.listProcurements();

      const allowedDeptId =
        user.role === 'department_staff'
          ? user.departmentId
          : deptParam && Number.isInteger(deptParam)
            ? deptParam
            : null;

      const deptMap = new Map(snapshot.departments.map((d) => [d.id, d.name]));

      const projectRows = snapshot.projects
        .filter(
          (p) =>
            !p.isArchived &&
            (fyFilter === 'all' || p.fiscalYear === fyFilter) &&
            (allowedDeptId === null || p.departmentId === allowedDeptId)
        )
        .map((p) => {
          const totals = computeProjectTotals({
            projectId: p.id,
            allocations: snapshot.allocations,
            expenditures: snapshot.expenditures,
          });
          const utilizationPct =
            totals.approvedBudget > 0
              ? Math.round((totals.recordedExpenditure / totals.approvedBudget) * 1000) / 10
              : 0;
          return {
            id: p.id,
            fiscalYear: p.fiscalYear,
            departmentId: p.departmentId,
            departmentName: deptMap.get(p.departmentId) ?? 'Unknown',
            title: p.title,
            status: p.status,
            isPublic: p.isPublic,
            approvedBudget: totals.approvedBudget,
            recordedExpenditure: totals.recordedExpenditure,
            variance: subtractMoney(totals.approvedBudget, totals.recordedExpenditure),
            utilizationPct,
          };
        });

      const budgetRows = snapshot.budgets
        .filter(
          (b) =>
            b.status !== 'archived' &&
            (fyFilter === 'all' || b.fiscalYear === fyFilter) &&
            (allowedDeptId === null || b.departmentId === allowedDeptId)
        )
        .map((b) => {
          const allocated = sumMoney(
            snapshot.allocations
              .filter((a) => !a.isArchived && a.budgetId === b.id)
              .map((a) => a.amount)
          );
          return {
            id: b.id,
            fiscalYear: b.fiscalYear,
            departmentName: deptMap.get(b.departmentId) ?? 'Unknown',
            title: b.title,
            status: b.status,
            amount: b.amount,
            allocatedAmount: allocated,
            unallocatedAmount: subtractMoney(b.amount, allocated),
          };
        });

      const revenueRows = snapshot.revenues.filter(
        (r) =>
          !r.isArchived &&
          (fyFilter === 'all' || r.fiscalYear === fyFilter) &&
          (allowedDeptId === null || r.departmentId === allowedDeptId)
      );

      const procurementRows = procurements.filter(
        (pr) =>
          !pr.isArchived &&
          (fyFilter === 'all' || pr.fiscalYear === fyFilter) &&
          (allowedDeptId === null || pr.departmentId === allowedDeptId)
      );

      res.json({
        fiscalYear: fyFilter,
        departmentId: allowedDeptId,
        projectVariance: projectRows,
        budgets: budgetRows,
        revenues: revenueRows,
        procurements: procurementRows,
      });
    })
  );

  router.get(
    '/reports/export',
    requireAuth,
    requireInternal,
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const fyFilter = parseFiscalYearFilter(req.query.fiscalYear);
      const reportType = String(req.query.type || 'projects');
      const deptParam = req.query.departmentId ? Number(req.query.departmentId) : null;
      const allowedDeptId =
        user.role === 'department_staff'
          ? user.departmentId
          : deptParam && Number.isInteger(deptParam)
            ? deptParam
            : null;

      const snapshot = await store.getComputeSnapshot();
      const deptMap = new Map(snapshot.departments.map((d) => [d.id, d.name]));

      let csv = '';
      if (reportType === 'revenues') {
        const list = snapshot.revenues.filter(
          (r) =>
            !r.isArchived &&
            (fyFilter === 'all' || r.fiscalYear === fyFilter) &&
            (allowedDeptId === null || r.departmentId === allowedDeptId)
        );
        csv = buildCsv(
          ['ID', 'Fiscal Year', 'Department', 'Source', 'Category', 'Amount', 'Date', 'Status'],
          list.map((r) => [
            r.id,
            r.fiscalYear,
            r.departmentId ? deptMap.get(r.departmentId) ?? 'Department' : 'General Fund',
            r.source,
            r.category,
            r.amount.toFixed(2),
            r.receivedDate,
            r.status,
          ])
        );
      } else if (reportType === 'procurements') {
        const list = (await store.listProcurements()).filter(
          (p) =>
            !p.isArchived &&
            (fyFilter === 'all' || p.fiscalYear === fyFilter) &&
            (allowedDeptId === null || p.departmentId === allowedDeptId)
        );
        csv = buildCsv(
          [
            'Reference',
            'Fiscal Year',
            'Department',
            'Title',
            'Vendor',
            'Estimated Amount',
            'Awarded Amount',
            'Status',
            'Award Date',
          ],
          list.map((p) => [
            p.referenceNumber,
            p.fiscalYear,
            deptMap.get(p.departmentId) ?? 'Unknown',
            p.title,
            p.vendorName ?? 'Unassigned',
            p.estimatedAmount.toFixed(2),
            p.awardedAmount !== null ? p.awardedAmount.toFixed(2) : '',
            p.status,
            p.awardDate ?? '',
          ])
        );
      } else {
        const list = snapshot.projects.filter(
          (p) =>
            !p.isArchived &&
            (fyFilter === 'all' || p.fiscalYear === fyFilter) &&
            (allowedDeptId === null || p.departmentId === allowedDeptId)
        );
        csv = buildCsv(
          [
            'Project ID',
            'Fiscal Year',
            'Department',
            'Title',
            'Status',
            'Approved Budget',
            'Recorded Expenditure',
            'Remaining Variance',
            'Public',
          ],
          list.map((p) => {
            const t = computeProjectTotals({
              projectId: p.id,
              allocations: snapshot.allocations,
              expenditures: snapshot.expenditures,
            });
            return [
              p.id,
              p.fiscalYear,
              deptMap.get(p.departmentId) ?? 'Unknown',
              p.title,
              p.status,
              t.approvedBudget.toFixed(2),
              t.recordedExpenditure.toFixed(2),
              subtractMoney(t.approvedBudget, t.recordedExpenditure).toFixed(2),
              p.isPublic ? 'Yes' : 'No',
            ];
          })
        );
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="govtrack-${reportType}-fy-${fyFilter}.csv"`
      );
      res.send(csv);
    })
  );

  // ---- TRANSPARENT RULE-BASED SPENDING REVIEW INDICATORS ----
  router.get(
    '/review-flags',
    requireAuth,
    requireInternal,
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const snapshot = await store.getComputeSnapshot();
      const allFlags = evaluateSpendingReviewFlags({
        departments: snapshot.departments,
        projects: snapshot.projects,
        allocations: snapshot.allocations,
        expenditures: snapshot.expenditures,
        reviews: snapshot.flagReviews,
      });

      const scoped =
        user.role === 'department_staff'
          ? allFlags.filter((f) => f.departmentId === user.departmentId)
          : allFlags;

      res.json({ flags: scoped });
    })
  );

  router.post(
    '/review-flags/:flagId/review',
    requireAuth,
    requireRoles('admin', 'department_staff'),
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const flagId = decodeURIComponent(String(req.params.flagId || ''));
      const reviewNote = validateNonEmptyString(req.body?.reviewNote, 'Review note', 1000);

      const snapshot = await store.getComputeSnapshot();
      const allFlags = evaluateSpendingReviewFlags({
        departments: snapshot.departments,
        projects: snapshot.projects,
        allocations: snapshot.allocations,
        expenditures: snapshot.expenditures,
        reviews: snapshot.flagReviews,
      });
      const target = allFlags.find((f) => f.id === flagId);
      if (!target) {
        res.status(404).json({ error: 'Spending review flag not found.' });
        return;
      }

      const access = assertDepartmentWriteAccess(user, target.departmentId);
      if (!access.ok) {
        res.status(access.status).json({ error: access.error });
        return;
      }

      const saved = await store.saveFlagReview({
        flagId,
        reviewedBy: user.id,
        reviewedByName: user.name,
        reviewNote,
      });

      await store.appendAuditLog({
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        departmentId: target.departmentId,
        action: 'REVIEW_SPENDING_FLAG',
        entityType: 'review_flag',
        entityId: target.entityId,
        summary: `Marked rule flag "${target.ruleTitle}" as reviewed with human note (underlying record unmodified)`,
        details: { flagId, reviewNote },
      });

      res.json({ review: saved });
    })
  );

  // ---- APPEND-ONLY AUDIT TRAIL ----
  router.get(
    '/audit-logs',
    requireAuth,
    requireInternal,
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const all = await store.listAuditLogs();
      // Admins and Auditors see complete internal audit history; Department Staff see only their department
      const scoped =
        user.role === 'admin' || user.role === 'auditor'
          ? all
          : all.filter((entry) => entry.departmentId === user.departmentId);
      res.json({ logs: scoped });
    })
  );

  // ---- USER MANAGEMENT (Admin Only) ----
  router.get(
    '/users',
    requireAuth,
    requireRoles('admin'),
    asyncHandler(async (_req, res) => {
      const users = await store.listUsers();
      res.json({ users });
    })
  );

  router.post(
    '/users',
    requireAuth,
    requireRoles('admin'),
    asyncHandler(async (req, res) => {
      const actor = req.currentUser!;
      const name = validateNonEmptyString(req.body?.name, 'Full name', 120);
      const email = validateNonEmptyString(req.body?.email, 'Email', 190).toLowerCase();
      if (!email.includes('@')) throw new ValidationError('Invalid email address.');
      const password = validateNonEmptyString(req.body?.password, 'Password', 200);
      if (password.length < 8) {
        throw new ValidationError('Password must be at least 8 characters long.');
      }

      const role = req.body?.role as UserRole;
      if (!['admin', 'department_staff', 'auditor', 'citizen'].includes(role)) {
        throw new ValidationError('Invalid user role.');
      }

      let departmentId: number | null = null;
      if (role === 'department_staff') {
        departmentId = parseIdParam(String(req.body?.departmentId ?? ''), 'department ID');
        const dept = await store.getDepartmentById(departmentId);
        if (!dept || dept.isArchived) {
          throw new ValidationError('Department staff must be assigned to an active department.');
        }
      }

      const created = await store.createUser({
        name,
        email,
        passwordHash: hashPassword(password),
        role,
        departmentId,
        isActive: true,
      });

      await store.appendAuditLog({
        actorUserId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        departmentId,
        action: 'CREATE_USER',
        entityType: 'user',
        entityId: created.id,
        summary: `Created user account ${created.email} with role ${created.role}`,
      });

      res.status(201).json({ user: created });
    })
  );

  router.patch(
    '/users/:id',
    requireAuth,
    requireRoles('admin'),
    asyncHandler(async (req, res) => {
      const actor = req.currentUser!;
      const id = parseIdParam(req.params.id, 'user ID');
      const existing = await store.findUserById(id);
      if (!existing) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      const role = req.body?.role as UserRole | undefined;
      if (role !== undefined && !['admin', 'department_staff', 'auditor', 'citizen'].includes(role)) {
        throw new ValidationError('Invalid role.');
      }
      const nextRole = role ?? existing.role;

      let departmentId = existing.departmentId;
      if (nextRole === 'department_staff') {
        if (req.body?.departmentId !== undefined) {
          departmentId = parseIdParam(String(req.body.departmentId), 'department ID');
        }
        if (departmentId === null) {
          throw new ValidationError('Department staff must have an assigned department.');
        }
      } else {
        departmentId = null;
      }

      const isActive =
        req.body?.isActive !== undefined ? Boolean(req.body.isActive) : existing.isActive;
      if (id === actor.id && !isActive) {
        throw new ValidationError('You cannot deactivate your own currently signed-in account.');
      }

      const updated = await store.updateUser(id, {
        name:
          req.body?.name !== undefined
            ? validateNonEmptyString(req.body.name, 'Full name', 120)
            : undefined,
        role: nextRole,
        departmentId,
        isActive,
      });

      await store.appendAuditLog({
        actorUserId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        departmentId,
        action: 'UPDATE_USER',
        entityType: 'user',
        entityId: id,
        summary: `Updated user ${existing.email} (role: ${nextRole}, active: ${isActive})`,
      });

      res.json({ user: updated });
    })
  );

  // Error handler for validation & unexpected errors (never leaks stack/secrets)
  router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ValidationError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    const msg = err instanceof Error ? err.message : 'Unexpected server error';
    if (msg.includes('Duplicate entry')) {
      res.status(400).json({ error: 'A record with that unique code or reference already exists.' });
      return;
    }
    console.error('[API Error]', err);
    res.status(500).json({ error: 'An internal server error occurred.' });
  });

  return router;
}
