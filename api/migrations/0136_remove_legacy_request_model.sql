-- Proposal digests cannot be reconstructed safely in SQL. Refuse to discard any legacy runtime data.
CREATE TABLE legacy_request_removal_guard (
  unsafe_row_count INTEGER NOT NULL CHECK (unsafe_row_count = 0)
);

INSERT INTO legacy_request_removal_guard (unsafe_row_count)
SELECT
  (SELECT count(*) FROM application_requests)
  + (SELECT count(*) FROM application_approvals)
  + (SELECT count(*) FROM application_workflow_instances)
  + (SELECT count(*) FROM application_workflow_step_snapshots)
  + (SELECT count(*) FROM application_workflow_step_candidates)
  + (SELECT count(*) FROM application_workflow_approvals)
  + (SELECT count(*) FROM application_workflow_events)
  + (SELECT count(*) FROM application_subjects)
  + (SELECT count(*) FROM application_completion_bindings)
  + (SELECT count(*) FROM personnel_action_requests
     WHERE system_proposal_series_id IS NULL OR payload_fingerprint IS NULL);

DROP TABLE legacy_request_removal_guard;

DROP TABLE application_workflow_approvals;
DROP TABLE application_workflow_events;
DROP TABLE application_workflow_step_candidates;
DROP TABLE application_workflow_step_snapshots;
DROP TABLE application_workflow_instances;
DROP TABLE application_workflow_revisions;
DROP TABLE application_workflows;
DROP TABLE approval_delegations;
DROP TABLE application_approvals;
DROP TABLE application_subjects;
DROP TABLE application_completion_bindings;
DROP TABLE application_requests;
DROP TABLE application_templates;
