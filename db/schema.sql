-- GovTrack AI — MySQL 8 Database Schema
-- Classroom demonstration schema for public finance management & transparency.
-- Uses DECIMAL(15,2) for monetary integrity, foreign keys with ON DELETE RESTRICT
-- to preserve financial history, and explicit archival/publication flags.

CREATE TABLE IF NOT EXISTS departments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(24) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  is_archived TINYINT(1) NOT NULL DEFAULT 0,
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_departments_archived (is_archived)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'department_staff', 'auditor', 'citizen') NOT NULL DEFAULT 'citizen',
  department_id INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  INDEX idx_users_role (role),
  INDEX idx_users_department (department_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS budgets (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  department_id INT UNSIGNED NOT NULL,
  fiscal_year SMALLINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  notes TEXT NOT NULL,
  status ENUM('draft', 'approved', 'archived') NOT NULL DEFAULT 'draft',
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  approved_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_budgets_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  CONSTRAINT fk_budgets_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_budgets_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_budgets_amount_positive CHECK (amount > 0),
  INDEX idx_budgets_fy_status (fiscal_year, status),
  INDEX idx_budgets_department (department_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  department_id INT UNSIGNED NOT NULL,
  fiscal_year SMALLINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(180) NOT NULL,
  start_date DATE NOT NULL,
  target_end_date DATE NOT NULL,
  status ENUM('planned', 'active', 'delayed', 'completed', 'archived') NOT NULL DEFAULT 'planned',
  progress_percent TINYINT UNSIGNED NOT NULL DEFAULT 0,
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  is_archived TINYINT(1) NOT NULL DEFAULT 0,
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_projects_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  CONSTRAINT fk_projects_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_projects_progress CHECK (progress_percent <= 100),
  INDEX idx_projects_dept_fy (department_id, fiscal_year),
  INDEX idx_projects_public (is_public, is_archived)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_allocations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  budget_id INT UNSIGNED NOT NULL,
  project_id INT UNSIGNED NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  notes TEXT NOT NULL,
  is_archived TINYINT(1) NOT NULL DEFAULT 0,
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_allocations_budget FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE RESTRICT,
  CONSTRAINT fk_allocations_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT,
  CONSTRAINT fk_allocations_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_allocations_amount CHECK (amount > 0),
  INDEX idx_allocations_budget (budget_id, is_archived),
  INDEX idx_allocations_project (project_id, is_archived)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vendors (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  registration_code VARCHAR(64) NOT NULL UNIQUE,
  category VARCHAR(120) NOT NULL,
  contact_name VARCHAR(120) NOT NULL,
  contact_email VARCHAR(190) NOT NULL,
  contact_phone VARCHAR(40) NOT NULL,
  is_archived TINYINT(1) NOT NULL DEFAULT 0,
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vendors_archived (is_archived)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expenditures (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id INT UNSIGNED NOT NULL,
  department_id INT UNSIGNED NOT NULL,
  vendor_id INT UNSIGNED NULL,
  fiscal_year SMALLINT UNSIGNED NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  expense_date DATE NOT NULL,
  category VARCHAR(100) NOT NULL,
  description VARCHAR(500) NOT NULL,
  reference_number VARCHAR(80) NOT NULL,
  status ENUM('pending', 'approved', 'paid', 'archived') NOT NULL DEFAULT 'pending',
  is_archived TINYINT(1) NOT NULL DEFAULT 0,
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_expenditures_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT,
  CONSTRAINT fk_expenditures_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  CONSTRAINT fk_expenditures_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT,
  CONSTRAINT fk_expenditures_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_expenditures_amount CHECK (amount > 0),
  INDEX idx_expenditures_dept_fy (department_id, fiscal_year),
  INDEX idx_expenditures_project (project_id, is_archived),
  INDEX idx_expenditures_ref (reference_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS revenues (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  department_id INT UNSIGNED NULL,
  fiscal_year SMALLINT UNSIGNED NOT NULL,
  source VARCHAR(160) NOT NULL,
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  received_date DATE NOT NULL,
  notes TEXT NOT NULL,
  status ENUM('expected', 'received', 'archived') NOT NULL DEFAULT 'expected',
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  is_archived TINYINT(1) NOT NULL DEFAULT 0,
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_revenues_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  CONSTRAINT fk_revenues_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_revenues_amount CHECK (amount > 0),
  INDEX idx_revenues_fy_status (fiscal_year, status),
  INDEX idx_revenues_dept (department_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS procurements (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  department_id INT UNSIGNED NOT NULL,
  project_id INT UNSIGNED NULL,
  vendor_id INT UNSIGNED NULL,
  fiscal_year SMALLINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  reference_number VARCHAR(80) NOT NULL UNIQUE,
  estimated_amount DECIMAL(15, 2) NOT NULL,
  awarded_amount DECIMAL(15, 2) NULL,
  status ENUM('open', 'evaluating', 'awarded', 'cancelled', 'archived') NOT NULL DEFAULT 'open',
  award_date DATE NULL,
  notes TEXT NOT NULL,
  is_archived TINYINT(1) NOT NULL DEFAULT 0,
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_procurements_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  CONSTRAINT fk_procurements_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT,
  CONSTRAINT fk_procurements_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT,
  CONSTRAINT fk_procurements_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_procurements_dept_fy (department_id, fiscal_year),
  INDEX idx_procurements_status (status, is_archived)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT UNSIGNED NULL,
  actor_name VARCHAR(120) NOT NULL,
  actor_role VARCHAR(40) NOT NULL,
  department_id INT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id INT UNSIGNED NULL,
  summary VARCHAR(500) NOT NULL,
  details_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_dept (department_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS review_flag_reviews (
  flag_id VARCHAR(140) PRIMARY KEY,
  reviewed_by INT UNSIGNED NOT NULL,
  reviewed_by_name VARCHAR(120) NOT NULL,
  review_note TEXT NOT NULL,
  reviewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_flag_reviews_user FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
