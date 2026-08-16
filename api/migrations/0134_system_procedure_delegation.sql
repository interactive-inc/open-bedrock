-- Procedure-scoped delegation and stable public references.

CREATE TABLE system_delegation_procedure_scopes (
  delegation_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_delegations(id) ON DELETE RESTRICT,
  procedure_key TEXT NOT NULL
    REFERENCES system_procedure_definitions(key) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX system_delegation_procedure_scopes_pair_uniq
  ON system_delegation_procedure_scopes (delegation_id, procedure_key);

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_delegation_procedure_scopes_valid_insert
BEFORE INSERT ON system_delegation_procedure_scopes
WHEN NOT EXISTS (
  SELECT 1 FROM system_delegations
  WHERE id = NEW.delegation_id
    AND scope_context IS NULL
    AND scope_kind IS NULL
    AND scope_id IS NULL
    AND scope_version IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'procedure scope requires an otherwise global delegation');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_delegation_procedure_scopes_prevent_update
BEFORE UPDATE ON system_delegation_procedure_scopes
BEGIN
  SELECT RAISE(ABORT, 'delegation procedure scope is immutable');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_delegation_procedure_scopes_prevent_delete
BEFORE DELETE ON system_delegation_procedure_scopes
BEGIN
  SELECT RAISE(ABORT, 'delegation procedure scope is immutable');
END;

CREATE TABLE system_delegation_numbers (
  number INTEGER PRIMARY KEY AUTOINCREMENT,
  delegation_id TEXT NOT NULL
    REFERENCES system_delegations(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX system_delegation_numbers_delegation_uniq
  ON system_delegation_numbers (delegation_id);

-- Legacy employee-scoped approval delegation maps to canonical System accounts.
INSERT INTO system_delegations
  (id, delegator_account_id, delegate_account_id, scope_context, scope_kind,
   scope_id, scope_version, starts_at, ends_at, created_at, revoked_at)
SELECT
  'legacy-approval-delegation:' || legacy.id,
  CAST(delegator.account_id AS TEXT),
  CAST(delegate.account_id AS TEXT),
  NULL, NULL, NULL, NULL,
  CAST(strftime('%s', legacy.starts_at) AS INTEGER) * 1000,
  CAST(strftime('%s', legacy.ends_at) AS INTEGER) * 1000,
  MIN(
    CAST(strftime('%s', legacy.created_at) AS INTEGER) * 1000,
    CAST(strftime('%s', legacy.starts_at) AS INTEGER) * 1000
  ),
  CASE WHEN legacy.cancelled_at IS NULL THEN NULL ELSE MIN(
    CAST(strftime('%s', legacy.ends_at) AS INTEGER) * 1000,
    MAX(
      MIN(
        CAST(strftime('%s', legacy.created_at) AS INTEGER) * 1000,
        CAST(strftime('%s', legacy.starts_at) AS INTEGER) * 1000
      ),
      CAST(strftime('%s', legacy.cancelled_at) AS INTEGER) * 1000
    )
  ) END
FROM approval_delegations AS legacy
JOIN account_employee_links AS delegator
  ON delegator.employee_id = legacy.delegator_employee_id
JOIN account_employee_links AS delegate
  ON delegate.employee_id = legacy.delegate_employee_id;

INSERT INTO system_delegation_numbers (number, delegation_id)
SELECT id, 'legacy-approval-delegation:' || id
FROM approval_delegations;

INSERT INTO system_delegation_procedure_scopes (delegation_id, procedure_key)
SELECT 'legacy-approval-delegation:' || id, template_code
FROM approval_delegations
WHERE template_code IS NOT NULL;

CREATE TABLE system_delegation_backfill_guard (
  incomplete_count INTEGER NOT NULL CHECK (incomplete_count = 0)
);

INSERT INTO system_delegation_backfill_guard (incomplete_count)
SELECT
  ((SELECT count(*) FROM approval_delegations)
    <> (SELECT count(*) FROM system_delegations
        WHERE id LIKE 'legacy-approval-delegation:%'))
  + ((SELECT count(*) FROM approval_delegations)
    <> (SELECT count(*) FROM system_delegation_numbers
        WHERE delegation_id LIKE 'legacy-approval-delegation:%'));

DROP TABLE system_delegation_backfill_guard;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_delegation_numbers_prevent_update
BEFORE UPDATE ON system_delegation_numbers
BEGIN
  SELECT RAISE(ABORT, 'delegation number is immutable');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_delegation_numbers_prevent_delete
BEFORE DELETE ON system_delegation_numbers
BEGIN
  SELECT RAISE(ABORT, 'delegation number is immutable');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_human_attestations_procedure_delegation
BEFORE INSERT ON system_human_attestations
WHEN NEW.delegation_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM system_delegation_procedure_scopes
    WHERE delegation_id = NEW.delegation_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM system_delegation_procedure_scopes AS procedure_scope
    JOIN system_proposal_cases AS proposal_case ON proposal_case.case_id = NEW.case_id
    JOIN system_proposals AS proposal ON proposal.id = proposal_case.proposal_id
    WHERE procedure_scope.delegation_id = NEW.delegation_id
      AND procedure_scope.procedure_key = proposal.procedure_key
  )
BEGIN
  SELECT RAISE(ABORT, 'delegation does not cover this procedure');
END;
