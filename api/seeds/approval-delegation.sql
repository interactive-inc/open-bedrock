-- Product-neutral System delegation examples. Company Employee identity stays outside System.

INSERT INTO system_delegations
  (id, delegator_account_id, delegate_account_id, scope_context, scope_kind, scope_id,
   scope_version, starts_at, ends_at, created_at, revoked_at)
VALUES
  ('seed-delegation-1', '1', '2', NULL, NULL, NULL, NULL,
   1786320000000, 1787270399000, 1785549600000, NULL),
  ('seed-delegation-2', '4', '1', NULL, NULL, NULL, NULL,
   1777593600000, 1780271999000, 1777082400000, NULL),
  ('seed-delegation-3', '1', '16', NULL, NULL, NULL, NULL,
   1788220800000, 1790812799000, 1785204000000, 1785387600000);

INSERT INTO system_delegation_procedure_scopes (delegation_id, procedure_key)
VALUES ('seed-delegation-2', 'expense');

INSERT INTO system_delegation_numbers (number, delegation_id) VALUES
  (1, 'seed-delegation-1'),
  (2, 'seed-delegation-2'),
  (3, 'seed-delegation-3');
