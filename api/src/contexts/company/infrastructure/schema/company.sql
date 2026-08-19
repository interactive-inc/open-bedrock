CREATE TABLE company_organizations (
  id TEXT PRIMARY KEY NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at)
);

CREATE TABLE company_account_profiles (
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE CASCADE ON UPDATE CASCADE,
  account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (
    length(display_name) BETWEEN 1 AND 200
    AND trim(display_name) = display_name
    AND instr(display_name, char(0)) = 0
  ),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  PRIMARY KEY (organization_id, account_id)
);

CREATE INDEX company_account_profiles_account_idx
  ON company_account_profiles (account_id);

CREATE TABLE company_resource_heads (
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  organization_revision INTEGER NOT NULL CHECK (organization_revision >= 1),
  state TEXT NOT NULL CHECK (state IN ('active', 'void')),
  effective_from TEXT NOT NULL,
  effective_to TEXT CHECK (effective_to IS NULL OR effective_to > effective_from),
  attributes_json TEXT NOT NULL CHECK (json_valid(attributes_json)),
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0),
  PRIMARY KEY (organization_id, resource_type, resource_id)
);

CREATE INDEX company_resource_heads_type_effective_idx
  ON company_resource_heads (organization_id, resource_type, effective_from, effective_to);

CREATE UNIQUE INDEX company_resource_heads_org_revision_idx
  ON company_resource_heads (organization_id, organization_revision, resource_type, resource_id);

CREATE TABLE company_resource_revisions (
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  organization_revision INTEGER NOT NULL CHECK (organization_revision >= 1),
  state TEXT NOT NULL CHECK (state IN ('active', 'void')),
  effective_from TEXT NOT NULL,
  effective_to TEXT CHECK (effective_to IS NULL OR effective_to > effective_from),
  attributes_json TEXT NOT NULL CHECK (json_valid(attributes_json)),
  command_id TEXT NOT NULL,
  actor_account_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 2000),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  PRIMARY KEY (organization_id, resource_type, resource_id, revision)
);

CREATE UNIQUE INDEX company_resource_revisions_org_revision_idx
  ON company_resource_revisions (organization_id, organization_revision, resource_type, resource_id);

CREATE INDEX company_resource_revisions_command_idx
  ON company_resource_revisions (organization_id, command_id);

CREATE TABLE company_command_receipts (
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  command_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision = expected_revision + 1),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  PRIMARY KEY (organization_id, command_id)
);

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER company_organizations_revision_step
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision <> OLD.revision + 1
BEGIN
  SELECT RAISE(ABORT, 'company_revision_step_invalid');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER company_command_receipts_expected_revision
BEFORE INSERT ON company_command_receipts
WHEN COALESCE(
  (SELECT revision FROM company_organizations WHERE id = NEW.organization_id),
  -1
) <> NEW.expected_revision
BEGIN
  SELECT RAISE(ABORT, 'company_revision_conflict');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER company_resource_revisions_expected_revision
BEFORE INSERT ON company_resource_revisions
WHEN NEW.revision <> COALESCE(
  (
    SELECT revision
    FROM company_resource_heads
    WHERE organization_id = NEW.organization_id
      AND resource_type = NEW.resource_type
      AND resource_id = NEW.resource_id
  ),
  0
) + 1
BEGIN
  SELECT RAISE(ABORT, 'company_resource_revision_conflict');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER company_resource_revisions_no_update
BEFORE UPDATE ON company_resource_revisions
BEGIN
  SELECT RAISE(ABORT, 'company_resource_revisions_are_append_only');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER company_resource_revisions_no_delete
BEFORE DELETE ON company_resource_revisions
BEGIN
  SELECT RAISE(ABORT, 'company_resource_revisions_are_append_only');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER company_command_receipts_no_update
BEFORE UPDATE ON company_command_receipts
BEGIN
  SELECT RAISE(ABORT, 'company_command_receipts_are_immutable');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER company_command_receipts_no_delete
BEFORE DELETE ON company_command_receipts
BEGIN
  SELECT RAISE(ABORT, 'company_command_receipts_are_immutable');
END;
