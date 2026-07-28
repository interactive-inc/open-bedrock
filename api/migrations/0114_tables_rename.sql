-- 名前空間マップに従い 21 表を改名する。
-- 方式は ALTER TABLE ... RENAME TO とする。表を作り直すとデータが失われるため使用しない。
-- SQLite の RENAME TO は index と trigger の ON 句を自動で書き換えるが、
-- trigger 本体（WHEN 句・BEGIN ブロック）の表参照は書き換えない。
-- 該当は audit_logs_append_guard_prevent_insert の 1 件のみで、末尾で作り直す。
-- 全 18 trigger を機械走査し、本体に改名対象を実参照する trigger がこれだけであることを確認済み。
-- この database に外部キー制約は無いため、参照の張り替えは発生しない。

ALTER TABLE identity_login_jti RENAME TO identity_login_tokens;
ALTER TABLE audit_logs RENAME TO audit_events;
ALTER TABLE lifecycle_outbox RENAME TO lifecycle_outbox_entries;
ALTER TABLE applications RENAME TO application_requests;
ALTER TABLE documents RENAME TO document_ledger_entries;
ALTER TABLE decisions RENAME TO decision_records;
ALTER TABLE organization_lifecycle_state RENAME TO organization_lifecycle_states;
ALTER TABLE lifecycle_migration_state RENAME TO lifecycle_migration_states;
ALTER TABLE org_assignment_period_versions RENAME TO employee_org_assignment_period_versions;
ALTER TABLE org_responsibility_period_versions RENAME TO employee_org_responsibility_period_versions;
ALTER TABLE grades RENAME TO grade_definitions;
ALTER TABLE positions RENAME TO position_definitions;
ALTER TABLE budgets RENAME TO department_budgets;
ALTER TABLE contracts RENAME TO partner_contracts;
ALTER TABLE licenses RENAME TO software_licenses;
ALTER TABLE certifications RENAME TO certification_definitions;
ALTER TABLE meeting_minutes RENAME TO meeting_minutes_records;
ALTER TABLE recruitment_positions RENAME TO job_openings;
ALTER TABLE thanks RENAME TO thanks_messages;
ALTER TABLE goals RENAME TO performance_goals;
ALTER TABLE skills RENAME TO skill_definitions;

-- audit_logs_append_guard_prevent_insert は WHEN 句の中で audit_logs を参照する。
-- RENAME TO はこの参照を書き換えないため、作り直さないと監査記録の INSERT が
-- すべて "no such table: main.audit_logs" で失敗する。
DROP TRIGGER audit_logs_append_guard_prevent_insert;

CREATE TRIGGER audit_events_append_guard_prevent_insert
BEFORE INSERT ON audit_logs_append_guard
WHEN
  NOT EXISTS (
    SELECT 1
    FROM audit_events
    WHERE id = NEW.audit_id AND event_id = NEW.event_id
  )
  OR EXISTS (
    SELECT 1
    FROM audit_logs_append_guard
    WHERE audit_id = NEW.audit_id OR event_id = NEW.event_id
  )
BEGIN
  SELECT RAISE(ABORT, 'audit_events append guard is immutable');
END;
