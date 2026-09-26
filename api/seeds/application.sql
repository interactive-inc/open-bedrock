-- System procedure definitions and immutable proposal examples.
-- Company resolves who is qualified to decide; System stores only Account candidates and evidence.

INSERT INTO system_procedure_definitions (key, current_revision, status, created_at, updated_at) VALUES
  ('paid_leave', 1, 'active', 0, 0),
  ('expense', 1, 'active', 0, 0),
  ('remote_work', 1, 'active', 0, 0),
  ('equipment', 1, 'active', 0, 0),
  ('personnel_action_request', 1, 'active', 0, 0);

INSERT INTO system_procedure_numbers (number, procedure_key) VALUES
  (1, 'paid_leave'),
  (2, 'expense'),
  (3, 'remote_work'),
  (4, 'equipment'),
  (900000001, 'personnel_action_request');

INSERT INTO system_procedure_definition_revisions
  (procedure_key, revision, title, category, description, input_schema_json,
   decision_policy_json, completion_operation_key, created_by_account_id, created_at)
VALUES
  ('paid_leave', 1, '有給休暇申請', 'attendance', '有給休暇の取得を申請します',
   '{"fields":[{"id":"start_date","label":"開始日","type":"date","required":true,"description":null,"options":null},{"id":"end_date","label":"終了日","type":"date","required":true,"description":null,"options":null},{"id":"reason","label":"理由","type":"text","required":false,"description":null,"options":null}]}',
   '{"schemaVersion":1,"qualificationContext":"company","approverRoles":[],"workflow":{"version":1,"steps":[{"key":"manager_approval","name":"Manager approval","approvers":[{"type":"management_chain"}],"approval_mode":"any","condition_mode":"all","conditions":[],"due_days":null,"escalation_approvers":[],"rejection_behavior":"reject","allow_delegation":true}]},"workflowRevision":1}',
   NULL, '01900061-0000-7000-8000-000000000001', 0),
  ('expense', 1, '経費精算申請', 'accounting', '立て替えた経費の精算を申請します',
   '{"fields":[{"id":"amount","label":"金額","type":"number","required":true,"description":null,"options":null},{"id":"category","label":"内訳","type":"text","required":true,"description":null,"options":null},{"id":"note","label":"備考","type":"text","required":false,"description":null,"options":null}]}',
   '{"schemaVersion":1,"qualificationContext":"company","approverRoles":[],"workflow":{"version":1,"steps":[{"key":"manager_approval","name":"Manager approval","approvers":[{"type":"management_chain"}],"approval_mode":"any","condition_mode":"all","conditions":[],"due_days":null,"escalation_approvers":[],"rejection_behavior":"reject","allow_delegation":true}]},"workflowRevision":1}',
   NULL, '01900061-0000-7000-8000-000000000001', 0),
  ('remote_work', 1, '在宅勤務申請', 'attendance', '在宅勤務の事前申請をします',
   '{"fields":[{"id":"date","label":"対象日","type":"date","required":true,"description":null,"options":null},{"id":"reason","label":"理由","type":"text","required":false,"description":null,"options":null}]}',
   '{"schemaVersion":1,"qualificationContext":"company","approverRoles":[],"workflow":{"version":1,"steps":[{"key":"manager_approval","name":"Manager approval","approvers":[{"type":"management_chain"}],"approval_mode":"any","condition_mode":"all","conditions":[],"due_days":null,"escalation_approvers":[],"rejection_behavior":"reject","allow_delegation":true}]},"workflowRevision":1}',
   NULL, '01900061-0000-7000-8000-000000000001', 0),
  ('equipment', 1, '備品購入申請', 'general_affairs', '業務用備品の購入を申請します',
   '{"fields":[{"id":"item","label":"品目","type":"text","required":true,"description":null,"options":null},{"id":"amount","label":"金額","type":"number","required":true,"description":null,"options":null},{"id":"reason","label":"理由","type":"text","required":false,"description":null,"options":null}]}',
   '{"schemaVersion":1,"qualificationContext":"company","approverRoles":[],"workflow":{"version":1,"steps":[{"key":"manager_approval","name":"Manager approval","approvers":[{"type":"management_chain"}],"approval_mode":"any","condition_mode":"all","conditions":[],"due_days":null,"escalation_approvers":[],"rejection_behavior":"reject","allow_delegation":true}]},"workflowRevision":1}',
   NULL, '01900061-0000-7000-8000-000000000001', 0),
  ('personnel_action_request', 1, '人事異動申請', 'employee',
   '発効日付きの雇用ライフサイクル変更を申請します。',
   '{"fields":[{"id":"kind","label":"変更種別","type":"select","required":true,"description":null,"options":["transferred"]},{"id":"employeeCode","label":"従業員コード","type":"text","required":true,"description":null,"options":null},{"id":"eventOn","label":"発効日","type":"date","required":true,"description":null,"options":null},{"id":"departmentCode","label":"異動先部門コード","type":"text","required":true,"description":null,"options":null},{"id":"positionTitle","label":"役職名","type":"text","required":false,"description":null,"options":null},{"id":"managerEmployeeCode","label":"上長従業員コード","type":"text","required":false,"description":null,"options":null}]}',
   '{"schemaVersion":1,"qualificationContext":"company","approverRoles":["hr"],"workflow":{"version":1,"steps":[{"key":"hr_approval","name":"HR approval","approvers":[{"type":"role","role_key":"hr"}],"approval_mode":"any","condition_mode":"all","conditions":[],"due_days":null,"escalation_approvers":[],"rejection_behavior":"reject","allow_delegation":true}]},"workflowRevision":1}',
   'company.personnel-action.apply', '01900061-0000-7000-8000-000000000001', 0);

INSERT INTO system_proposal_series (id, procedure_key, created_by_account_id, created_at) VALUES
  ('01900057-0000-7000-8000-000000000001', 'paid_leave', '01900061-0000-7000-8000-000000000005', 1779238800000),
  ('01900057-0000-7000-8000-000000000002', 'expense', '01900061-0000-7000-8000-000000000009', 1779417000000),
  ('01900057-0000-7000-8000-000000000003', 'remote_work', '01900061-0000-7000-8000-00000000000a', 1778371200000),
  ('01900057-0000-7000-8000-000000000004', 'equipment', '01900061-0000-7000-8000-00000000000d', 1777957200000),
  ('01900057-0000-7000-8000-000000000005', 'paid_leave', '01900061-0000-7000-8000-000000000005', 1779678000000);

INSERT INTO system_proposal_numbers (number, series_id) VALUES
  (1, '01900057-0000-7000-8000-000000000001'),
  (2, '01900057-0000-7000-8000-000000000002'),
  (3, '01900057-0000-7000-8000-000000000003'),
  (4, '01900057-0000-7000-8000-000000000004'),
  (5, '01900057-0000-7000-8000-000000000005');

INSERT INTO system_proposals
  (id, series_id, version, procedure_key, procedure_revision, body_json, digest,
   created_by_account_id, supersedes_proposal_id, created_at)
VALUES
  ('01900058-0000-7000-8000-000000000001', '01900057-0000-7000-8000-000000000001', 1, 'paid_leave', 1,
   '{"end_date":"2026-06-12","reason":"私用","start_date":"2026-06-10"}',
   'a8cdbe660af9c64d07f02c66a166e8f92298242f303c897585ed7d7aefb97511', '01900061-0000-7000-8000-000000000005', NULL, 1779238800000),
  ('01900058-0000-7000-8000-000000000002', '01900057-0000-7000-8000-000000000002', 1, 'expense', 1,
   '{"amount":12000,"category":"transport","note":"取引先訪問"}',
   '599f4efd3756f6d946e440ce3a4aaa8585ed1c73e0e6e5988f10930b592abe8a', '01900061-0000-7000-8000-000000000009', NULL, 1779417000000),
  ('01900058-0000-7000-8000-000000000003', '01900057-0000-7000-8000-000000000003', 1, 'remote_work', 1,
   '{"date":"2026-05-15","reason":"集中作業"}',
   'c5f4578289f36ac0eee945820b252b4eaa61bfaa55ef90485a4ee7cc78a51864', '01900061-0000-7000-8000-00000000000a', NULL, 1778371200000),
  ('01900058-0000-7000-8000-000000000004', '01900057-0000-7000-8000-000000000004', 1, 'equipment', 1,
   '{"amount":45000,"item":"モニター","reason":"デュアルモニター環境構築"}',
   '251b17d9554263c28be4a898fef00dca1e25e92c5828429d2aedbc65fa004855', '01900061-0000-7000-8000-00000000000d', NULL, 1777957200000),
  ('01900058-0000-7000-8000-000000000005', '01900057-0000-7000-8000-000000000005', 1, 'paid_leave', 1,
   '{"end_date":"2026-07-01","reason":"通院","start_date":"2026-07-01"}',
   '77dce588d469d8b043bbe546db27dd1a03f80e8f6446a0bf96b53d3e8ca2b702', '01900061-0000-7000-8000-000000000005', NULL, 1779678000000);

INSERT INTO system_cases
  (id, subject_context, subject_kind, subject_id, subject_version, proposal_digest,
   created_by_account_id, status, created_at, updated_at)
SELECT
  '01900059-0000-7000-8000-' || printf('%012d', number.number), 'system', 'proposal', proposal.series_id, '1',
  proposal.digest, proposal.created_by_account_id, 'pending', proposal.created_at, proposal.created_at
FROM system_proposals AS proposal
JOIN system_proposal_numbers AS number ON number.series_id = proposal.series_id
WHERE number.number BETWEEN 1 AND 5;

INSERT INTO system_proposal_cases (proposal_id, case_id, linked_at)
SELECT proposal.id, '01900059-0000-7000-8000-' || printf('%012d', number.number), proposal.created_at
FROM system_proposals AS proposal
JOIN system_proposal_numbers AS number ON number.series_id = proposal.series_id
WHERE number.number BETWEEN 1 AND 5;

INSERT INTO system_decision_tasks
  (case_id, task_key, round, required_approvals, proposal_digest, opened_at, due_at,
   outcome, closed_at)
SELECT '01900059-0000-7000-8000-' || printf('%012d', number.number), 'manager_approval', 1, 1,
       proposal.digest, proposal.created_at, NULL, NULL, NULL
FROM system_proposals AS proposal
JOIN system_proposal_numbers AS number ON number.series_id = proposal.series_id
WHERE number.number BETWEEN 1 AND 5;

INSERT INTO system_decision_task_exclusions
  (case_id, task_key, round, excluded_account_id, reason)
SELECT '01900059-0000-7000-8000-' || printf('%012d', number.number), 'manager_approval', 1,
       proposal.created_by_account_id, 'creator'
FROM system_proposals AS proposal
JOIN system_proposal_numbers AS number ON number.series_id = proposal.series_id
WHERE number.number BETWEEN 1 AND 5;

INSERT INTO system_decision_task_candidates
  (case_id, task_key, round, candidate_account_id, source, evidence_context,
   evidence_kind, evidence_id, evidence_version, eligibility_digest, eligible_from, resolved_at)
SELECT '01900059-0000-7000-8000-' || printf('%012d', number.number), 'manager_approval', 1, '01900061-0000-7000-8000-000000000001', 'primary',
       'company', 'seed-organizational-authority', 'seed-application-resolution-' || number.number,
       '1', proposal.digest, NULL, proposal.created_at
FROM system_proposals AS proposal
JOIN system_proposal_numbers AS number ON number.series_id = proposal.series_id
WHERE number.number BETWEEN 1 AND 5;

INSERT INTO system_human_attestations
  (id, case_id, task_key, round, actor_account_id, represented_account_id,
   delegation_id, action, proposal_digest, comment, decided_at)
VALUES
  ('0190005a-0000-7000-8000-000000000003', '01900059-0000-7000-8000-000000000003', 'manager_approval', 1,
   '01900061-0000-7000-8000-000000000001', '01900061-0000-7000-8000-000000000001', NULL, 'approve',
   'c5f4578289f36ac0eee945820b252b4eaa61bfaa55ef90485a4ee7cc78a51864', '問題なし', 1778457600000),
  ('0190005a-0000-7000-8000-000000000004', '01900059-0000-7000-8000-000000000004', 'manager_approval', 1,
   '01900061-0000-7000-8000-000000000001', '01900061-0000-7000-8000-000000000001', NULL, 'reject',
   '251b17d9554263c28be4a898fef00dca1e25e92c5828429d2aedbc65fa004855',
   '今期の予算を超過しているため', 1778025600000);

UPDATE system_decision_tasks
SET outcome = 'approved', closed_at = 1778457600000
WHERE case_id = '01900059-0000-7000-8000-000000000003';
UPDATE system_cases SET status = 'approved', updated_at = 1778457600000
WHERE id = '01900059-0000-7000-8000-000000000003';

UPDATE system_decision_tasks
SET outcome = 'rejected', closed_at = 1778025600000
WHERE case_id = '01900059-0000-7000-8000-000000000004';
UPDATE system_cases SET status = 'rejected', updated_at = 1778025600000
WHERE id = '01900059-0000-7000-8000-000000000004';
