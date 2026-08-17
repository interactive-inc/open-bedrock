-- Company組織を旧部署projectionから分離し、OrgUnitと原子的変更の正本を追加する。

CREATE TABLE organization_change_operations (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 128),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  change_count INTEGER NOT NULL CHECK (change_count >= 1),
  applied_count INTEGER NOT NULL DEFAULT 0 CHECK (applied_count BETWEEN 0 AND change_count),
  resulting_revision INTEGER NOT NULL
    CHECK (resulting_revision = expected_revision + change_count),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED')),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0)
);

CREATE TABLE organization_units (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 128),
  created_at INTEGER NOT NULL CHECK (created_at >= 0)
);

CREATE TABLE organization_unit_period_versions (
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  organization_unit_id TEXT NOT NULL
    REFERENCES organization_units(id) ON DELETE RESTRICT,
  code TEXT NOT NULL
    CHECK (length(code) BETWEEN 1 AND 64 AND trim(code) = code),
  official_name TEXT NOT NULL
    CHECK (length(official_name) BETWEEN 1 AND 200 AND trim(official_name) = official_name),
  kind TEXT NOT NULL
    CHECK (kind IN ('COMPANY', 'DIVISION', 'DEPARTMENT', 'TEAM', 'OTHER')),
  parent_organization_unit_id TEXT
    REFERENCES organization_units(id) ON DELETE RESTRICT,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL
    REFERENCES organization_change_operations(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  PRIMARY KEY (period_id, revision),
  CHECK (
    length(starts_on) = 10 AND date(starts_on) IS starts_on
    AND (ends_on IS NULL OR (length(ends_on) = 10 AND date(ends_on) IS ends_on))
    AND (ends_on IS NULL OR starts_on < ends_on)
  ),
  CHECK (
    parent_organization_unit_id IS NULL
    OR parent_organization_unit_id != organization_unit_id
  )
) WITHOUT ROWID;

CREATE INDEX organization_unit_period_versions_unit_idx
  ON organization_unit_period_versions (
    organization_unit_id, starts_on, ends_on, period_id, revision
  );

CREATE INDEX organization_unit_period_versions_code_idx
  ON organization_unit_period_versions (code, starts_on, ends_on, period_id, revision);

CREATE INDEX organization_unit_period_versions_parent_idx
  ON organization_unit_period_versions (parent_organization_unit_id, starts_on, ends_on);

CREATE TABLE organization_assignment_period_versions (
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  employment_id TEXT NOT NULL CHECK (length(employment_id) BETWEEN 1 AND 200),
  employee_id TEXT NOT NULL CHECK (length(employee_id) BETWEEN 1 AND 128),
  organization_unit_id TEXT NOT NULL
    REFERENCES organization_units(id) ON DELETE RESTRICT,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('PRIMARY', 'CONCURRENT')),
  position_title TEXT CHECK (
    position_title IS NULL OR (
      length(position_title) BETWEEN 1 AND 200 AND trim(position_title) = position_title
    )
  ),
  manager_employee_id TEXT CHECK (
    manager_employee_id IS NULL OR manager_employee_id != employee_id
  ),
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL
    REFERENCES organization_change_operations(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  PRIMARY KEY (period_id, revision),
  CHECK (
    length(starts_on) = 10 AND date(starts_on) IS starts_on
    AND (ends_on IS NULL OR (length(ends_on) = 10 AND date(ends_on) IS ends_on))
    AND (ends_on IS NULL OR starts_on < ends_on)
  )
) WITHOUT ROWID;

CREATE INDEX organization_assignment_period_versions_employee_idx
  ON organization_assignment_period_versions (
    employee_id, starts_on, ends_on, assignment_type, period_id, revision
  );

CREATE INDEX organization_assignment_period_versions_unit_idx
  ON organization_assignment_period_versions (
    organization_unit_id, starts_on, ends_on, period_id, revision
  );

CREATE TABLE organization_responsibility_period_versions (
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  employment_id TEXT NOT NULL CHECK (length(employment_id) BETWEEN 1 AND 200),
  employee_id TEXT NOT NULL CHECK (length(employee_id) BETWEEN 1 AND 128),
  organization_unit_id TEXT NOT NULL
    REFERENCES organization_units(id) ON DELETE RESTRICT,
  responsibility_type TEXT NOT NULL CHECK (
    length(responsibility_type) BETWEEN 1 AND 64
    AND responsibility_type GLOB '[A-Z]*'
    AND responsibility_type NOT GLOB '*[^A-Z0-9_]*'
  ),
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL
    REFERENCES organization_change_operations(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  PRIMARY KEY (period_id, revision),
  CHECK (
    length(starts_on) = 10 AND date(starts_on) IS starts_on
    AND (ends_on IS NULL OR (length(ends_on) = 10 AND date(ends_on) IS ends_on))
    AND (ends_on IS NULL OR starts_on < ends_on)
  )
) WITHOUT ROWID;

CREATE INDEX organization_responsibility_period_versions_employee_idx
  ON organization_responsibility_period_versions (
    employee_id, starts_on, ends_on, period_id, revision
  );

CREATE INDEX organization_responsibility_period_versions_unit_idx
  ON organization_responsibility_period_versions (
    organization_unit_id, responsibility_type, starts_on, ends_on, period_id, revision
  );

CREATE TRIGGER organization_units_immutable_update
BEFORE UPDATE ON organization_units
BEGIN
  SELECT RAISE(ABORT, 'organization unit identity is immutable');
END;

CREATE TRIGGER organization_units_immutable_delete
BEFORE DELETE ON organization_units
BEGIN
  SELECT RAISE(ABORT, 'organization unit identity is append only');
END;

CREATE TRIGGER organization_unit_period_versions_revision_guard
BEFORE INSERT ON organization_unit_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is missing or stale')
  WHERE NOT EXISTS (
    SELECT 1
    FROM organization_change_operations AS operation
    JOIN organization_lifecycle_states AS state ON state.id = 1
    WHERE operation.id = NEW.recorded_by_action_id
      AND operation.status = 'PENDING'
      AND operation.applied_count < operation.change_count
      AND state.revision = operation.expected_revision + operation.applied_count
  );

  SELECT RAISE(ABORT, 'organization unit revision is not sequential')
  WHERE NEW.revision != coalesce(
    (SELECT max(revision) FROM organization_unit_period_versions WHERE period_id = NEW.period_id),
    0
  ) + 1;

  SELECT RAISE(ABORT, 'organization unit period owner is immutable')
  WHERE EXISTS (
    SELECT 1 FROM organization_unit_period_versions AS previous
    WHERE previous.period_id = NEW.period_id
      AND previous.organization_unit_id != NEW.organization_unit_id
  );

  SELECT RAISE(ABORT, 'organization root requires canonical parent')
  WHERE (NEW.kind = 'COMPANY' AND NEW.parent_organization_unit_id IS NOT NULL)
     OR (NEW.kind != 'COMPANY' AND NEW.parent_organization_unit_id IS NULL);

  SELECT RAISE(ABORT, 'organization unit period overlaps')
  WHERE NEW.is_void = 0 AND EXISTS (
    SELECT 1 FROM organization_unit_period_versions AS current
    WHERE current.period_id != NEW.period_id
      AND current.organization_unit_id = NEW.organization_unit_id
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM organization_unit_period_versions AS latest
        WHERE latest.period_id = current.period_id
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );

  SELECT RAISE(ABORT, 'organization unit code overlaps')
  WHERE NEW.is_void = 0 AND EXISTS (
    SELECT 1 FROM organization_unit_period_versions AS current
    WHERE current.period_id != NEW.period_id
      AND current.organization_unit_id != NEW.organization_unit_id
      AND current.code = NEW.code
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM organization_unit_period_versions AS latest
        WHERE latest.period_id = current.period_id
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );

  SELECT RAISE(ABORT, 'company root period overlaps')
  WHERE NEW.is_void = 0 AND NEW.kind = 'COMPANY' AND EXISTS (
    SELECT 1 FROM organization_unit_period_versions AS current
    WHERE current.period_id != NEW.period_id
      AND current.kind = 'COMPANY'
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM organization_unit_period_versions AS latest
        WHERE latest.period_id = current.period_id
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );
END;

CREATE TRIGGER organization_unit_period_versions_immutable_update
BEFORE UPDATE ON organization_unit_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization unit periods are append only');
END;

CREATE TRIGGER organization_unit_period_versions_immutable_delete
BEFORE DELETE ON organization_unit_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization unit periods are append only');
END;

CREATE TRIGGER organization_assignment_period_versions_guard
BEFORE INSERT ON organization_assignment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is missing or stale')
  WHERE NOT EXISTS (
    SELECT 1
    FROM organization_change_operations AS operation
    JOIN organization_lifecycle_states AS state ON state.id = 1
    WHERE operation.id = NEW.recorded_by_action_id
      AND operation.status = 'PENDING'
      AND operation.applied_count < operation.change_count
      AND state.revision = operation.expected_revision + operation.applied_count
  );

  SELECT RAISE(ABORT, 'organization assignment revision is not sequential')
  WHERE NEW.revision != coalesce(
    (
      SELECT max(revision)
      FROM organization_assignment_period_versions
      WHERE period_id = NEW.period_id
    ),
    0
  ) + 1;

  SELECT RAISE(ABORT, 'organization assignment owner is immutable')
  WHERE EXISTS (
    SELECT 1 FROM organization_assignment_period_versions AS previous
    WHERE previous.period_id = NEW.period_id
      AND (
        previous.employment_id != NEW.employment_id
        OR previous.employee_id != NEW.employee_id
        OR previous.organization_unit_id != NEW.organization_unit_id
        OR previous.assignment_type != NEW.assignment_type
      )
  );

  SELECT RAISE(ABORT, 'organization assignment employment mismatch')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM employment_period_versions AS employment
    WHERE 'employment:' || employment.period_id = NEW.employment_id
      AND 'employee:' || employment.employee_id = NEW.employee_id
      AND employment.is_void = 0
      AND employment.revision = (
        SELECT max(latest.revision)
        FROM employment_period_versions AS latest
        WHERE latest.period_id = employment.period_id
      )
      AND employment.starts_on <= NEW.starts_on
      AND (
        employment.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= employment.ends_on)
      )
  );

  SELECT RAISE(ABORT, 'organization assignment unit is not active')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM organization_unit_period_versions AS unit
    WHERE unit.organization_unit_id = NEW.organization_unit_id
      AND unit.is_void = 0
      AND unit.revision = (
        SELECT max(latest.revision)
        FROM organization_unit_period_versions AS latest
        WHERE latest.period_id = unit.period_id
      )
      AND unit.starts_on <= NEW.starts_on
      AND (
        unit.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= unit.ends_on)
      )
  );

  SELECT RAISE(ABORT, 'organization assignment overlaps')
  WHERE NEW.is_void = 0 AND EXISTS (
    SELECT 1 FROM organization_assignment_period_versions AS current
    WHERE current.period_id != NEW.period_id
      AND current.employee_id = NEW.employee_id
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM organization_assignment_period_versions AS latest
        WHERE latest.period_id = current.period_id
      )
      AND (
        (current.assignment_type = 'PRIMARY' AND NEW.assignment_type = 'PRIMARY')
        OR (
          current.organization_unit_id = NEW.organization_unit_id
          AND current.assignment_type = NEW.assignment_type
        )
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );

  SELECT RAISE(ABORT, 'organization assignment manager is not employed')
  WHERE NEW.is_void = 0
    AND NEW.manager_employee_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM employment_period_versions AS employment
      WHERE 'employee:' || employment.employee_id = NEW.manager_employee_id
        AND employment.is_void = 0
        AND employment.revision = (
          SELECT max(latest.revision)
          FROM employment_period_versions AS latest
          WHERE latest.period_id = employment.period_id
        )
        AND employment.starts_on <= NEW.starts_on
        AND (
          employment.ends_on IS NULL
          OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= employment.ends_on)
        )
    );
END;

CREATE TRIGGER organization_assignment_period_versions_immutable_update
BEFORE UPDATE ON organization_assignment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization assignments are append only');
END;

CREATE TRIGGER organization_assignment_period_versions_immutable_delete
BEFORE DELETE ON organization_assignment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization assignments are append only');
END;

CREATE TRIGGER organization_responsibility_period_versions_guard
BEFORE INSERT ON organization_responsibility_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is missing or stale')
  WHERE NOT EXISTS (
    SELECT 1
    FROM organization_change_operations AS operation
    JOIN organization_lifecycle_states AS state ON state.id = 1
    WHERE operation.id = NEW.recorded_by_action_id
      AND operation.status = 'PENDING'
      AND operation.applied_count < operation.change_count
      AND state.revision = operation.expected_revision + operation.applied_count
  );

  SELECT RAISE(ABORT, 'organization responsibility revision is not sequential')
  WHERE NEW.revision != coalesce(
    (
      SELECT max(revision)
      FROM organization_responsibility_period_versions
      WHERE period_id = NEW.period_id
    ),
    0
  ) + 1;

  SELECT RAISE(ABORT, 'organization responsibility owner is immutable')
  WHERE EXISTS (
    SELECT 1 FROM organization_responsibility_period_versions AS previous
    WHERE previous.period_id = NEW.period_id
      AND (
        previous.employment_id != NEW.employment_id
        OR previous.employee_id != NEW.employee_id
        OR previous.organization_unit_id != NEW.organization_unit_id
        OR previous.responsibility_type != NEW.responsibility_type
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility employment mismatch')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM employment_period_versions AS employment
    WHERE 'employment:' || employment.period_id = NEW.employment_id
      AND 'employee:' || employment.employee_id = NEW.employee_id
      AND employment.is_void = 0
      AND employment.revision = (
        SELECT max(latest.revision)
        FROM employment_period_versions AS latest
        WHERE latest.period_id = employment.period_id
      )
      AND employment.starts_on <= NEW.starts_on
      AND (
        employment.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= employment.ends_on)
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility unit is not active')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM organization_unit_period_versions AS unit
    WHERE unit.organization_unit_id = NEW.organization_unit_id
      AND unit.is_void = 0
      AND unit.revision = (
        SELECT max(latest.revision)
        FROM organization_unit_period_versions AS latest
        WHERE latest.period_id = unit.period_id
      )
      AND unit.starts_on <= NEW.starts_on
      AND (
        unit.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= unit.ends_on)
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility requires matching assignment')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM organization_assignment_period_versions AS assignment
    WHERE assignment.employment_id = NEW.employment_id
      AND assignment.employee_id = NEW.employee_id
      AND assignment.organization_unit_id = NEW.organization_unit_id
      AND assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision)
        FROM organization_assignment_period_versions AS latest
        WHERE latest.period_id = assignment.period_id
      )
      AND assignment.starts_on <= NEW.starts_on
      AND (
        assignment.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= assignment.ends_on)
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility overlaps')
  WHERE NEW.is_void = 0 AND EXISTS (
    SELECT 1 FROM organization_responsibility_period_versions AS current
    WHERE current.period_id != NEW.period_id
      AND current.employee_id = NEW.employee_id
      AND current.organization_unit_id = NEW.organization_unit_id
      AND current.responsibility_type = NEW.responsibility_type
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM organization_responsibility_period_versions AS latest
        WHERE latest.period_id = current.period_id
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );
END;

CREATE TRIGGER organization_responsibility_period_versions_immutable_update
BEFORE UPDATE ON organization_responsibility_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization responsibilities are append only');
END;

CREATE TRIGGER organization_responsibility_period_versions_immutable_delete
BEFORE DELETE ON organization_responsibility_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization responsibilities are append only');
END;

CREATE TRIGGER organization_change_operations_insert_guard
BEFORE INSERT ON organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization revision conflict')
  WHERE NEW.applied_count != 0
    OR NEW.status != 'PENDING'
    OR NOT EXISTS (
      SELECT 1 FROM organization_lifecycle_states AS state
      WHERE state.id = 1 AND state.revision = NEW.expected_revision
    );
END;

CREATE TRIGGER organization_change_operations_immutable
BEFORE UPDATE OF id, expected_revision, change_count, resulting_revision, recorded_at
ON organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is immutable');
END;

CREATE TRIGGER organization_change_operations_completed_count_immutable
BEFORE UPDATE OF applied_count ON organization_change_operations
WHEN OLD.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'completed organization change operation is immutable');
END;

CREATE TRIGGER organization_change_operations_completion_guard
BEFORE UPDATE OF status ON organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is incomplete')
  WHERE OLD.status != 'PENDING'
    OR NEW.status != 'COMPLETED'
    OR NEW.applied_count != NEW.change_count
    OR NOT EXISTS (
      SELECT 1 FROM organization_lifecycle_states AS state
      WHERE state.id = 1 AND state.revision = NEW.resulting_revision
    );

  SELECT RAISE(ABORT, 'organization change leaves an orphan organization unit')
  WHERE EXISTS (
    SELECT 1 FROM organization_unit_period_versions AS child
    WHERE child.is_void = 0
      AND child.parent_organization_unit_id IS NOT NULL
      AND child.revision = (
        SELECT max(latest.revision)
        FROM organization_unit_period_versions AS latest
        WHERE latest.period_id = child.period_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM organization_unit_period_versions AS parent
        WHERE parent.organization_unit_id = child.parent_organization_unit_id
          AND parent.is_void = 0
          AND parent.revision = (
            SELECT max(latest.revision)
            FROM organization_unit_period_versions AS latest
            WHERE latest.period_id = parent.period_id
          )
          AND parent.starts_on <= child.starts_on
          AND (
            parent.ends_on IS NULL
            OR (child.ends_on IS NOT NULL AND child.ends_on <= parent.ends_on)
          )
      )
  );

  SELECT RAISE(ABORT, 'organization change leaves an orphan assignment')
  WHERE EXISTS (
    SELECT 1 FROM organization_assignment_period_versions AS assignment
    WHERE assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision)
        FROM organization_assignment_period_versions AS latest
        WHERE latest.period_id = assignment.period_id
      )
      AND (
        NOT EXISTS (
          SELECT 1 FROM employment_period_versions AS employment
          WHERE 'employment:' || employment.period_id = assignment.employment_id
            AND 'employee:' || employment.employee_id = assignment.employee_id
            AND employment.is_void = 0
            AND employment.revision = (
              SELECT max(latest.revision)
              FROM employment_period_versions AS latest
              WHERE latest.period_id = employment.period_id
            )
            AND employment.starts_on <= assignment.starts_on
            AND (
              employment.ends_on IS NULL
              OR (
                assignment.ends_on IS NOT NULL
                AND assignment.ends_on <= employment.ends_on
              )
            )
        )
        OR NOT EXISTS (
          SELECT 1 FROM organization_unit_period_versions AS unit
          WHERE unit.organization_unit_id = assignment.organization_unit_id
            AND unit.is_void = 0
            AND unit.revision = (
              SELECT max(latest.revision)
              FROM organization_unit_period_versions AS latest
              WHERE latest.period_id = unit.period_id
            )
            AND unit.starts_on <= assignment.starts_on
            AND (
              unit.ends_on IS NULL
              OR (
                assignment.ends_on IS NOT NULL
                AND assignment.ends_on <= unit.ends_on
              )
            )
        )
      )
  );

  SELECT RAISE(ABORT, 'organization change leaves an orphan responsibility')
  WHERE EXISTS (
    SELECT 1 FROM organization_responsibility_period_versions AS responsibility
    WHERE responsibility.is_void = 0
      AND responsibility.revision = (
        SELECT max(latest.revision)
        FROM organization_responsibility_period_versions AS latest
        WHERE latest.period_id = responsibility.period_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM organization_assignment_period_versions AS assignment
        WHERE assignment.employment_id = responsibility.employment_id
          AND assignment.employee_id = responsibility.employee_id
          AND assignment.organization_unit_id = responsibility.organization_unit_id
          AND assignment.is_void = 0
          AND assignment.revision = (
            SELECT max(latest.revision)
            FROM organization_assignment_period_versions AS latest
            WHERE latest.period_id = assignment.period_id
          )
          AND assignment.starts_on <= responsibility.starts_on
          AND (
            assignment.ends_on IS NULL
            OR (
              responsibility.ends_on IS NOT NULL
              AND responsibility.ends_on <= assignment.ends_on
            )
          )
      )
  );
END;

CREATE TRIGGER organization_change_operations_immutable_delete
BEFORE DELETE ON organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change operations are append only');
END;

CREATE TRIGGER organization_unit_period_versions_revision_state
AFTER INSERT ON organization_unit_period_versions
BEGIN
  UPDATE organization_change_operations
  SET applied_count = applied_count + 1
  WHERE id = NEW.recorded_by_action_id;

  UPDATE organization_lifecycle_states
  SET revision = revision + 1, updated_at = max(updated_at, NEW.recorded_at)
  WHERE id = 1;
END;

CREATE TRIGGER organization_assignment_period_versions_revision_state
AFTER INSERT ON organization_assignment_period_versions
BEGIN
  UPDATE organization_change_operations
  SET applied_count = applied_count + 1
  WHERE id = NEW.recorded_by_action_id;

  UPDATE organization_lifecycle_states
  SET revision = revision + 1, updated_at = max(updated_at, NEW.recorded_at)
  WHERE id = 1;
END;

CREATE TRIGGER organization_responsibility_period_versions_revision_state
AFTER INSERT ON organization_responsibility_period_versions
BEGIN
  UPDATE organization_change_operations
  SET applied_count = applied_count + 1
  WHERE id = NEW.recorded_by_action_id;

  UPDATE organization_lifecycle_states
  SET revision = revision + 1, updated_at = max(updated_at, NEW.recorded_at)
  WHERE id = 1;
END;

-- Personnel Action互換tableも、canonical operation経由の書込みだけを同じrevisionへ含める。
CREATE TRIGGER employee_org_assignment_operation_guard
BEFORE INSERT ON employee_org_assignment_period_versions
WHEN EXISTS (
  SELECT 1 FROM organization_change_operations WHERE id = NEW.recorded_by_action_id
)
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is missing or stale')
  WHERE NOT EXISTS (
    SELECT 1
    FROM organization_change_operations AS operation
    JOIN organization_lifecycle_states AS state ON state.id = 1
    WHERE operation.id = NEW.recorded_by_action_id
      AND operation.status = 'PENDING'
      AND operation.applied_count < operation.change_count
      AND state.revision = operation.expected_revision + operation.applied_count
  );

  SELECT RAISE(ABORT, 'organization assignment revision is not sequential')
  WHERE NEW.revision != coalesce(
    (
      SELECT max(revision)
      FROM employee_org_assignment_period_versions
      WHERE period_id = NEW.period_id
    ),
    0
  ) + 1;

  SELECT RAISE(ABORT, 'organization assignment unit is not active')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM organization_unit_period_versions AS unit
    WHERE unit.organization_unit_id = 'department:' || NEW.department_code
      AND unit.is_void = 0
      AND unit.revision = (
        SELECT max(latest.revision)
        FROM organization_unit_period_versions AS latest
        WHERE latest.period_id = unit.period_id
      )
      AND unit.starts_on <= NEW.starts_on
      AND (
        unit.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= unit.ends_on)
      )
  );
END;

CREATE TRIGGER employee_org_assignment_operation_state
AFTER INSERT ON employee_org_assignment_period_versions
WHEN EXISTS (
  SELECT 1 FROM organization_change_operations
  WHERE id = NEW.recorded_by_action_id AND status = 'PENDING'
)
BEGIN
  INSERT INTO organization_assignment_period_versions (
    period_id, revision, employment_id, employee_id, organization_unit_id,
    assignment_type, position_title, manager_employee_id, starts_on, ends_on,
    is_void, recorded_by_action_id, recorded_at
  ) VALUES (
    'assignment-period:' || NEW.period_id,
    NEW.revision,
    'employment:' || NEW.employment_period_id,
    'employee:' || NEW.employee_id,
    'department:' || NEW.department_code,
    CASE NEW.assignment_type WHEN 'primary' THEN 'PRIMARY' ELSE 'CONCURRENT' END,
    NEW.position_title,
    CASE
      WHEN NEW.manager_employee_id IS NULL THEN NULL
      ELSE 'employee:' || NEW.manager_employee_id
    END,
    NEW.starts_on,
    NEW.ends_on,
    NEW.is_void,
    NEW.recorded_by_action_id,
    NEW.recorded_at
  );
END;

CREATE TRIGGER employee_org_assignment_canonical_compatibility
AFTER INSERT ON employee_org_assignment_period_versions
WHEN NOT EXISTS (
  SELECT 1 FROM organization_change_operations WHERE id = NEW.recorded_by_action_id
)
BEGIN
  INSERT INTO organization_change_operations (
    id, expected_revision, change_count, applied_count,
    resulting_revision, status, recorded_at
  )
  SELECT
    'legacy-assignment:' || NEW.period_id || ':' || NEW.revision,
    revision,
    1,
    0,
    revision + 1,
    'PENDING',
    NEW.recorded_at
  FROM organization_lifecycle_states
  WHERE id = 1;

  INSERT INTO organization_assignment_period_versions (
    period_id, revision, employment_id, employee_id, organization_unit_id,
    assignment_type, position_title, manager_employee_id, starts_on, ends_on,
    is_void, recorded_by_action_id, recorded_at
  ) VALUES (
    'assignment-period:' || NEW.period_id,
    NEW.revision,
    'employment:' || NEW.employment_period_id,
    'employee:' || NEW.employee_id,
    'department:' || NEW.department_code,
    CASE NEW.assignment_type WHEN 'primary' THEN 'PRIMARY' ELSE 'CONCURRENT' END,
    NEW.position_title,
    CASE
      WHEN NEW.manager_employee_id IS NULL THEN NULL
      ELSE 'employee:' || NEW.manager_employee_id
    END,
    NEW.starts_on,
    NEW.ends_on,
    NEW.is_void,
    'legacy-assignment:' || NEW.period_id || ':' || NEW.revision,
    NEW.recorded_at
  );

  UPDATE organization_change_operations
  SET status = 'COMPLETED'
  WHERE id = 'legacy-assignment:' || NEW.period_id || ':' || NEW.revision;
END;

CREATE TRIGGER employee_org_responsibility_operation_guard
BEFORE INSERT ON employee_org_responsibility_period_versions
WHEN EXISTS (
  SELECT 1 FROM organization_change_operations WHERE id = NEW.recorded_by_action_id
)
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is missing or stale')
  WHERE NOT EXISTS (
    SELECT 1
    FROM organization_change_operations AS operation
    JOIN organization_lifecycle_states AS state ON state.id = 1
    WHERE operation.id = NEW.recorded_by_action_id
      AND operation.status = 'PENDING'
      AND operation.applied_count < operation.change_count
      AND state.revision = operation.expected_revision + operation.applied_count
  );

  SELECT RAISE(ABORT, 'organization responsibility revision is not sequential')
  WHERE NEW.revision != coalesce(
    (
      SELECT max(revision)
      FROM employee_org_responsibility_period_versions
      WHERE period_id = NEW.period_id
    ),
    0
  ) + 1;

  SELECT RAISE(ABORT, 'organization responsibility unit is not active')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM organization_unit_period_versions AS unit
    WHERE unit.organization_unit_id = 'department:' || NEW.department_code
      AND unit.is_void = 0
      AND unit.revision = (
        SELECT max(latest.revision)
        FROM organization_unit_period_versions AS latest
        WHERE latest.period_id = unit.period_id
      )
      AND unit.starts_on <= NEW.starts_on
      AND (
        unit.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= unit.ends_on)
      )
  );
END;

CREATE TRIGGER employee_org_responsibility_operation_state
AFTER INSERT ON employee_org_responsibility_period_versions
WHEN EXISTS (
  SELECT 1 FROM organization_change_operations
  WHERE id = NEW.recorded_by_action_id AND status = 'PENDING'
)
BEGIN
  INSERT INTO organization_responsibility_period_versions (
    period_id, revision, employment_id, employee_id, organization_unit_id,
    responsibility_type, starts_on, ends_on, is_void,
    recorded_by_action_id, recorded_at
  )
  SELECT
    'responsibility-period:' || NEW.period_id,
    NEW.revision,
    'employment:' || employment.period_id,
    'employee:' || NEW.employee_id,
    'department:' || NEW.department_code,
    'MANAGER',
    NEW.starts_on,
    NEW.ends_on,
    NEW.is_void,
    NEW.recorded_by_action_id,
    NEW.recorded_at
  FROM employment_period_versions AS employment
  WHERE employment.employee_id = NEW.employee_id
    AND employment.is_void = 0
    AND employment.revision = (
      SELECT max(latest.revision)
      FROM employment_period_versions AS latest
      WHERE latest.period_id = employment.period_id
    )
    AND employment.starts_on <= NEW.starts_on
    AND (employment.ends_on IS NULL OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= employment.ends_on))
  ORDER BY employment.starts_on DESC, employment.period_id
  LIMIT 1;
END;

CREATE TRIGGER employee_org_responsibility_canonical_compatibility
AFTER INSERT ON employee_org_responsibility_period_versions
WHEN NOT EXISTS (
  SELECT 1 FROM organization_change_operations WHERE id = NEW.recorded_by_action_id
)
BEGIN
  INSERT INTO organization_change_operations (
    id, expected_revision, change_count, applied_count,
    resulting_revision, status, recorded_at
  )
  SELECT
    'legacy-responsibility:' || NEW.period_id || ':' || NEW.revision,
    revision,
    1,
    0,
    revision + 1,
    'PENDING',
    NEW.recorded_at
  FROM organization_lifecycle_states
  WHERE id = 1;

  INSERT INTO organization_responsibility_period_versions (
    period_id, revision, employment_id, employee_id, organization_unit_id,
    responsibility_type, starts_on, ends_on, is_void,
    recorded_by_action_id, recorded_at
  )
  SELECT
    'responsibility-period:' || NEW.period_id,
    NEW.revision,
    'employment:' || employment.period_id,
    'employee:' || NEW.employee_id,
    'department:' || NEW.department_code,
    'MANAGER',
    NEW.starts_on,
    NEW.ends_on,
    NEW.is_void,
    'legacy-responsibility:' || NEW.period_id || ':' || NEW.revision,
    NEW.recorded_at
  FROM employment_period_versions AS employment
  WHERE employment.employee_id = NEW.employee_id
    AND employment.is_void = 0
    AND employment.revision = (
      SELECT max(latest.revision)
      FROM employment_period_versions AS latest
      WHERE latest.period_id = employment.period_id
    )
    AND employment.starts_on <= NEW.starts_on
    AND (employment.ends_on IS NULL OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= employment.ends_on))
  ORDER BY employment.starts_on DESC, employment.period_id
  LIMIT 1;

  UPDATE organization_change_operations
  SET status = 'COMPLETED'
  WHERE id = 'legacy-responsibility:' || NEW.period_id || ':' || NEW.revision;
END;

-- 既存の明示済み組織graphを一回のbaseline operationとして移す。履歴は推測しない。
INSERT INTO organization_change_operations (
  id,
  expected_revision,
  change_count,
  applied_count,
  resulting_revision,
  status,
  recorded_at
)
SELECT
  'migration:0138:organization-baseline',
  state.revision,
  1
    + (SELECT count(*) FROM org_departments)
    + (SELECT count(*) FROM employee_org_assignment_period_versions)
    + (SELECT count(*) FROM employee_org_responsibility_period_versions),
  0,
  state.revision
    + 1
    + (SELECT count(*) FROM org_departments)
    + (SELECT count(*) FROM employee_org_assignment_period_versions)
    + (SELECT count(*) FROM employee_org_responsibility_period_versions),
  'PENDING',
  0
FROM organization_lifecycle_states AS state
WHERE state.id = 1;

INSERT INTO organization_units (id, created_at)
VALUES ('company:root', 0);

INSERT INTO organization_units (id, created_at)
SELECT 'department:' || code, 0
FROM org_departments
ORDER BY code;

INSERT INTO organization_unit_period_versions (
  period_id,
  revision,
  organization_unit_id,
  code,
  official_name,
  kind,
  parent_organization_unit_id,
  starts_on,
  ends_on,
  is_void,
  recorded_by_action_id,
  recorded_at
)
SELECT
  'company:root:baseline',
  1,
  'company:root',
  'COMPANY',
  'Company',
  'COMPANY',
  NULL,
  coalesce(
    (SELECT baseline_on FROM lifecycle_migration_states WHERE id = 1),
    '1970-01-01'
  ),
  NULL,
  0,
  'migration:0138:organization-baseline',
  0;

INSERT INTO organization_unit_period_versions (
  period_id,
  revision,
  organization_unit_id,
  code,
  official_name,
  kind,
  parent_organization_unit_id,
  starts_on,
  ends_on,
  is_void,
  recorded_by_action_id,
  recorded_at
)
SELECT
  'department:' || organization.code || ':compatibility',
  1,
  'department:' || organization.code,
  organization.code,
  department.name,
  'DEPARTMENT',
  CASE
    WHEN organization.parent_code IS NULL THEN 'company:root'
    ELSE 'department:' || organization.parent_code
  END,
  coalesce(
    (SELECT baseline_on FROM lifecycle_migration_states WHERE id = 1),
    '1970-01-01'
  ),
  NULL,
  CASE WHEN organization.archived_at IS NULL THEN 0 ELSE 1 END,
  'migration:0138:organization-baseline',
  0
FROM org_departments AS organization
JOIN departments AS department ON department.id = organization.department_id
ORDER BY organization.code;

INSERT INTO organization_assignment_period_versions (
  period_id,
  revision,
  employment_id,
  employee_id,
  organization_unit_id,
  assignment_type,
  position_title,
  manager_employee_id,
  starts_on,
  ends_on,
  is_void,
  recorded_by_action_id,
  recorded_at
)
SELECT
  'assignment-period:' || assignment.period_id,
  assignment.revision,
  'employment:' || assignment.employment_period_id,
  'employee:' || assignment.employee_id,
  'department:' || assignment.department_code,
  CASE assignment.assignment_type
    WHEN 'primary' THEN 'PRIMARY'
    ELSE 'CONCURRENT'
  END,
  assignment.position_title,
  CASE
    WHEN assignment.manager_employee_id IS NULL THEN NULL
    ELSE 'employee:' || assignment.manager_employee_id
  END,
  assignment.starts_on,
  assignment.ends_on,
  assignment.is_void,
  'migration:0138:organization-baseline',
  0
FROM employee_org_assignment_period_versions AS assignment
ORDER BY assignment.period_id, assignment.revision;

INSERT INTO organization_responsibility_period_versions (
  period_id,
  revision,
  employment_id,
  employee_id,
  organization_unit_id,
  responsibility_type,
  starts_on,
  ends_on,
  is_void,
  recorded_by_action_id,
  recorded_at
)
SELECT
  'responsibility-period:' || responsibility.period_id,
  responsibility.revision,
  coalesce(
    (
      SELECT 'employment:' || employment.period_id
      FROM employment_period_versions AS employment
      WHERE employment.employee_id = responsibility.employee_id
        AND employment.is_void = 0
        AND employment.revision = (
          SELECT max(latest.revision)
          FROM employment_period_versions AS latest
          WHERE latest.period_id = employment.period_id
        )
        AND employment.starts_on <= responsibility.starts_on
        AND (
          employment.ends_on IS NULL
          OR (
            responsibility.ends_on IS NOT NULL
            AND responsibility.ends_on <= employment.ends_on
          )
        )
      ORDER BY employment.starts_on DESC, employment.period_id
      LIMIT 1
    ),
    'employment:unresolved:' || responsibility.employee_id
  ),
  'employee:' || responsibility.employee_id,
  'department:' || responsibility.department_code,
  'MANAGER',
  responsibility.starts_on,
  responsibility.ends_on,
  responsibility.is_void,
  'migration:0138:organization-baseline',
  0
FROM employee_org_responsibility_period_versions AS responsibility
ORDER BY responsibility.period_id, responsibility.revision;

UPDATE organization_change_operations
SET status = 'COMPLETED'
WHERE id = 'migration:0138:organization-baseline';

-- 未運用の標準人事発令workflowをtechnical roleからCompany責務へ版付きで更新する。
INSERT OR IGNORE INTO system_procedure_definition_revisions (
  procedure_key, revision, title, category, description, input_schema_json,
  decision_policy_json, completion_operation_key, created_by_account_id, created_at
)
SELECT
  definition.key,
  definition.current_revision + 1,
  current.title,
  current.category,
  current.description,
  current.input_schema_json,
  json_object(
    'schemaVersion', 1,
    'qualificationContext', 'company',
    'approverRoles', json('[]'),
    'workflow', json('{"version":1,"steps":[{"key":"people_operations_approval","name":"People operations approval","approvers":[{"type":"responsibility","responsibility_type":"PEOPLE_OPERATIONS","organization_unit_code":null}],"approval_mode":"any","condition_mode":"all","conditions":[],"due_days":null,"escalation_approvers":[],"rejection_behavior":"reject","allow_delegation":true}]}'),
    'workflowRevision', definition.current_revision + 1
  ),
  current.completion_operation_key,
  'system:migration',
  definition.updated_at + 1
FROM system_procedure_definitions AS definition
JOIN system_procedure_definition_revisions AS current
  ON current.procedure_key = definition.key
 AND current.revision = definition.current_revision
WHERE definition.key = 'personnel_action_request';

UPDATE system_procedure_definitions
SET current_revision = current_revision + 1,
    updated_at = updated_at + 1
WHERE key = 'personnel_action_request';

-- 旧部署writeは互換境界で同じOrgUnit台帳へ原子的に投影する。
CREATE TRIGGER legacy_org_departments_canonical_insert
AFTER INSERT ON org_departments
BEGIN
  INSERT INTO organization_change_operations (
    id, expected_revision, change_count, applied_count,
    resulting_revision, status, recorded_at
  )
  SELECT
    'legacy-org-insert:' || NEW.code,
    revision,
    1,
    0,
    revision + 1,
    'PENDING',
    coalesce(NEW.archived_at, 0)
  FROM organization_lifecycle_states
  WHERE id = 1;

  INSERT INTO organization_units (id, created_at)
  VALUES ('department:' || NEW.code, coalesce(NEW.archived_at, 0));

  INSERT INTO organization_unit_period_versions (
    period_id, revision, organization_unit_id, code, official_name, kind,
    parent_organization_unit_id, starts_on, ends_on, is_void,
    recorded_by_action_id, recorded_at
  )
  SELECT
    'department:' || NEW.code || ':compatibility',
    1,
    'department:' || NEW.code,
    NEW.code,
    department.name,
    'DEPARTMENT',
    CASE
      WHEN NEW.parent_code IS NULL THEN 'company:root'
      ELSE 'department:' || NEW.parent_code
    END,
    '1970-01-01',
    NULL,
    CASE WHEN NEW.archived_at IS NULL THEN 0 ELSE 1 END,
    'legacy-org-insert:' || NEW.code,
    coalesce(NEW.archived_at, 0)
  FROM departments AS department
  WHERE department.id = NEW.department_id;

  UPDATE organization_change_operations
  SET status = 'COMPLETED'
  WHERE id = 'legacy-org-insert:' || NEW.code;
END;

CREATE TRIGGER legacy_org_departments_canonical_update
AFTER UPDATE OF department_id, parent_code, archived_at ON org_departments
WHEN
  NEW.department_id IS NOT OLD.department_id
  OR NEW.parent_code IS NOT OLD.parent_code
  OR NEW.archived_at IS NOT OLD.archived_at
BEGIN
  INSERT INTO organization_change_operations (
    id, expected_revision, change_count, applied_count,
    resulting_revision, status, recorded_at
  )
  SELECT
    'legacy-org-update:' || NEW.code || ':' || (
      SELECT max(revision) + 1
      FROM organization_unit_period_versions
      WHERE period_id = 'department:' || NEW.code || ':compatibility'
    ),
    revision,
    1,
    0,
    revision + 1,
    'PENDING',
    coalesce(NEW.archived_at, 0)
  FROM organization_lifecycle_states
  WHERE id = 1;

  INSERT INTO organization_unit_period_versions (
    period_id, revision, organization_unit_id, code, official_name, kind,
    parent_organization_unit_id, starts_on, ends_on, is_void,
    recorded_by_action_id, recorded_at
  )
  SELECT
    current.period_id,
    current.revision + 1,
    current.organization_unit_id,
    NEW.code,
    department.name,
    'DEPARTMENT',
    CASE
      WHEN NEW.parent_code IS NULL THEN 'company:root'
      ELSE 'department:' || NEW.parent_code
    END,
    current.starts_on,
    current.ends_on,
    CASE WHEN NEW.archived_at IS NULL THEN 0 ELSE 1 END,
    'legacy-org-update:' || NEW.code || ':' || (current.revision + 1),
    coalesce(NEW.archived_at, 0)
  FROM organization_unit_period_versions AS current
  JOIN departments AS department ON department.id = NEW.department_id
  WHERE current.period_id = 'department:' || NEW.code || ':compatibility'
    AND current.revision = (
      SELECT max(latest.revision)
      FROM organization_unit_period_versions AS latest
      WHERE latest.period_id = current.period_id
    );

  UPDATE organization_change_operations
  SET status = 'COMPLETED'
  WHERE id = 'legacy-org-update:' || NEW.code || ':' || (
    SELECT max(revision)
    FROM organization_unit_period_versions
    WHERE period_id = 'department:' || NEW.code || ':compatibility'
  );
END;

CREATE TRIGGER legacy_org_departments_no_delete
BEFORE DELETE ON org_departments
BEGIN
  SELECT RAISE(ABORT, 'legacy organization projection is not deletable');
END;
