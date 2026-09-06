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

CREATE TRIGGER company_workforce_resource_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.state = 'active' AND (
  (NEW.resource_type = 'employee' AND NOT EXISTS (
    SELECT 1 FROM company_resource_heads AS person
    WHERE person.organization_id = NEW.organization_id
      AND person.resource_type = 'person'
      AND person.resource_id = json_extract(NEW.attributes_json, '$.personId')
      AND person.state = 'active'
  ))
  OR (NEW.resource_type IN (
    'employment', 'assignment', 'reporting-relation', 'office-assignment',
    'organizational-authority', 'account-employee-link'
  ) AND NOT EXISTS (
    SELECT 1 FROM company_resource_heads AS employee
    WHERE employee.organization_id = NEW.organization_id
      AND employee.resource_type = 'employee'
      AND employee.resource_id = json_extract(NEW.attributes_json, '$.employeeId')
      AND employee.state = 'active'
  ))
  OR (NEW.resource_type = 'reporting-relation' AND NOT EXISTS (
    SELECT 1 FROM company_resource_heads AS manager
    WHERE manager.organization_id = NEW.organization_id
      AND manager.resource_type = 'employee'
      AND manager.resource_id = json_extract(NEW.attributes_json, '$.managerEmployeeId')
      AND manager.state = 'active'
  ))
  OR (NEW.resource_type IN (
    'assignment', 'office-assignment', 'organizational-authority'
  ) AND NOT EXISTS (
    SELECT 1 FROM company_resource_heads AS employment
    WHERE employment.organization_id = NEW.organization_id
      AND employment.resource_type = 'employment'
      AND employment.resource_id = json_extract(NEW.attributes_json, '$.employmentId')
      AND json_extract(employment.attributes_json, '$.employeeId') =
          json_extract(NEW.attributes_json, '$.employeeId')
      AND employment.state = 'active'
  ))
)
BEGIN
  SELECT RAISE(ABORT, 'company_workforce_reference_not_found');
END;

CREATE TRIGGER company_workforce_resource_owner_guard
BEFORE INSERT ON company_resource_revisions
WHEN EXISTS (
  SELECT 1 FROM company_resource_heads AS previous
  WHERE previous.organization_id = NEW.organization_id
    AND previous.resource_type = NEW.resource_type
    AND previous.resource_id = NEW.resource_id
    AND (
      (NEW.resource_type = 'employee' AND
       json_extract(previous.attributes_json, '$.personId') IS NOT
       json_extract(NEW.attributes_json, '$.personId'))
      OR (NEW.resource_type = 'employment' AND
          json_extract(previous.attributes_json, '$.employeeId') IS NOT
          json_extract(NEW.attributes_json, '$.employeeId'))
    )
)
BEGIN
  SELECT RAISE(ABORT, 'company_workforce_owner_immutable');
END;

CREATE TRIGGER company_workforce_resource_void_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.state = 'void'
  AND NEW.resource_type IN ('person', 'employee', 'employment')
  AND EXISTS (
    SELECT 1 FROM company_resource_heads AS dependent
    WHERE dependent.organization_id = NEW.organization_id
      AND dependent.state = 'active'
      AND (
        (NEW.resource_type = 'person' AND dependent.resource_type = 'employee'
         AND json_extract(dependent.attributes_json, '$.personId') = NEW.resource_id)
        OR (NEW.resource_type = 'employee' AND (
          (dependent.resource_type IN (
            'employment', 'assignment', 'reporting-relation', 'office-assignment',
            'collective-body-membership', 'organizational-authority', 'account-employee-link'
          ) AND json_extract(dependent.attributes_json, '$.employeeId') = NEW.resource_id)
          OR (dependent.resource_type = 'reporting-relation'
              AND json_extract(dependent.attributes_json, '$.managerEmployeeId') = NEW.resource_id)
          OR (dependent.resource_type = 'responsibility-assignment'
              AND json_extract(dependent.attributes_json, '$.holderType') = 'employee'
              AND json_extract(dependent.attributes_json, '$.holderId') = NEW.resource_id)
        ))
        OR (NEW.resource_type = 'employment' AND dependent.resource_type IN (
          'assignment', 'office-assignment', 'organizational-authority'
        ) AND json_extract(dependent.attributes_json, '$.employmentId') = NEW.resource_id)
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'company_workforce_resource_is_in_use');
END;


-- Company workforce identity and period projections.
CREATE TABLE company_employees (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 128),
  official_name TEXT NOT NULL
    CHECK (length(official_name) BETWEEN 1 AND 200 AND trim(official_name) = official_name),
  employee_code TEXT
    CHECK (
      employee_code IS NULL OR (
        length(employee_code) BETWEEN 1 AND 64 AND trim(employee_code) = employee_code
      )
    ),
  email TEXT
    CHECK (email IS NULL OR (length(email) BETWEEN 1 AND 320 AND trim(email) = email)),
  phone TEXT
    CHECK (phone IS NULL OR (length(phone) BETWEEN 1 AND 64 AND trim(phone) = phone)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
    CHECK (updated_at >= created_at)
);

CREATE UNIQUE INDEX company_employees_employee_code_uniq
  ON company_employees(employee_code);

CREATE TABLE company_employments (
  id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT NOT NULL
    REFERENCES company_employees(id) ON DELETE RESTRICT,
  contract_name TEXT NOT NULL
    CHECK (length(contract_name) BETWEEN 1 AND 200 AND trim(contract_name) = contract_name),
  employment_type TEXT NOT NULL
    CHECK (employment_type IN ('FULL_TIME', 'PART_TIME')),
  hire_date TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('ACTIVE', 'ON_LEAVE', 'TERMINATED')),
  termination_date TEXT,
  created_at INTEGER NOT NULL
    CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL
    CHECK (updated_at >= created_at),
  CHECK (termination_date IS NULL OR hire_date <= termination_date)
);

CREATE UNIQUE INDEX company_employments_employee_active_unique
  ON company_employments(employee_id)
  WHERE termination_date IS NULL;

CREATE INDEX company_employments_employee_idx
  ON company_employments(employee_id);

CREATE INDEX company_employments_status_idx
  ON company_employments(status);

CREATE TABLE company_account_employee_links (
  account_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL
    REFERENCES company_employees(id) ON DELETE RESTRICT
);

CREATE INDEX company_account_employee_links_employee_idx
  ON company_account_employee_links(employee_id);

CREATE UNIQUE INDEX company_account_employee_links_employee_uniq
  ON company_account_employee_links(employee_id);

CREATE TABLE "company_personnel_actions" (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'hire', 'rehire', 'primary_assignment_started', 'transferred',
    'concurrent_assignment_started', 'assignment_ended', 'position_changed',
    'manager_changed', 'department_responsibility_started',
    'department_responsibility_ended', 'leave_started', 'returned', 'retired',
    'corrected', 'initial_state', 'employment_revised'
  )),
  event_on TEXT NOT NULL CHECK (
    length(event_on) = 10 AND substr(event_on, 5, 1) = '-' AND substr(event_on, 8, 1) = '-'
  ),
  recorded_at INTEGER NOT NULL,
  recorded_by_account_id TEXT,
  requested_by_employee_id TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('application', 'direct', 'system')),
  source_application_id INTEGER,
  corrects_action_id TEXT,
  operation_id TEXT NOT NULL UNIQUE CHECK (length(operation_id) BETWEEN 1 AND 200),
  payload_fingerprint TEXT NOT NULL CHECK (length(payload_fingerprint) = 64),
  summary_json TEXT NOT NULL CHECK (json_valid(summary_json)),
  CHECK (
    (source_type = 'application' AND source_application_id IS NOT NULL)
    OR (source_type != 'application' AND source_application_id IS NULL)
  ),
  CHECK (corrects_action_id IS NULL OR corrects_action_id != id),
  CHECK (recorded_by_account_id IS NULL OR length(recorded_by_account_id) BETWEEN 1 AND 255)
);

CREATE INDEX idx_company_personnel_actions_employee_timeline
  ON company_personnel_actions(employee_id, event_on, recorded_at, id);

CREATE UNIQUE INDEX uq_company_personnel_actions_correction
  ON company_personnel_actions(corrects_action_id)
  WHERE corrects_action_id IS NOT NULL;

CREATE UNIQUE INDEX uq_company_personnel_actions_source_application
  ON company_personnel_actions(source_application_id)
  WHERE source_application_id IS NOT NULL;

CREATE TABLE "company_employee_lifecycle_revisions" (
  employee_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at INTEGER NOT NULL
);

CREATE TABLE "company_employment_period_versions" (
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  employee_id TEXT NOT NULL,
  starts_on TEXT NOT NULL CHECK (
    length(starts_on) = 10 AND substr(starts_on, 5, 1) = '-' AND substr(starts_on, 8, 1) = '-'
  ),
  ends_on TEXT CHECK (
    ends_on IS NULL OR (
      length(ends_on) = 10 AND substr(ends_on, 5, 1) = '-' AND substr(ends_on, 8, 1) = '-'
    )
  ),
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  PRIMARY KEY (period_id, revision),
  CHECK (ends_on IS NULL OR starts_on < ends_on)
) WITHOUT ROWID;

CREATE INDEX idx_company_employment_period_versions_employee
  ON company_employment_period_versions(
    employee_id, starts_on, ends_on, period_id, revision DESC
  );

CREATE TABLE "company_employee_status_period_versions" (
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  employment_period_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'leave')),
  starts_on TEXT NOT NULL CHECK (
    length(starts_on) = 10 AND substr(starts_on, 5, 1) = '-' AND substr(starts_on, 8, 1) = '-'
  ),
  ends_on TEXT CHECK (
    ends_on IS NULL OR (
      length(ends_on) = 10 AND substr(ends_on, 5, 1) = '-' AND substr(ends_on, 8, 1) = '-'
    )
  ),
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  PRIMARY KEY (period_id, revision),
  CHECK (ends_on IS NULL OR starts_on < ends_on)
) WITHOUT ROWID;

CREATE INDEX idx_company_employee_status_period_versions_employee
  ON company_employee_status_period_versions(
    employee_id, starts_on, ends_on, period_id, revision DESC
  );

CREATE INDEX idx_company_employee_status_period_versions_employment
  ON company_employee_status_period_versions(employment_period_id, period_id, revision DESC);

CREATE TABLE company_workforce_resource_bindings (
  resource_type TEXT NOT NULL CHECK (resource_type IN ('employee', 'employment')),
  resource_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  resource_revision INTEGER NOT NULL CHECK (resource_revision > 0),
  lifecycle_revision INTEGER NOT NULL CHECK (lifecycle_revision >= 0),
  last_action_id TEXT,
  PRIMARY KEY (resource_type, resource_id),
  FOREIGN KEY (organization_id, resource_type, resource_id)
    REFERENCES company_resource_heads(organization_id, resource_type, resource_id)
    ON DELETE RESTRICT,
  CHECK (resource_type != 'employee' OR resource_id = employee_id)
);

CREATE INDEX company_workforce_resource_bindings_employee_idx
  ON company_workforce_resource_bindings(employee_id, resource_type);

DROP INDEX IF EXISTS company_employments_employee_active_unique;
CREATE UNIQUE INDEX company_employments_employee_active_unique
  ON company_employments(employee_id)
  WHERE termination_date IS NULL AND status IN ('ACTIVE', 'ON_LEAVE');

DROP TRIGGER IF EXISTS company_workforce_projection_guard;
CREATE TRIGGER company_workforce_projection_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision != OLD.revision
BEGIN
  SELECT RAISE(ABORT, 'company_workforce_period_conflict')
  WHERE EXISTS (
    WITH latest AS (
      SELECT period.* FROM company_employment_period_versions AS period
      JOIN company_workforce_resource_bindings AS binding
        ON binding.employee_id = period.employee_id AND binding.resource_type = 'employee'
        AND binding.organization_id = NEW.id
      WHERE period.is_void = 0 AND NOT EXISTS (
        SELECT 1 FROM company_employment_period_versions AS newer
        WHERE newer.period_id = period.period_id AND newer.revision > period.revision
      )
    )
    SELECT 1 FROM latest AS left_period JOIN latest AS right_period
      ON left_period.employee_id = right_period.employee_id
      AND left_period.period_id < right_period.period_id
    WHERE (left_period.ends_on IS NULL OR right_period.starts_on < left_period.ends_on)
      AND (right_period.ends_on IS NULL OR left_period.starts_on < right_period.ends_on)
  );

  SELECT RAISE(ABORT, 'company_workforce_reference_period_conflict')
  WHERE EXISTS (
    WITH ranked AS (
      SELECT resource.*,
        row_number() OVER (PARTITION BY resource_type, resource_id, effective_from ORDER BY revision DESC) AS start_rank
      FROM company_resource_revisions AS resource
      WHERE organization_id = NEW.id AND resource_type IN ('person', 'employee')
    ),
    slices AS (
      SELECT resource_type, resource_id, state, attributes_json, effective_from AS starts_on,
        nullif(min(coalesce(effective_to, '9999-12-32'),
          coalesce(lead(effective_from) OVER (PARTITION BY resource_type, resource_id ORDER BY effective_from), '9999-12-32')), '9999-12-32') AS ends_on
      FROM ranked WHERE start_rank = 1
    ),
    reference_intervals AS (
      SELECT 'employee' AS reference_type, period.employee_id AS reference_id,
        period.starts_on, period.ends_on
      FROM company_employment_period_versions AS period
      JOIN company_workforce_resource_bindings AS binding ON binding.resource_type = 'employee'
        AND binding.employee_id = period.employee_id AND binding.organization_id = NEW.id
      WHERE period.is_void = 0 AND NOT EXISTS (
        SELECT 1 FROM company_employment_period_versions AS newer
        WHERE newer.period_id = period.period_id AND newer.revision > period.revision
      )
      UNION ALL
      SELECT 'person', json_extract(employee.attributes_json, '$.personId'),
        employee.starts_on, employee.ends_on
      FROM slices AS employee
      JOIN company_workforce_resource_bindings AS binding ON binding.resource_type = 'employee'
        AND binding.resource_id = employee.resource_id AND binding.organization_id = NEW.id
      WHERE employee.resource_type = 'employee' AND employee.state = 'active'
    ),
    reference_boundaries AS (
      SELECT resource_type, resource_id, starts_on AS boundary_on FROM slices
      UNION SELECT resource_type, resource_id, ends_on FROM slices WHERE ends_on IS NOT NULL
    ),
    reference_points AS (
      SELECT reference_type, reference_id, starts_on AS effective_on FROM reference_intervals
      UNION
      SELECT reference.reference_type, reference.reference_id, boundary.boundary_on
      FROM reference_intervals AS reference JOIN reference_boundaries AS boundary
        ON boundary.resource_type = reference.reference_type AND boundary.resource_id = reference.reference_id
      WHERE reference.starts_on <= boundary.boundary_on
        AND (reference.ends_on IS NULL OR boundary.boundary_on < reference.ends_on)
    )
    SELECT 1 FROM reference_points AS reference
    WHERE NOT EXISTS (
      SELECT 1 FROM slices AS target
      WHERE target.resource_type = reference.reference_type AND target.resource_id = reference.reference_id
        AND target.state = 'active' AND target.starts_on <= reference.effective_on
        AND (target.ends_on IS NULL OR reference.effective_on < target.ends_on)
    )
  );
END;

DROP TRIGGER IF EXISTS company_personnel_actions_no_delete;
CREATE TRIGGER company_personnel_actions_no_delete
BEFORE DELETE ON company_personnel_actions
BEGIN
  SELECT RAISE(ABORT, 'company personnel actions are append only');
END;

DROP TRIGGER IF EXISTS company_personnel_actions_no_update;
CREATE TRIGGER company_personnel_actions_no_update
BEFORE UPDATE ON company_personnel_actions
BEGIN
  SELECT RAISE(ABORT, 'company personnel actions are append only');
END;

CREATE TABLE company_external_identity_imports (
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT,
  command_id TEXT NOT NULL CHECK (length(command_id) BETWEEN 1 AND 200),
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64 AND fingerprint NOT GLOB '*[^0-9a-f]*'),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  machine_credential_id TEXT NOT NULL REFERENCES system_machine_credentials(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision = expected_revision + 1),
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  PRIMARY KEY (organization_id, command_id)
);
CREATE TABLE company_external_identity_sources (
  identity_id TEXT PRIMARY KEY NOT NULL REFERENCES system_identity_bindings(id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT,
  source_revision INTEGER NOT NULL CHECK (source_revision > 0),
  source_digest TEXT NOT NULL CHECK (length(source_digest) = 64 AND source_digest NOT GLOB '*[^0-9a-f]*'),
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0)
);

DROP TRIGGER IF EXISTS company_external_identity_imports_no_update;
CREATE TRIGGER company_external_identity_imports_no_update
BEFORE UPDATE ON company_external_identity_imports
BEGIN
  SELECT RAISE(ABORT, 'external identity import is immutable');
END;

DROP TRIGGER IF EXISTS company_external_identity_imports_no_delete;
CREATE TRIGGER company_external_identity_imports_no_delete
BEFORE DELETE ON company_external_identity_imports
BEGIN
  SELECT RAISE(ABORT, 'external identity import is immutable');
END;

DROP TRIGGER IF EXISTS company_external_identity_sources_revision;
CREATE TRIGGER company_external_identity_sources_revision
BEFORE UPDATE ON company_external_identity_sources
WHEN NEW.identity_id IS NOT OLD.identity_id
  OR NEW.organization_id IS NOT OLD.organization_id
  OR NEW.source_revision <= OLD.source_revision
  OR NEW.updated_at < OLD.updated_at
BEGIN
  SELECT RAISE(ABORT, 'external identity source revision conflict');
END;

DROP TRIGGER IF EXISTS company_external_identity_sources_no_delete;
CREATE TRIGGER company_external_identity_sources_no_delete
BEFORE DELETE ON company_external_identity_sources
BEGIN
  SELECT RAISE(ABORT, 'external identity source is immutable');
END;

CREATE TABLE company_employee_resource_adoptions (
  command_id TEXT PRIMARY KEY NOT NULL CHECK (length(command_id) BETWEEN 1 AND 200),
  employee_id TEXT NOT NULL UNIQUE REFERENCES company_employees(id) ON DELETE RESTRICT,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64 AND fingerprint NOT GLOB '*[^0-9a-f]*'),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1500),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision > expected_revision AND organization_revision <= expected_revision + 100),
  observed_on TEXT NOT NULL CHECK (length(observed_on) = 10),
  snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64 AND snapshot_digest NOT GLOB '*[^0-9a-f]*'),
  source_json TEXT NOT NULL CHECK (json_valid(source_json) AND length(CAST(source_json AS BLOB)) <= 750000),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0)
);

DROP TRIGGER IF EXISTS company_employee_resource_adoptions_no_update;
CREATE TRIGGER company_employee_resource_adoptions_no_update
BEFORE UPDATE ON company_employee_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'employee resource adoption is immutable');
END;

DROP TRIGGER IF EXISTS company_employee_resource_adoptions_no_delete;
CREATE TRIGGER company_employee_resource_adoptions_no_delete
BEFORE DELETE ON company_employee_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'employee resource adoption is immutable');
END;
