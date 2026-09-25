/**
 * ID棚卸し (`inventory-ids.ts`) が機械的に決められない判断を、人が確定して記録する台帳。
 *
 * 主キーを UUID へ揃える移行 (Issue #1311) の各段は、この台帳と生成物
 * `api/id-inventory.json` を見て対象と影響範囲を決める。新しい table や列を足したときに
 * 分類を書き忘れると `bun run check` と契約テストが落ちる。
 */

export type PermanentNonUuidPrimaryKey = Readonly<{
  kind: "allocator" | "singleton" | "secret"
  reason: string
}>

/**
 * 主キーを UUID にしない table。主キーが識別子ではない場合に限って足す。
 * 変換の手間を理由に足してはならない。
 */
export const PERMANENT_NON_UUID_PRIMARY_KEYS: ReadonlyMap<string, PermanentNonUuidPrimaryKey> =
  new Map<string, PermanentNonUuidPrimaryKey>([
    [
      "system_delegation_numbers",
      { kind: "allocator", reason: "整数そのものが利用者に見せる委任番号で、採番器の値である" },
    ],
    [
      "system_procedure_numbers",
      { kind: "allocator", reason: "整数そのものが手続きごとの案件番号で、採番器の値である" },
    ],
    [
      "system_proposal_numbers",
      { kind: "allocator", reason: "整数そのものが提案番号で、採番器の値である" },
    ],
    [
      "system_bootstrap_state",
      {
        kind: "singleton",
        reason: "CHECK (singleton = 1) の1行だけを持つ状態で、識別子を持たない",
      },
    ],
    [
      "company_organization_lifecycle_states",
      { kind: "singleton", reason: "CHECK (id = 1) の1行だけを持つ排他用の版で、識別子を持たない" },
    ],
    [
      "system_browser_login_codes",
      { kind: "secret", reason: "主キーはログインコードの hash で、秘密値から導く照合鍵である" },
    ],
    [
      "system_cli_login_codes",
      { kind: "secret", reason: "主キーはログインコードの hash で、秘密値から導く照合鍵である" },
    ],
    [
      "system_cli_login_states",
      {
        kind: "secret",
        reason: "主キーは CLI ログインの state で、推測されない乱数そのものである",
      },
    ],
    [
      "system_identity_login_tokens",
      {
        kind: "secret",
        reason: "主キーはトークン発行者が決める jti で、再利用を拒否するための照合鍵である",
      },
    ],
    [
      "system_oidc_access_tokens",
      { kind: "secret", reason: "主キーはアクセストークンの hash で、秘密値から導く照合鍵である" },
    ],
    [
      "system_oidc_authorization_codes",
      { kind: "secret", reason: "主キーは認可コードの hash で、秘密値から導く照合鍵である" },
    ],
  ])

/**
 * `kind:...` の形を組み立てて主キーにしている table。値に種別や由来を埋め込むため、
 * UUID へ変えるときは値の組み立てを置き換える設計判断が要る。
 */
export const PREFIXED_TEXT_PRIMARY_KEY_TABLES: ReadonlySet<string> = new Set([
  "company_account_employee_resource_bindings",
  "company_assignment_period_bindings",
  "company_assignment_resource_bindings",
  "company_employments",
  "company_organization_change_operations",
  "company_organization_units",
  "company_organizations",
  "company_personnel_actions",
  "company_personnel_reporting_bindings",
  "company_responsibility_period_bindings",
  "company_responsibility_resource_bindings",
])

/** 列名が `code` / `key` でなくても、業務上の意味を持つ値を主キーにしている table。 */
export const BUSINESS_CODE_TEXT_PRIMARY_KEY_TABLES: ReadonlySet<string> = new Set<string>([])

/**
 * 外部キーを宣言していない `*_id` / `*_code` / `*_key` / `*_ref` 列の分類。
 *
 * - same-context: 同じ context の table を指す。外部キーを足せるか、UUID 化で一緒に書き換える
 * - cross-context: 別 context の table を指す。依存方向 業務 -> company -> system に従う
 * - polymorphic: 別の列 (resource_type など) で指す table が変わる
 * - historical: 監査・履歴として当時の値を残す。指す先が消えても書き換えない
 * - external: 外部や client が決める値 (冪等性キー、外部システムの ID、保存先の key)
 * - not-reference: 名前は参照に見えるが参照ではない (自身の識別子、列挙値、コード内の catalog の key)
 */
export type SoftReferenceClassification =
  | "same-context"
  | "cross-context"
  | "polymorphic"
  | "historical"
  | "external"
  | "not-reference"

export type SoftReference = Readonly<{
  classification: SoftReferenceClassification
  /** same-context / cross-context / historical で指す table。 */
  target?: string
  note?: string
}>

const sameContext = (target: string, note?: string): SoftReference => ({
  classification: "same-context",
  target,
  ...(note === undefined ? {} : { note }),
})

const crossContext = (target: string, note?: string): SoftReference => ({
  classification: "cross-context",
  target,
  ...(note === undefined ? {} : { note }),
})

const historical = (target: string, note?: string): SoftReference => ({
  classification: "historical",
  target,
  ...(note === undefined ? {} : { note }),
})

const polymorphic = (note: string): SoftReference => ({ classification: "polymorphic", note })

const external = (note: string): SoftReference => ({ classification: "external", note })

const notReference = (note: string): SoftReference => ({ classification: "not-reference", note })

const IDEMPOTENCY_COMMAND = external("client が送る冪等性の command id")
const AUDIT_REQUEST = external("HTTP request の相関 ID")
const REASON_CODE = notReference("理由の列挙値")
const ERROR_CODE = notReference("失敗の列挙値")
const OPERATION_KEY = notReference("コードで定義した operation catalog の key")
const HANDLER_KEY = notReference("コードで定義した handler catalog の key")
const IDEMPOTENCY_KEY = external("呼び出し元が決める冪等性キー")
const PERIOD_IDENTITY = notReference("版を束ねる期間自身の識別子。revision と組で主キーになる")
const DEPARTMENT_CODE = crossContext(
  "company_organization_units",
  "'department:' || code で組織単位を指す",
)
const SYSTEM_ACCOUNT = crossContext("system_accounts")
const COMPANY_EMPLOYEE_FROM_COMPANY = sameContext("company_employees")
const LEGACY_PRIMARY_KEY = notReference(
  "主キーを UUID へ移す前の自身の主キー。移行前の証跡が指す旧 ID から現在の行を辿る",
)
const PROCEDURE_REQUEST_KEY = external(
  "client が送る UUID の冪等性キー。System の案件の subject になる",
)

export const SOFT_REFERENCES: Readonly<Record<string, SoftReference>> = {
  "governance_org_role_assignments.legacy_id": LEGACY_PRIMARY_KEY,
  "knowledge_articles.legacy_id": LEGACY_PRIMARY_KEY,
  "onboarding_assignments.legacy_id": LEGACY_PRIMARY_KEY,
  "onboarding_tasks.legacy_id": LEGACY_PRIMARY_KEY,
  "onboarding_templates.legacy_id": LEGACY_PRIMARY_KEY,
  "evaluation_sheet_audit_logs.legacy_id": LEGACY_PRIMARY_KEY,
  "evaluation_sheets.legacy_id": LEGACY_PRIMARY_KEY,
  "evaluation_templates.legacy_id": LEGACY_PRIMARY_KEY,
  "goal_evaluations.legacy_id": LEGACY_PRIMARY_KEY,
  "performance_goals.legacy_id": LEGACY_PRIMARY_KEY,
  "review_cycles.legacy_id": LEGACY_PRIMARY_KEY,
  "review_forms.legacy_id": LEGACY_PRIMARY_KEY,
  "job_openings.legacy_id": LEGACY_PRIMARY_KEY,
  "recruitment_candidates.legacy_id": LEGACY_PRIMARY_KEY,
  "rooms.legacy_id": LEGACY_PRIMARY_KEY,
  "shift_assignments.legacy_id": LEGACY_PRIMARY_KEY,
  "shift_patterns.legacy_id": LEGACY_PRIMARY_KEY,
  "shift_swap_requests.legacy_id": LEGACY_PRIMARY_KEY,
  "survey_responses.legacy_id": LEGACY_PRIMARY_KEY,
  "surveys.legacy_id": LEGACY_PRIMARY_KEY,
  "thanks_messages.legacy_id": LEGACY_PRIMARY_KEY,
  "thanks_point_budgets.legacy_id": LEGACY_PRIMARY_KEY,
  "thanks_redemptions.legacy_id": LEGACY_PRIMARY_KEY,
  "thanks_rewards.legacy_id": LEGACY_PRIMARY_KEY,
  "training_courses.legacy_id": LEGACY_PRIMARY_KEY,
  "training_enrollments.legacy_id": LEGACY_PRIMARY_KEY,
  "announcements.legacy_id": LEGACY_PRIMARY_KEY,
  "asset_lendings.legacy_id": LEGACY_PRIMARY_KEY,
  "attendance_records.legacy_id": LEGACY_PRIMARY_KEY,
  "career_applications.legacy_id": LEGACY_PRIMARY_KEY,
  "career_postings.legacy_id": LEGACY_PRIMARY_KEY,
  "certification_definitions.legacy_id": LEGACY_PRIMARY_KEY,
  "decision_records.legacy_id": LEGACY_PRIMARY_KEY,
  "employee_certifications.legacy_id": LEGACY_PRIMARY_KEY,
  "meeting_minutes_records.legacy_id": LEGACY_PRIMARY_KEY,
  "meetings.legacy_id": LEGACY_PRIMARY_KEY,
  "partner_contracts.legacy_id": LEGACY_PRIMARY_KEY,
  "partners.legacy_id": LEGACY_PRIMARY_KEY,
  "regulation_versions.legacy_id": LEGACY_PRIMARY_KEY,
  "regulations.legacy_id": LEGACY_PRIMARY_KEY,
  "commendations.legacy_id": LEGACY_PRIMARY_KEY,
  "company_calendar_days.legacy_id": LEGACY_PRIMARY_KEY,
  "disciplinary_actions.legacy_id": LEGACY_PRIMARY_KEY,
  "document_ledger_entries.legacy_id": LEGACY_PRIMARY_KEY,
  "employee_work_styles.legacy_id": LEGACY_PRIMARY_KEY,
  "headcount_plans.legacy_id": LEGACY_PRIMARY_KEY,
  "health_checkups.legacy_id": LEGACY_PRIMARY_KEY,
  "it_incidents.legacy_id": LEGACY_PRIMARY_KEY,
  "salary_revisions.legacy_id": LEGACY_PRIMARY_KEY,
  "work_accidents.legacy_id": LEGACY_PRIMARY_KEY,
  "asset_lendings.asset_code": sameContext("assets"),
  "career_applications.posting_id": sameContext("career_postings"),
  "career_postings.dept_id": historical(
    "company_organization_units",
    "旧部署の数値 ID。どの組織単位も指さず organization_unit_id に置き換え済み",
  ),
  "company_assignment_resource_adoptions.command_id": IDEMPOTENCY_COMMAND,
  "company_assignment_resource_adoptions.actor_account_id": SYSTEM_ACCOUNT,
  "company_assignment_resource_bindings.resource_id": sameContext(
    "company_resource_heads",
    "resource_type = 'assignment' の resource",
  ),
  "company_audit_append_guard.audit_id": sameContext("company_audit_events"),
  "company_audit_append_guard.event_id": sameContext("company_audit_events"),
  "company_audit_batch_decisions.decision_id": notReference("監査の一括判断自身の識別子"),
  "company_audit_event_appends.staging_id": notReference("追記待ち行自身の識別子"),
  "company_audit_event_appends.event_id": notReference("追記する監査イベント自身の公開 ID"),
  "company_audit_event_appends.request_id": AUDIT_REQUEST,
  "company_audit_event_appends.actor_account_id": historical("system_accounts"),
  "company_audit_event_appends.actor_employee_id": historical("company_employees"),
  "company_audit_event_appends.target_id": polymorphic("target_type で指す資源が変わる"),
  "company_audit_event_appends.reason_code": REASON_CODE,
  "company_audit_event_employee_contexts.audit_event_id": sameContext("company_audit_events"),
  "company_audit_event_employee_contexts.employee_id": historical("company_employees"),
  "company_audit_events.event_id": notReference("監査イベント自身の公開 ID"),
  "company_audit_events.request_id": AUDIT_REQUEST,
  "company_audit_events.actor_account_id": historical("system_accounts"),
  "company_audit_events.target_id": polymorphic("target_type で指す資源が変わる"),
  "company_audit_events.reason_code": REASON_CODE,
  "company_bootstrap_receipts.command_id": IDEMPOTENCY_COMMAND,
  "company_command_receipts.command_id": IDEMPOTENCY_COMMAND,
  "company_definition_resource_adoptions.definition_id": polymorphic(
    "resource_type で等級・役職などの定義 table が変わる",
  ),
  "company_employee_lifecycle_revisions.employee_id": COMPANY_EMPLOYEE_FROM_COMPANY,
  "company_employee_resource_adoptions.command_id": IDEMPOTENCY_COMMAND,
  "company_employee_status_period_versions.period_id": PERIOD_IDENTITY,
  "company_employee_status_period_versions.employment_period_id": sameContext(
    "company_employment_period_versions",
  ),
  "company_employee_status_period_versions.employee_id": COMPANY_EMPLOYEE_FROM_COMPANY,
  "company_employee_status_period_versions.recorded_by_action_id": sameContext(
    "company_personnel_actions",
  ),
  "company_employees.employee_code": notReference("従業員コード。業務上の一意な属性"),
  "company_employment_period_versions.period_id": PERIOD_IDENTITY,
  "company_employment_period_versions.employee_id": COMPANY_EMPLOYEE_FROM_COMPANY,
  "company_employment_period_versions.recorded_by_action_id": sameContext(
    "company_personnel_actions",
  ),
  "company_external_identity_imports.command_id": IDEMPOTENCY_COMMAND,
  "company_grade_award_archives.command_id": IDEMPOTENCY_COMMAND,
  "company_lifecycle_outbox_entries.personnel_action_id": sameContext("company_personnel_actions"),
  "company_lifecycle_outbox_entries.last_error_code": ERROR_CODE,
  "company_organization_assignment_period_versions.period_id": PERIOD_IDENTITY,
  "company_organization_assignment_period_versions.employment_id":
    sameContext("company_employments"),
  "company_organization_assignment_period_versions.employee_id": COMPANY_EMPLOYEE_FROM_COMPANY,
  "company_organization_assignment_period_versions.manager_employee_id":
    COMPANY_EMPLOYEE_FROM_COMPANY,
  "company_organization_change_operations.actor_account_id": SYSTEM_ACCOUNT,
  "company_organization_resource_adoptions.command_id": IDEMPOTENCY_COMMAND,
  "company_organization_responsibility_period_versions.period_id": PERIOD_IDENTITY,
  "company_organization_responsibility_period_versions.employment_id":
    sameContext("company_employments"),
  "company_organization_responsibility_period_versions.employee_id": COMPANY_EMPLOYEE_FROM_COMPANY,
  "company_organization_unit_period_versions.period_id": PERIOD_IDENTITY,
  "company_personnel_action_requests.application_id": historical(
    "system_proposals",
    "旧申請の整数 ID。申請は System の提案へ移行済み",
  ),
  "company_personnel_action_requests.target_employee_id": COMPANY_EMPLOYEE_FROM_COMPANY,
  "company_personnel_action_requests.requested_by_employee_id": COMPANY_EMPLOYEE_FROM_COMPANY,
  "company_personnel_action_requests.applied_action_id": sameContext("company_personnel_actions"),
  "company_personnel_action_requests.withdrawn_by_employee_id": COMPANY_EMPLOYEE_FROM_COMPANY,
  "company_personnel_action_requests.system_proposal_series_id":
    crossContext("system_proposal_series"),
  "company_personnel_action_requests.target_department_code": sameContext(
    "company_organization_units",
    "'department:' || code で組織単位を指す",
  ),
  "company_personnel_actions.employee_id": COMPANY_EMPLOYEE_FROM_COMPANY,
  "company_personnel_actions.recorded_by_account_id": SYSTEM_ACCOUNT,
  "company_personnel_actions.requested_by_employee_id": COMPANY_EMPLOYEE_FROM_COMPANY,
  "company_personnel_actions.source_application_id": historical(
    "system_proposals",
    "旧申請の整数 ID。申請は System の提案へ移行済み",
  ),
  "company_personnel_actions.corrects_action_id": sameContext("company_personnel_actions"),
  "company_personnel_actions.operation_id": sameContext("company_organization_change_operations"),
  "company_personnel_annotations.employee_id": COMPANY_EMPLOYEE_FROM_COMPANY,
  "company_personnel_annotations.from_department_code": historical(
    "company_organization_units",
    "異動時点の部署コードを残す",
  ),
  "company_personnel_annotations.to_department_code": historical(
    "company_organization_units",
    "異動時点の部署コードを残す",
  ),
  "company_resource_heads.resource_id": notReference("resource_type と組になる資源自身の識別子"),
  "company_resource_revisions.resource_id": sameContext("company_resource_heads"),
  "company_resource_revisions.command_id": IDEMPOTENCY_COMMAND,
  "company_resource_revisions.actor_account_id": SYSTEM_ACCOUNT,
  "company_responsibility_resource_adoptions.command_id": IDEMPOTENCY_COMMAND,
  "company_responsibility_resource_bindings.resource_id": sameContext(
    "company_resource_heads",
    "resource_type = 'responsibility-assignment' の resource",
  ),
  "company_responsibility_resource_bindings.responsibility_id": sameContext(
    "company_resource_heads",
    "resource_type = 'responsibility' の定義",
  ),
  "company_responsibility_resource_bindings.authority_scope_id": sameContext(
    "company_resource_heads",
    "resource_type = 'authority-scope' の定義",
  ),
  "company_responsibility_source_adoptions.source_id": polymorphic(
    "source_context と source_kind で取り込み元の table が変わる",
  ),
  "company_responsibility_source_cutovers.organization_id": sameContext("company_organizations"),
  "company_workforce_connection_completions.command_id": IDEMPOTENCY_COMMAND,
  "company_workforce_connection_completions.actor_account_id": SYSTEM_ACCOUNT,
  "company_workforce_resource_bindings.last_action_id": sameContext("company_personnel_actions"),
  "decision_records.superseded_by_id": sameContext("decision_records"),
  "employee_certifications.certification_id": sameContext("certification_definitions"),
  "employee_skills.skill_code": sameContext("skill_definitions"),
  "evaluation_sheet_audit_logs.sheet_id": sameContext("evaluation_sheets"),
  "evaluation_sheets.template_id": sameContext("evaluation_templates"),
  "expense_approvals.expense_id": sameContext("expenses"),
  "expense_attachments.expense_id": sameContext("expenses"),
  "expense_attachments.attachment_id": crossContext("system_attachments"),
  "expense_procedure_bindings.request_key": PROCEDURE_REQUEST_KEY,
  "goal_evaluations.goal_id": sameContext("performance_goals"),
  "governance_acknowledgements.version_id": sameContext("governance_document_versions"),
  "governance_capabilities.owner_org_role_code": sameContext("governance_org_roles"),
  "governance_document_references.version_id": sameContext("governance_document_versions"),
  "governance_document_versions.document_id": sameContext("governance_documents"),
  "governance_document_versions.created_by_account_id": SYSTEM_ACCOUNT,
  "governance_document_versions.published_by_account_id": SYSTEM_ACCOUNT,
  "governance_documents.owner_capability_code": sameContext("governance_capabilities"),
  "governance_documents.steward_org_role_code": sameContext("governance_org_roles"),
  "governance_documents.current_version_id": sameContext("governance_document_versions"),
  "governance_documents.created_by_account_id": SYSTEM_ACCOUNT,
  "governance_org_role_assignments.org_role_code": sameContext("governance_org_roles"),
  "governance_org_role_assignments.department_code": DEPARTMENT_CODE,
  "governance_org_role_assignments.source_document_code": external(
    "任命の根拠とした文書の番号。文書 table の行を指さない",
  ),
  "governance_org_role_assignments.created_by_account_id": SYSTEM_ACCOUNT,
  "governance_org_role_assignments.revoked_by_account_id": SYSTEM_ACCOUNT,
  "governance_publication_approvals.version_id": sameContext("governance_document_versions"),
  "governance_publication_approvals.org_role_code": sameContext("governance_org_roles"),
  "headcount_plans.department_code": DEPARTMENT_CODE,
  "job_openings.department_code": DEPARTMENT_CODE,
  "knowledge_article_revisions.command_id": IDEMPOTENCY_COMMAND,
  "leave_procedure_bindings.request_key": PROCEDURE_REQUEST_KEY,
  "meeting_minutes_records.meeting_id": sameContext("meetings"),
  "onboarding_assignments.template_code": sameContext("onboarding_templates"),
  "onboarding_lifecycle_template_bindings.template_code": sameContext("onboarding_templates"),
  "onboarding_lifecycle_template_bindings.updated_by_account_id": SYSTEM_ACCOUNT,
  "onboarding_tasks.assignment_id": sameContext("onboarding_assignments"),
  "onboarding_tasks.template_task_code": sameContext("onboarding_template_tasks"),
  "onboarding_template_tasks.template_code": sameContext("onboarding_templates"),
  "partner_contracts.partner_id": sameContext("partners"),
  "performance_goals.parent_goal_id": sameContext("performance_goals"),
  "performance_goals.department_code": DEPARTMENT_CODE,
  "performance_goals.evaluation_sheet_id": sameContext("evaluation_sheets"),
  "recruitment_candidates.position_id": sameContext("job_openings"),
  "regulation_versions.regulation_id": sameContext("regulations"),
  "review_cycle_policies.cycle_id": sameContext("review_cycles"),
  "review_forms.cycle_id": sameContext("review_cycles"),
  "ringi_procedure_bindings.request_key": PROCEDURE_REQUEST_KEY,
  "room_reservations.room_id": sameContext("rooms"),
  "shift_assignments.pattern_id": sameContext("shift_patterns"),
  "software_license_changes.command_id": IDEMPOTENCY_COMMAND,
  "stocktake_items.stocktake_id": sameContext("stocktakes"),
  "stocktake_items.asset_code": sameContext("assets"),
  "survey_responses.survey_id": sameContext("surveys"),
  "system_account_invitations.resource_id": polymorphic(
    "招待で付与する role の resource_type で変わる",
  ),
  "system_account_invitations.related_resource_id": polymorphic(
    "招待に関連付ける資源の種別で変わる",
  ),
  "system_attachment_preservations.attachment_id": sameContext("system_attachments"),
  "system_attachment_preservations.created_by_account_id": sameContext("system_accounts"),
  "system_attachment_preservations.release_operation_id": IDEMPOTENCY_COMMAND,
  "system_attachment_preservations.released_by_account_id": sameContext("system_accounts"),
  "system_attachments.owner_account_id": sameContext("system_accounts"),
  "system_attachments.object_key": external("object storage 上の保存先 key"),
  "system_audit_disclosure_policy_revisions.command_id": IDEMPOTENCY_COMMAND,
  "system_audit_events.event_id": notReference("監査イベント自身の公開 ID"),
  "system_audit_events.actor_account_id": historical("system_accounts"),
  "system_audit_events.target_id": polymorphic("target_type で指す資源が変わる"),
  "system_audit_events.reason_code": REASON_CODE,
  "system_cases.subject_id": polymorphic("subject_context と subject_kind で指す資源が変わる"),
  "system_dead_letters.source_id": polymorphic("source_type で失敗元の job や message が変わる"),
  "system_dead_letters.reason_code": REASON_CODE,
  "system_decision_task_candidates.evidence_id": polymorphic("候補とした根拠の種別で変わる"),
  "system_decision_tasks.task_key": notReference("手続き定義の中の判断 task の key"),
  "system_delegations.scope_id": polymorphic("scope_type で委任範囲の資源が変わる"),
  "system_execution_authorizations.operation_key": OPERATION_KEY,
  "system_external_assertions.external_key": external("外部システムが付けた識別子"),
  "system_iam_role_permissions.permission_key": notReference(
    "コードで定義した permission catalog の key",
  ),
  "system_inbox_messages.source_key": external("受信元の識別子"),
  "system_inbox_messages.external_message_id": external("受信元が付けたメッセージ ID"),
  "system_inbox_messages.reason_code": REASON_CODE,
  "system_integration_exchanges.operation_key": OPERATION_KEY,
  "system_integration_exchanges.idempotency_key": IDEMPOTENCY_KEY,
  "system_integration_exchanges.last_error_code": ERROR_CODE,
  "system_jobs.operation_key": OPERATION_KEY,
  "system_jobs.idempotency_key": IDEMPOTENCY_KEY,
  "system_jobs.last_error_code": ERROR_CODE,
  "system_jobs.handler_key": HANDLER_KEY,
  "system_notification_messages.source_id": polymorphic("source_type で通知元の資源が変わる"),
  "system_notification_messages.dedupe_key": notReference("通知の重複を抑える導出キー"),
  "system_notification_messages.action_id": polymorphic("通知から開く操作の種別で変わる"),
  "system_notification_resource_scopes.resource_id": polymorphic(
    "resource_type で閲覧範囲の資源が変わる",
  ),
  "system_oidc_access_tokens.client_id": external("OIDC client の識別子"),
  "system_oidc_authorization_codes.client_id": external("OIDC client の識別子"),
  "system_operation_receipts.operation_key": OPERATION_KEY,
  "system_operation_receipts.scope_key": notReference("operation の排他範囲を表す導出キー"),
  "system_operation_receipts.command_id": IDEMPOTENCY_COMMAND,
  "system_operation_receipts.actor_account_id": sameContext("system_accounts"),
  "system_operation_receipts.actor_principal_id": sameContext("system_principals"),
  "system_outbox_messages.source_id": polymorphic("source_type で送信元の資源が変わる"),
  "system_outbox_messages.idempotency_key": IDEMPOTENCY_KEY,
  "system_outbox_messages.last_error_code": ERROR_CODE,
  "system_outbox_messages.handler_key": HANDLER_KEY,
  "system_procedure_definition_revisions.completion_operation_key": OPERATION_KEY,
  "system_reconciliation_items.item_key": external("照合対象の外部側の識別子"),
  "system_record_coverage_entries.source_record_id": polymorphic(
    "record_kind で保全対象の table が変わる",
  ),
  "system_record_disclosure_policies.record_id": polymorphic("開示方針を付ける記録の種別で変わる"),
  "system_record_retirement_attachment_pins.attachment_id": sameContext("system_attachments"),
  "system_role_bindings.resource_id": polymorphic("role の resource_type で指す資源が変わる"),
  "system_sessions.family_id": notReference("refresh token の系列を束ねる識別子"),
  "system_work_item_revisions.command_id": IDEMPOTENCY_COMMAND,
  "thanks_redemptions.reward_id": sameContext("thanks_rewards"),
  "training_enrollments.course_id": sameContext("training_courses"),
}
