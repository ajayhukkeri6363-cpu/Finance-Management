# GovTrack AI — Public Finance & Budget Transparency Platform

> **Classroom Demonstration Notice:** GovTrack AI is a student mini project built for educational demonstration of public finance management, budget transparency, and expenditure tracking. It is **not** an official government service. All seeded departments, budgets, projects, vendors, and figures are fictional examples, and rule-based spending review indicators require human review rather than proving fraud.

---

## Architecture Overview

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Chart.js (`chart.js` + `react-chartjs-2`), and accessible HTML data table alternatives.
- **Backend:** Node.js, Express, TypeScript (`server.ts`, `server/routes.ts`, `server/auth.ts`, `server/dataStore.ts`).
- **Shared Pure Domain Logic:** `shared/financeRules.ts` implements decimal-safe cent arithmetic, allocation remaining-balance validation, non-double-counting aggregation math, CSV formula-safe escaping, and the deterministic rule-based spending review engine.
- **Database:** MySQL 8 (`db/schema.sql`, `db/migrate.ts`) accessed exclusively by the server via environment variables.
  - **Local Development Mode:** When `NODE_ENV !== 'production'` and MySQL environment variables are not configured, the server boots `DemoDataStore` with clearly labeled fictional classroom seed data.
  - **Production Safety:** In `NODE_ENV=production`, the server **never** falls back to in-memory storage; it requires `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, and a strong `SESSION_SECRET` or exits immediately on startup.

---

## Roles & Server-Side Access Control

All permissions are enforced in Express API handlers (`server/routes.ts` & `server/auth.ts`) and data queries:

| Role | Capabilities & Boundaries |
| :--- | :--- |
| **Admin** | Full management of users, departments, budgets (including approval & archiving), fund allocations, projects, expenditures, revenues, vendors, procurements, public portal publication toggles, spending review notes, and complete audit history. |
| **Department Staff** | Scoped strictly to their assigned `departmentId`. Can create/edit draft budgets, allocate funds from approved budgets in their department, manage department projects, record expenditures/revenues/procurements in their department, and mark department review flags reviewed. Cannot approve budgets, publish items publicly, manage users, or access other departments. |
| **Auditor** | Read-only access across all internal departments, budgets, projects, ledgers, procurements, reports, CSV exports, spending review indicators, and the complete audit trail. Denied all mutations (`403 Forbidden`). |
| **Citizen / Anonymous** | Can browse **only** records explicitly marked `isPublic = true` (and approved) via `/api/public/*`. Public self-registration (`POST /api/auth/register`) always forces `role = 'citizen'` and `departmentId = null`. Denied all internal `/api/*` endpoints (`403 Forbidden`). |

---

## Implemented Modules

1. **Budget Dashboard:** Approved budget, project allocations, recorded expenditure, remaining budget, and received revenue by fiscal year with Chart.js visualizations and tabular breakdowns.
2. **Department Management:** Create, view, edit, and archive departments (Admin).
3. **Budget Planning:** Department budgets by fiscal year with currency, notes, draft/approved/archived status, and public portal visibility.
4. **Fund Allocation:** Link approved budgets to department projects; server validates approved status and prevents over-allocation inside transactions.
5. **Project Tracking:** Description, department, allocated budget, location, start/target dates, status, progress percentage, and public flag.
6. **Expenditure Ledger:** Project spending with vendor, reference number, category, date, creator, and status. History is preserved via archival (no hard-delete).
7. **Revenue Tracking:** Source, category, amount, date, fiscal year, department/general fund, notes, status, and archival.
8. **Procurement & Vendors:** Internal vendor registry (contacts withheld from public APIs) and procurement solicitations. Awarding a contract records the award without auto-creating an expenditure.
9. **Reports & Charts:** Fiscal-year and department-filtered Chart.js charts, accessible tables, and CSV exports respecting the same filters and user permissions.
10. **Public Transparency Portal:** Anonymous/citizen view displaying only explicitly published projects, budgets, and approved public summaries.
11. **Append-Only Audit Trail:** Logs creations, edits, approvals, fund allocations, contract awards, archival, publication changes, and review notes without storing passwords or secrets.
12. **Spending Review Indicators:** Transparent, rule-based checks (`BUDGET_NEARING_THRESHOLD` >= 85%, `BUDGET_EXCEEDED` > 100%, `DUPLICATE_REFERENCE`, `SHARP_EXPENSE_SPIKE` >= 2.5x department peer baseline with >= 3 peers, `DELAYED_PROJECT`). Authorized staff can record human review notes without modifying financial records.

---

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run unit tests for financial math, RBAC, and rule indicators:
   ```bash
   npm test
   ```
3. Start the full-stack development server (Express + Vite on port 3000):
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000`. In local development without MySQL configured, the Sign In dialog displays classroom demonstration accounts for testing all four roles.

---

## MySQL 8 Setup & Environment Variables

Copy `.env.example` to `.env` and supply real values:

```env
NODE_ENV="production"
PORT=3000
APP_URL="https://your-deployed-url.example.com"
SESSION_SECRET="<64-hex-character-random-secret>"
FIRST_ADMIN_SETUP_TOKEN="<optional-one-time-setup-token>"

MYSQL_HOST="your-mysql8-host"
MYSQL_PORT=3306
MYSQL_USER="govtrack_user"
MYSQL_PASSWORD="your-strong-password"
MYSQL_DATABASE="govtrack_ai"
MYSQL_SSL="true"
```

### Database Migrations

Create the MySQL 8 database (e.g., `CREATE DATABASE govtrack_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`) and run the migration script:

```bash
npm run db:migrate
```

### Creating the First Admin (No Default Password)

GovTrack AI never ships a hardcoded admin password for production. Provision the first Admin in one of two ways:

1. **Recommended CLI Script:**
   ```bash
   npm run create-admin
   ```
   Follow the interactive prompts (or set `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` in the shell).
2. **One-Time Web Setup Token:** Set `FIRST_ADMIN_SETUP_TOKEN` in your server environment. When zero active admins exist in MySQL, the Sign In dialog shows a **First Admin Setup** tab that validates the token and creates the initial Admin account. Once created, the endpoint permanently locks (`403`).

---

## Production Build & Deployment

1. Build the frontend bundle:
   ```bash
   npm run build
   ```
2. Ensure MySQL 8 is reachable, run `npm run db:migrate`, and create the first Admin (`npm run create-admin`).
3. Start the server in production mode (e.g., via `tsx server.ts` or your Node host process manager with `NODE_ENV=production`):
   ```bash
   NODE_ENV=production npx tsx server.ts
   ```
4. Connect your hosting platform (Cloud Run, Railway, Render, Fly.io, or a VPS) to a managed MySQL 8 instance (such as Cloud SQL for MySQL 8, Amazon RDS MySQL 8, or PlanetScale/DigitalOcean Managed MySQL) with TLS enabled (`MYSQL_SSL=true`).
