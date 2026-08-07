-- governance ドメインの seed
-- 対象テーブル: governance_org_role_assignments, governance_documents, governance_document_versions,
--               governance_document_references, governance_publication_approvals, governance_acknowledgements
-- governance_capabilities / governance_org_roles は migration（0060 系）が正で、ここでは追加しない。
-- 既存の capability（policy-management / information-security）と org role（ciso / privacy-manager）を参照する。
-- 公開済み規程 1 件と、公開承認待ち（pending）の版 1 件を含める。
-- metadata_json は zGovernanceMetadata（strict）を満たす形にすること。

INSERT INTO governance_org_role_assignments (id, org_role_code, employee_id, department_code, starts_on, ends_on, source_document_code, created_by_account_id, created_at, revoked_by_account_id, revoked_at) VALUES
  (1, 'ciso', 4, NULL, '2026-01-05', NULL, NULL, 1, '2026-01-05T00:00:00Z', NULL, NULL),
  (2, 'privacy-manager', 2, NULL, '2026-01-05', NULL, NULL, 1, '2026-01-05T00:00:00Z', NULL, NULL);

-- 公開済み: 在宅勤務規程 1.0.0 / 承認待ち: 情報セキュリティ基本規程 0.1.0
INSERT INTO governance_documents (id, code, title, kind, classification, owner_capability_code, steward_org_role_code, status, current_version_id, source_path, created_by_account_id, created_at, updated_at) VALUES
  ('00000000-0000-4000-8000-000000000001', 'remote-work-policy', '在宅勤務規程', 'policy', 'internal', 'policy-management', NULL, 'published', '00000000-0000-4000-8000-000000000101', 'docs/governance/remote-work-policy.md', 1, '2026-02-01T00:00:00Z', '2026-02-15T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000002', 'information-security-policy', '情報セキュリティ基本規程', 'policy', 'internal', 'information-security', 'ciso', 'draft', '00000000-0000-4000-8000-000000000201', 'docs/governance/information-security-policy.md', 1, '2026-07-01T00:00:00Z', '2026-07-20T00:00:00Z');

INSERT INTO governance_document_versions (id, document_id, version, body_md, metadata_json, procedure_json, content_hash, effective_from, effective_to, review_due_on, state, created_by_account_id, created_at, published_by_account_id, published_at) VALUES
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', '1.0.0', '## 目的

従業員が在宅で勤務する際の条件と手続きを定める。

## 対象

全従業員（雇用形態を問わない）。

## 手続き

- 在宅勤務は前日までに申請する
- 週 3 日を上限とする', '{"id":"remote-work-policy","title":"在宅勤務規程","kind":"policy","version":"1.0.0","classification":"internal","owner_capability":"policy-management","effective_from":"2026-03-01","review_due_on":"2027-03-01"}', NULL, 'seedhash-remote-work-100', '2026-03-01', NULL, '2027-03-01', 'published', 1, '2026-02-01T00:00:00Z', 1, '2026-02-15T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000002', '0.1.0', '## 目的

情報資産を保護するための基本方針を定める。

## 基本方針

- 情報資産は分類し、分類に応じて取り扱う
- アカウントは本人のみが使用する', '{"id":"information-security-policy","title":"情報セキュリティ基本規程","kind":"policy","version":"0.1.0","classification":"internal","owner_capability":"information-security","steward_org_role":"ciso","publication":{"mode":"approval","approver_org_roles":["ciso"]}}', NULL, 'seedhash-infosec-010', NULL, NULL, NULL, 'in_review', 1, '2026-07-01T00:00:00Z', NULL, NULL);

INSERT INTO governance_document_references (version_id, kind, code) VALUES
  ('00000000-0000-4000-8000-000000000101', 'capability', 'policy-management'),
  ('00000000-0000-4000-8000-000000000201', 'capability', 'information-security');

-- 公開承認待ち（pending）を 1 件含める。承認者は ciso（= E004 に割当済み）。
INSERT INTO governance_publication_approvals (version_id, org_role_code, status, decided_by_employee_id, decided_at, comment) VALUES
  ('00000000-0000-4000-8000-000000000201', 'ciso', 'pending', NULL, NULL, NULL);

INSERT INTO governance_acknowledgements (version_id, employee_id, content_hash, acknowledged_at) VALUES
  ('00000000-0000-4000-8000-000000000101', 5, 'seedhash-remote-work-100', '2026-03-02T01:00:00Z'),
  ('00000000-0000-4000-8000-000000000101', 13, 'seedhash-remote-work-100', '2026-03-03T01:00:00Z');
