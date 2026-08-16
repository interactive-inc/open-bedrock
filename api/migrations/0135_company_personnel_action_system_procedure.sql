-- Company owns personnel-action data and references the generic System proposal by stable identity.

ALTER TABLE personnel_action_requests ADD COLUMN system_proposal_series_id TEXT;
ALTER TABLE personnel_action_requests ADD COLUMN subject_snapshot_json TEXT
  CHECK (subject_snapshot_json IS NULL OR json_valid(subject_snapshot_json));
ALTER TABLE personnel_action_requests ADD COLUMN target_department_code TEXT;
ALTER TABLE personnel_action_requests ADD COLUMN payload_fingerprint TEXT
  CHECK (payload_fingerprint IS NULL OR length(payload_fingerprint) = 64);

CREATE UNIQUE INDEX uq_personnel_action_requests_system_series
  ON personnel_action_requests (system_proposal_series_id)
  WHERE system_proposal_series_id IS NOT NULL;

CREATE TRIGGER personnel_action_requests_system_proposal_insert
BEFORE INSERT ON personnel_action_requests
WHEN
  NEW.system_proposal_series_id IS NULL
  OR NEW.payload_fingerprint IS NULL
  OR NOT EXISTS (
    SELECT 1
    FROM system_proposal_numbers AS number
    JOIN system_proposal_series AS series ON series.id = number.series_id
    WHERE number.number = NEW.application_id
      AND number.series_id = NEW.system_proposal_series_id
      AND series.procedure_key = 'personnel_action_request'
  )
  OR NOT EXISTS (
    SELECT 1
    FROM system_proposals AS proposal
    WHERE proposal.series_id = NEW.system_proposal_series_id
      AND proposal.body_json = NEW.payload_json
  )
BEGIN
  SELECT RAISE(ABORT, 'personnel action requires matching System proposal');
END;

CREATE TRIGGER personnel_action_requests_immutable_proposal
BEFORE UPDATE ON personnel_action_requests
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.application_id IS NOT OLD.application_id
  OR NEW.system_proposal_series_id IS NOT OLD.system_proposal_series_id
  OR NEW.kind IS NOT OLD.kind
  OR NEW.payload_json IS NOT OLD.payload_json
  OR NEW.payload_fingerprint IS NOT OLD.payload_fingerprint
  OR NEW.requested_by_employee_id IS NOT OLD.requested_by_employee_id
  OR NEW.base_employee_revision IS NOT OLD.base_employee_revision
  OR NEW.base_organization_revision IS NOT OLD.base_organization_revision
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.subject_snapshot_json IS NOT OLD.subject_snapshot_json
  OR NEW.target_department_code IS NOT OLD.target_department_code
  OR OLD.withdrawn_at IS NOT NULL
  OR OLD.applied_action_id IS NOT NULL
  OR (NEW.withdrawn_at IS NOT NULL AND NEW.applied_action_id IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT, 'personnel action request proposal is immutable');
END;
