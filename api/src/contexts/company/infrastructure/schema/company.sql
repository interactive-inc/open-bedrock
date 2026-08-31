CREATE TABLE company_organizations (
  id TEXT PRIMARY KEY NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  name TEXT NOT NULL DEFAULT '' CHECK (
    length(name) <= 200
    AND trim(name) = name
    AND instr(name, char(0)) = 0
  ),
  representative_name TEXT NOT NULL DEFAULT '' CHECK (
    length(representative_name) <= 200
    AND trim(representative_name) = representative_name
    AND instr(representative_name, char(0)) = 0
  ),
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

CREATE UNIQUE INDEX company_active_site_code_uniq
  ON company_resource_heads (organization_id, json_extract(attributes_json, '$.code'))
  WHERE resource_type = 'site' AND state = 'active';

CREATE UNIQUE INDEX company_active_workplace_code_uniq
  ON company_resource_heads (
    organization_id,
    json_extract(attributes_json, '$.siteId'),
    json_extract(attributes_json, '$.code')
  )
  WHERE resource_type = 'workplace' AND state = 'active';

CREATE TRIGGER company_site_legal_entity_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'site'
  AND NEW.state = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM company_resource_heads AS legal_entity
    WHERE legal_entity.organization_id = NEW.organization_id
      AND legal_entity.resource_type = 'legal-entity'
      AND legal_entity.resource_id = json_extract(NEW.attributes_json, '$.legalEntityId')
      AND legal_entity.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_site_legal_entity_not_found');
END;

CREATE TRIGGER company_workplace_site_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'workplace'
  AND NEW.state = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM company_resource_heads AS site
    WHERE site.organization_id = NEW.organization_id
      AND site.resource_type = 'site'
      AND site.resource_id = json_extract(NEW.attributes_json, '$.siteId')
      AND site.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_workplace_site_not_found');
END;

CREATE TRIGGER company_site_void_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'site'
  AND NEW.state = 'void'
  AND EXISTS (
    SELECT 1
    FROM company_resource_heads AS workplace
    WHERE workplace.organization_id = NEW.organization_id
      AND workplace.resource_type = 'workplace'
      AND json_extract(workplace.attributes_json, '$.siteId') = NEW.resource_id
      AND workplace.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_site_has_active_workplaces');
END;

CREATE TRIGGER company_legal_entity_void_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'legal-entity'
  AND NEW.state = 'void'
  AND EXISTS (
    SELECT 1
    FROM company_resource_heads AS site
    WHERE site.organization_id = NEW.organization_id
      AND site.resource_type = 'site'
      AND json_extract(site.attributes_json, '$.legalEntityId') = NEW.resource_id
      AND site.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_legal_entity_has_active_sites');
END;

CREATE UNIQUE INDEX company_active_job_code_uniq
  ON company_resource_heads (organization_id, json_extract(attributes_json, '$.code'))
  WHERE resource_type = 'job' AND state = 'active';

CREATE UNIQUE INDEX company_single_active_profile_uniq
  ON company_resource_heads (organization_id)
  WHERE resource_type = 'company-profile' AND state = 'active';

CREATE UNIQUE INDEX company_active_legal_entity_registration_uniq
  ON company_resource_heads (
    organization_id,
    json_extract(attributes_json, '$.jurisdictionCountryCode'),
    json_extract(attributes_json, '$.registrationNumber')
  )
  WHERE resource_type = 'legal-entity'
    AND state = 'active'
    AND json_extract(attributes_json, '$.registrationNumber') IS NOT NULL;

CREATE UNIQUE INDEX company_active_organizational_office_code_uniq
  ON company_resource_heads (organization_id, json_extract(attributes_json, '$.code'))
  WHERE resource_type = 'organizational-office' AND state = 'active';

CREATE UNIQUE INDEX company_active_collective_body_code_uniq
  ON company_resource_heads (organization_id, json_extract(attributes_json, '$.code'))
  WHERE resource_type = 'collective-body' AND state = 'active';

CREATE UNIQUE INDEX company_active_office_holder_uniq
  ON company_resource_heads (
    organization_id,
    json_extract(attributes_json, '$.organizationalOfficeId')
  )
  WHERE resource_type = 'office-assignment' AND state = 'active';

CREATE UNIQUE INDEX company_active_collective_body_member_uniq
  ON company_resource_heads (
    organization_id,
    json_extract(attributes_json, '$.collectiveBodyId'),
    json_extract(attributes_json, '$.employeeId')
  )
  WHERE resource_type = 'collective-body-membership' AND state = 'active';

CREATE UNIQUE INDEX company_active_responsibility_assignment_uniq
  ON company_resource_heads (
    organization_id,
    json_extract(attributes_json, '$.responsibilityId'),
    json_extract(attributes_json, '$.holderType'),
    json_extract(attributes_json, '$.holderId'),
    COALESCE(json_extract(attributes_json, '$.authorityScopeId'), '')
  )
  WHERE resource_type = 'responsibility-assignment' AND state = 'active';

CREATE TRIGGER company_position_job_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'position'
  AND NEW.state = 'active'
  AND json_extract(NEW.attributes_json, '$.jobId') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM company_resource_heads AS job
    WHERE job.organization_id = NEW.organization_id
      AND job.resource_type = 'job'
      AND job.resource_id = json_extract(NEW.attributes_json, '$.jobId')
      AND job.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_position_job_not_found');
END;

CREATE TRIGGER company_organizational_office_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'organizational-office'
  AND NEW.state = 'active'
  AND (
    NOT EXISTS (
      SELECT 1
      FROM company_resource_heads AS unit
      WHERE unit.organization_id = NEW.organization_id
        AND unit.resource_type = 'organization-unit'
        AND unit.resource_id = json_extract(NEW.attributes_json, '$.organizationUnitId')
        AND unit.state = 'active'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM company_resource_heads AS position
      WHERE position.organization_id = NEW.organization_id
        AND position.resource_type = 'position'
        AND position.resource_id = json_extract(NEW.attributes_json, '$.positionId')
        AND position.state = 'active'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'company_organizational_office_reference_not_found');
END;

CREATE TRIGGER company_office_assignment_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'office-assignment'
  AND NEW.state = 'active'
  AND (
    NOT EXISTS (
      SELECT 1 FROM company_resource_heads AS employee
      WHERE employee.organization_id = NEW.organization_id
        AND employee.resource_type = 'employee'
        AND employee.resource_id = json_extract(NEW.attributes_json, '$.employeeId')
        AND employee.state = 'active'
    )
    OR NOT EXISTS (
      SELECT 1 FROM company_resource_heads AS employment
      WHERE employment.organization_id = NEW.organization_id
        AND employment.resource_type = 'employment'
        AND employment.resource_id = json_extract(NEW.attributes_json, '$.employmentId')
        AND employment.state = 'active'
    )
    OR NOT EXISTS (
      SELECT 1 FROM company_resource_heads AS office
      WHERE office.organization_id = NEW.organization_id
        AND office.resource_type = 'organizational-office'
        AND office.resource_id = json_extract(NEW.attributes_json, '$.organizationalOfficeId')
        AND office.state = 'active'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'company_office_assignment_reference_not_found');
END;

CREATE TRIGGER company_authority_scope_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'authority-scope'
  AND NEW.state = 'active'
  AND json_extract(NEW.attributes_json, '$.scopeType') IN (
    'organization-unit', 'legal-entity', 'site', 'workplace'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM company_resource_heads AS scoped
    WHERE scoped.organization_id = NEW.organization_id
      AND scoped.resource_type = json_extract(NEW.attributes_json, '$.scopeType')
      AND scoped.resource_id = json_extract(NEW.attributes_json, '$.scopeId')
      AND scoped.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_authority_scope_reference_not_found');
END;

CREATE TRIGGER company_responsibility_assignment_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'responsibility-assignment'
  AND NEW.state = 'active'
  AND (
    NOT EXISTS (
      SELECT 1 FROM company_resource_heads AS responsibility
      WHERE responsibility.organization_id = NEW.organization_id
        AND responsibility.resource_type = 'responsibility'
        AND responsibility.resource_id = json_extract(NEW.attributes_json, '$.responsibilityId')
        AND responsibility.state = 'active'
    )
    OR (
      json_extract(NEW.attributes_json, '$.authorityScopeId') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM company_resource_heads AS scope
        WHERE scope.organization_id = NEW.organization_id
          AND scope.resource_type = 'authority-scope'
          AND scope.resource_id = json_extract(NEW.attributes_json, '$.authorityScopeId')
          AND scope.state = 'active'
      )
    )
    OR NOT EXISTS (
      SELECT 1 FROM company_resource_heads AS holder
      WHERE holder.organization_id = NEW.organization_id
        AND holder.resource_type = json_extract(NEW.attributes_json, '$.holderType')
        AND holder.resource_id = json_extract(NEW.attributes_json, '$.holderId')
        AND holder.state = 'active'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_assignment_reference_not_found');
END;

CREATE TRIGGER company_collective_body_membership_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'collective-body-membership'
  AND NEW.state = 'active'
  AND (
    NOT EXISTS (
      SELECT 1 FROM company_resource_heads AS body
      WHERE body.organization_id = NEW.organization_id
        AND body.resource_type = 'collective-body'
        AND body.resource_id = json_extract(NEW.attributes_json, '$.collectiveBodyId')
        AND body.state = 'active'
    )
    OR NOT EXISTS (
      SELECT 1 FROM company_resource_heads AS employee
      WHERE employee.organization_id = NEW.organization_id
        AND employee.resource_type = 'employee'
        AND employee.resource_id = json_extract(NEW.attributes_json, '$.employeeId')
        AND employee.state = 'active'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'company_collective_body_membership_reference_not_found');
END;

CREATE TRIGGER company_organizational_authority_scope_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'organizational-authority'
  AND NEW.state = 'active'
  AND json_extract(NEW.attributes_json, '$.scopeType') = 'authority-scope'
  AND NOT EXISTS (
    SELECT 1 FROM company_resource_heads AS scope
    WHERE scope.organization_id = NEW.organization_id
      AND scope.resource_type = 'authority-scope'
      AND scope.resource_id = json_extract(NEW.attributes_json, '$.scopeId')
      AND scope.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_organizational_authority_scope_not_found');
END;

CREATE TRIGGER company_governance_definition_void_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.state = 'void'
  AND (
    (NEW.resource_type = 'job' AND EXISTS (
      SELECT 1 FROM company_resource_heads AS position
      WHERE position.organization_id = NEW.organization_id
        AND position.resource_type = 'position'
        AND json_extract(position.attributes_json, '$.jobId') = NEW.resource_id
        AND position.state = 'active'
    ))
    OR (NEW.resource_type = 'organizational-office' AND EXISTS (
      SELECT 1 FROM company_resource_heads AS assignment
      WHERE assignment.organization_id = NEW.organization_id
        AND assignment.resource_type = 'office-assignment'
        AND json_extract(assignment.attributes_json, '$.organizationalOfficeId') = NEW.resource_id
        AND assignment.state = 'active'
    ))
    OR (NEW.resource_type = 'responsibility' AND EXISTS (
      SELECT 1 FROM company_resource_heads AS assignment
      WHERE assignment.organization_id = NEW.organization_id
        AND assignment.resource_type = 'responsibility-assignment'
        AND json_extract(assignment.attributes_json, '$.responsibilityId') = NEW.resource_id
        AND assignment.state = 'active'
    ))
    OR (NEW.resource_type = 'authority-scope' AND EXISTS (
      SELECT 1 FROM company_resource_heads AS assignment
      WHERE assignment.organization_id = NEW.organization_id
        AND (
          (
            assignment.resource_type = 'responsibility-assignment'
            AND json_extract(assignment.attributes_json, '$.authorityScopeId') = NEW.resource_id
          )
          OR (
            assignment.resource_type = 'organizational-authority'
            AND json_extract(assignment.attributes_json, '$.scopeType') = 'authority-scope'
            AND json_extract(assignment.attributes_json, '$.scopeId') = NEW.resource_id
          )
        )
        AND assignment.state = 'active'
    ))
    OR (NEW.resource_type = 'collective-body' AND EXISTS (
      SELECT 1 FROM company_resource_heads AS dependent
      WHERE dependent.organization_id = NEW.organization_id
        AND (
          (
            dependent.resource_type = 'collective-body-membership'
            AND json_extract(dependent.attributes_json, '$.collectiveBodyId') = NEW.resource_id
          )
          OR (
            dependent.resource_type = 'responsibility-assignment'
            AND json_extract(dependent.attributes_json, '$.holderType') = 'collective-body'
            AND json_extract(dependent.attributes_json, '$.holderId') = NEW.resource_id
          )
        )
        AND dependent.state = 'active'
    ))
  )
BEGIN
  SELECT RAISE(ABORT, 'company_governance_definition_is_in_use');
END;
