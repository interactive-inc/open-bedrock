-- Company personnel-action data attached to one immutable System proposal.

INSERT INTO system_proposal_series (id, procedure_key, created_by_account_id, created_at)
VALUES ('seed-personnel-action-series-9001', 'personnel_action_request', '2', 1785546000000);

INSERT INTO system_proposal_numbers (number, series_id)
VALUES (9001, 'seed-personnel-action-series-9001');

INSERT INTO system_proposals
  (id, series_id, version, procedure_key, procedure_revision, body_json, digest,
   created_by_account_id, supersedes_proposal_id, created_at)
VALUES
  ('seed-personnel-action-proposal-9001', 'seed-personnel-action-series-9001', 1,
   'personnel_action_request', 1,
   '{"departmentCode":"D005","employeeCode":"E010","eventOn":"2026-09-01","kind":"transferred","managerEmployeeCode":"E013","positionTitle":null}',
   '936b9b104d9a2aa2d6ba40b1288c58525db110746d4b40903cdd3d76a7ac4cee',
   '2', NULL, 1785546000000);

INSERT INTO system_cases
  (id, subject_context, subject_kind, subject_id, subject_version, proposal_digest,
   created_by_account_id, status, created_at, updated_at)
VALUES
  ('seed-personnel-action-case-9001', 'company', 'personnel-action-request',
   '00000000-0000-4000-8000-000000009001', '1',
   '936b9b104d9a2aa2d6ba40b1288c58525db110746d4b40903cdd3d76a7ac4cee',
   '2', 'pending', 1785546000000, 1785546000000);

INSERT INTO system_proposal_cases (proposal_id, case_id, linked_at)
VALUES ('seed-personnel-action-proposal-9001', 'seed-personnel-action-case-9001', 1785546000000);

INSERT INTO system_decision_tasks
  (case_id, task_key, round, required_approvals, proposal_digest, opened_at, due_at,
   outcome, closed_at)
VALUES
  ('seed-personnel-action-case-9001', 'hr_approval', 1, 1,
   '936b9b104d9a2aa2d6ba40b1288c58525db110746d4b40903cdd3d76a7ac4cee',
   1785546000000, NULL, NULL, NULL);

INSERT INTO system_decision_task_exclusions
  (case_id, task_key, round, excluded_account_id, reason)
VALUES ('seed-personnel-action-case-9001', 'hr_approval', 1, '2', 'creator');

INSERT INTO system_decision_task_candidates
  (case_id, task_key, round, candidate_account_id, source, evidence_context,
   evidence_kind, evidence_id, evidence_version, eligibility_digest, eligible_from, resolved_at)
VALUES
  ('seed-personnel-action-case-9001', 'hr_approval', 1, '3', 'primary', 'company',
   'organizational-authority', 'seed-personnel-action-resolution-9001', '1',
   '936b9b104d9a2aa2d6ba40b1288c58525db110746d4b40903cdd3d76a7ac4cee',
   NULL, 1785546000000);

INSERT INTO personnel_action_requests
  (id, application_id, system_proposal_series_id, target_employee_id,
   subject_snapshot_json, target_department_code, kind, payload_json, payload_fingerprint,
   requested_by_employee_id, base_employee_revision, base_organization_revision,
   created_at, applied_action_id, withdrawn_at, withdrawn_by_employee_id)
VALUES
  ('00000000-0000-4000-8000-000000009001', 9001,
   'seed-personnel-action-series-9001', 10, NULL, 'D005', 'transferred',
   '{"departmentCode":"D005","employeeCode":"E010","eventOn":"2026-09-01","kind":"transferred","managerEmployeeCode":"E013","positionTitle":null}',
   'b024d76055a494b15fe65fcceefa63654de2dfc825fcea7631939acd23c1d007',
   2, 0, 0, 1785546000, NULL, NULL, NULL);
