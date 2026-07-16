-- 規程・手続き・統制を Markdown 原本から投影し、組織責任と版履歴へ結ぶ。

CREATE TABLE governance_capabilities (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_org_role_code TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE governance_org_roles (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  assignment_mode TEXT NOT NULL DEFAULT 'manual'
    CHECK (assignment_mode IN ('manual', 'department_manager')),
  cardinality TEXT NOT NULL DEFAULT 'one'
    CHECK (cardinality IN ('one', 'per_department', 'many')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE governance_org_role_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_role_code TEXT NOT NULL,
  employee_id INTEGER NOT NULL,
  department_code TEXT,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  source_document_code TEXT,
  created_by_account_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  revoked_by_account_id INTEGER,
  revoked_at TEXT,
  CHECK (ends_on IS NULL OR starts_on < ends_on)
);

CREATE INDEX idx_governance_role_assignments_role_period
  ON governance_org_role_assignments (org_role_code, starts_on, ends_on);
CREATE INDEX idx_governance_role_assignments_employee
  ON governance_org_role_assignments (employee_id);

CREATE TABLE governance_documents (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('policy', 'procedure', 'guideline', 'control')),
  classification TEXT NOT NULL
    CHECK (classification IN ('public', 'internal', 'confidential', 'restricted')),
  owner_capability_code TEXT NOT NULL,
  steward_org_role_code TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
  current_version_id TEXT,
  source_path TEXT NOT NULL UNIQUE,
  created_by_account_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE governance_document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  version TEXT NOT NULL,
  body_md TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  procedure_json TEXT,
  content_hash TEXT NOT NULL,
  effective_from TEXT,
  effective_to TEXT,
  review_due_on TEXT,
  state TEXT NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft', 'in_review', 'published', 'superseded', 'rejected')),
  created_by_account_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  published_by_account_id INTEGER,
  published_at TEXT,
  UNIQUE (document_id, version),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_from < effective_to)
);

CREATE INDEX idx_governance_versions_document_state
  ON governance_document_versions (document_id, state);

CREATE TABLE governance_document_references (
  version_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (
    kind IN ('capability', 'org_role', 'policy', 'procedure', 'guideline', 'control', 'permission', 'training')
  ),
  code TEXT NOT NULL,
  PRIMARY KEY (version_id, kind, code)
);

CREATE TABLE governance_publication_approvals (
  version_id TEXT NOT NULL,
  org_role_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by_employee_id INTEGER,
  decided_at TEXT,
  comment TEXT,
  PRIMARY KEY (version_id, org_role_code)
);

CREATE TABLE governance_acknowledgements (
  version_id TEXT NOT NULL,
  employee_id INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  acknowledged_at TEXT NOT NULL,
  PRIMARY KEY (version_id, employee_id)
);

INSERT OR IGNORE INTO permissions (key, description, category) VALUES
  ('governance:read', '公開済みの規程・手続き・統制を閲覧する', 'governance'),
  ('governance:read:restricted', '機密又は限定公開の規程を横断閲覧する', 'governance'),
  ('governance:manage', '規程原本、能力、組織ロールと割当を管理する', 'governance'),
  ('governance:review', '候補者となった規程版を審査する', 'governance'),
  ('governance:publish', '審査要件を満たした規程版を公開する', 'governance'),
  ('governance:acknowledge', '適用対象となる規程版の確認を記録する', 'governance');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key IN ('member', 'manager', 'hr', 'admin')
    AND p.key IN ('governance:read', 'governance:acknowledge');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key IN ('manager', 'hr', 'admin') AND p.key = 'governance:review';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'admin'
    AND p.key IN ('governance:read:restricted', 'governance:manage', 'governance:publish');

INSERT OR IGNORE INTO governance_org_roles
  (code, name, description, assignment_mode, cardinality, created_at, updated_at) VALUES
  ('board', '取締役会', '重要規程の制定・改廃を審議する機関', 'manual', 'many', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('representative-director', '代表取締役', '会社を代表して業務執行を統括する責任', 'manual', 'one', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('executive-officer', '担当役員', '担当領域の業務執行を統括する責任', 'manual', 'many', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('department-manager', '部門長', '各部門の業務執行を管理する責任', 'department_manager', 'per_department', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('section-manager', '課長', '各課の業務執行を管理する責任', 'manual', 'many', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('management-meeting', '経営会議', '重要な業務執行事項を審議する機関', 'manual', 'many', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('internal-control-committee', '内部統制委員会', '規程間の齟齬と内部統制上の論点を調整する機関', 'manual', 'many', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('ciso', '最高情報セキュリティ責任者', '情報セキュリティ施策を統括する責任', 'manual', 'one', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('department-information-security-manager', '部門情報セキュリティ管理者', '各部門長が担う情報セキュリティ管理責任', 'department_manager', 'per_department', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('privacy-manager', '個人情報保護管理者', '個人情報の適正な管理を統括する責任', 'manual', 'one', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('privacy-auditor', '個人情報保護監査責任者', '個人情報の取扱いを独立して監査する責任', 'manual', 'one', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('internal-auditor', '内部監査責任者', '規程及び統制の遵守状況を監査する責任', 'manual', 'many', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO governance_capabilities
  (code, name, description, owner_org_role_code, status, created_at, updated_at) VALUES
  ('corporate-governance', '会社統治を管理する', '決裁権限、委任、会議体及び内部統制を管理する', 'representative-director', 'active', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('information-security', '情報セキュリティを管理する', '情報資産、アクセス、インシデント及び教育を管理する', 'ciso', 'active', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('privacy-protection', '個人情報を保護する', '個人情報の取得、利用、保管、提供及び事故対応を管理する', 'privacy-manager', 'active', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('policy-management', '規程を管理する', '規程の原本、版、公開、確認及び見直しを管理する', 'internal-auditor', 'active', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
