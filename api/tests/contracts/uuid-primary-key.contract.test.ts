import { uuidCheckPredicate } from "@/lib/uuid/uuid.schema"
import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { executeSql } from "../../scripts/sql-statements"

/**
 * 主キーを UUID に統一する (Issue #1311)。
 *
 * この test が「UUID 以外の主キーを許さない」ことの正本になる。段階移行の途中でも
 * 常に緑であるよう、除外を 2 つの list に分けて持つ。
 *
 * - PERMANENTLY_NON_UUID … UUID にしてはいけない table。減らない
 * - NOT_YET_CONVERTED    … これから変換する table。各段の PR がここから削る
 *
 * 両者を混ぜると、移行完了時に「今後も整数のまま」と「変換し忘れ」を区別できなくなる。
 */

/**
 * UUID にしてはいけない table。行ごとに理由を残す。
 *
 * ここに足すのは、主キーが「識別子ではない」場合に限る。連番を UUID へ変えるのが
 * 面倒だという理由で足してはならない。
 */
const PERMANENTLY_NON_UUID: ReadonlySet<string> = new Set([
  // PKが列挙キー
  "company_lifecycle_effect_template_bindings",
  // singleton (CHECK id=1)
  "company_organization_lifecycle_states",
  // singleton (CHECK id=1)
  "system_bootstrap_state",
  // PKがhash/token。識別子ではない
  "system_browser_login_codes",
  // PKがhash/token。識別子ではない
  "system_cli_login_codes",
  // PKがhash/token。識別子ではない
  "system_cli_login_states",
  // 採番器: integerが業務上の案件番号そのもの
  "system_delegation_numbers",
  // PKがhash/token。識別子ではない
  "system_identity_login_tokens",
  // PKがhash/token。識別子ではない
  "system_oidc_access_tokens",
  // PKがhash/token。識別子ではない
  "system_oidc_authorization_codes",
  // 採番器: integerが業務上の案件番号そのもの
  "system_procedure_numbers",
  // 採番器: integerが業務上の案件番号そのもの
  "system_proposal_numbers",
])

/**
 * まだ UUID の主キーになっていない table。Issue #1311 の各段が完了するたびに削る。
 * 空になった時点で移行が終わる。
 *
 * 既に `crypto.randomUUID()` で v4 を採番している table もここに含む。値は UUID でも
 * CHECK 制約がまだ無く、UUID 以外を拒否できていないため。版は問わない方針なので
 * (Issue #1311 の判断 3)、これらは ID の振り直しではなく CHECK 追加だけで完了する。
 */
const NOT_YET_CONVERTED: ReadonlySet<string> = new Set([
  "announcements", // 連番
  "asset_lendings", // 連番
  "assets", // 業務コード/prefix
  "attendance_records", // 連番
  "career_applications", // 連番
  "career_postings", // 連番
  "career_sheets", // 連番
  "certification_definitions", // 連番
  "commendations", // 連番
  "company_account_employee_links", // 連番
  "company_account_profiles", // 複合PK
  "company_audit_append_guard", // 連番
  "company_audit_batch_decisions", // 連番
  "company_bootstrap_receipts", // command_id (冪等性キー)。UUID 強制の可否は Company の設計判断
  "company_audit_event_appends", // 連番
  "company_audit_event_employee_contexts", // 連番
  "company_audit_events", // 連番
  "company_calendar_days", // 連番
  "company_command_receipts", // 複合PK
  "company_employee_events", // 連番
  "company_employee_grades", // 連番
  "company_employee_resource_adoptions", // command_id (冪等性キー)
  "company_employee_lifecycle_revisions", // 連番
  "company_employee_status_period_versions", // 複合PK
  "company_employees", // 連番
  "company_employment_attributes", // 連番
  "company_external_identity_imports", // 複合PK (organization_id + command_id)
  "company_external_identity_sources", // PKが system_identity_bindings への FK。親を継承する
  "company_employment_period_versions", // 複合PK
  "company_employments", // 業務コード/prefix
  "company_grade_definitions", // 連番
  "company_lifecycle_outbox_entries", // 連番
  "company_organization_assignment_period_versions", // 複合PK
  "company_organization_change_operations", // 業務コード/prefix
  "company_organization_resource_adoptions", // command_id (冪等性キー)
  "company_organization_resource_bindings", // PKが company_organization_units への FK。親を継承する
  "company_organization_responsibility_period_versions", // 複合PK
  "company_organization_unit_period_versions", // 複合PK
  "company_organization_units", // 業務コード/prefix
  "company_workforce_resource_bindings", // 複合PK (resource_type + resource_id)
  "company_organizations", // 業務コード/prefix
  "company_personnel_actions", // 連番
  "company_position_definitions", // 連番
  "company_resource_heads", // 複合PK
  "company_resource_revisions", // 複合PK
  "decision_records", // 連番
  "disciplinary_actions", // 連番
  "document_ledger_entries", // 連番
  "employee_certifications", // 連番
  "employee_skills", // 複合PK
  "employee_work_styles", // 連番
  "evaluation_sheet_audit_logs", // 連番
  "evaluation_sheets", // 連番
  "evaluation_templates", // 連番
  "expense_approvals", // 連番
  "expense_attachments", // 複合PK
  "expense_budgets", // 連番
  "expenses", // 連番
  "goal_evaluations", // 連番
  "governance_acknowledgements", // 複合PK
  "governance_capabilities", // 業務コード/prefix
  "governance_document_references", // 複合PK
  "governance_org_role_assignments", // 連番
  "governance_org_roles", // 業務コード/prefix
  "governance_publication_approvals", // 複合PK
  "headcount_plans", // 連番
  "health_checkups", // 連番
  "it_incidents", // 連番
  "job_openings", // 連番
  "knowledge_articles", // 連番
  "leave_balances", // 複合PK
  "leave_requests", // 連番
  "meeting_minutes_records", // 連番
  "meetings", // 連番
  "onboarding_assignments", // 連番
  "onboarding_tasks", // 連番
  "onboarding_template_tasks", // 複合PK
  "onboarding_templates", // 連番
  "partner_contracts", // 連番
  "partners", // 連番
  "performance_goals", // 連番
  "recruitment_candidates", // 連番
  "regulation_versions", // 連番
  "regulations", // 連番
  "review_cycle_policies", // 連番
  "review_cycles", // 連番
  "review_forms", // 連番
  "ringi_requests", // 連番
  "rooms", // 連番
  "salary_revisions", // 連番
  "shift_assignments", // 連番
  "shift_patterns", // 連番
  "shift_swap_requests", // 連番
  "skill_definitions", // 業務コード/prefix
  "software_licenses", // 連番
  "stocktake_items", // 複合PK
  "survey_responses", // 連番
  "surveys", // 連番
  "system_account_invitations", // 連番
  "system_accounts", // 連番
  "system_audit_events", // 連番
  "system_batch_jobs", // 連番
  "system_cases", // 連番
  "system_connectors", // 連番
  "system_decision_task_candidates", // 複合PK
  "system_decision_task_exclusions", // 複合PK
  "system_decision_tasks", // 複合PK
  "system_delegation_procedure_scopes", // 連番
  "system_delegations", // 連番
  "system_execution_authorizations", // 連番
  "system_external_assertions", // 連番
  "system_human_attestations", // 連番
  "system_iam_role_permissions", // 複合PK
  "system_iam_roles", // 連番
  "system_identity_bindings", // 業務コード/prefix
  "system_identity_profiles", // 業務コード/prefix
  "system_integration_exchanges", // 連番
  "system_notification_deliveries", // 連番
  "system_notification_messages", // 連番
  "system_password_credentials", // 業務コード/prefix
  "system_procedure_definition_revisions", // 複合PK
  "system_procedure_definitions", // 業務コード/prefix
  "system_proposal_cases", // 連番
  "system_proposal_series", // 連番
  "system_proposals", // 連番
  "system_reconciliation_items", // 複合PK
  "system_reconciliation_runs", // 連番
  "system_role_bindings", // 業務コード/prefix
  "thanks_messages", // 連番
  "thanks_point_budgets", // 連番
  "thanks_redemptions", // 連番
  "thanks_rewards", // 連番
  "training_courses", // 連番
  "training_enrollments", // 連番
  "work_accidents", // 連番
  "antisocial_checks", // 既に UUID v4。CHECK 制約の追加だけが残る
  "business_trips", // 既に UUID v4。CHECK 制約の追加だけが残る
  "certificate_requests", // 既に UUID v4。CHECK 制約の追加だけが残る
  "company_personnel_action_requests", // 既に UUID v4。CHECK 制約の追加だけが残る
  "family_care_leaves", // 既に UUID v4。CHECK 制約の追加だけが残る
  "governance_document_versions", // 既に UUID v4。CHECK 制約の追加だけが残る
  "governance_documents", // 既に UUID v4。CHECK 制約の追加だけが残る
  "life_events", // 既に UUID v4。CHECK 制約の追加だけが残る
  "one_on_ones", // 既に UUID v4。CHECK 制約の追加だけが残る
  "rental_reservations", // 既に UUID v4。CHECK 制約の追加だけが残る
  "resignations", // 既に UUID v4。CHECK 制約の追加だけが残る
  "room_reservations", // 既に UUID v4。CHECK 制約の追加だけが残る
  "stocktakes", // 既に UUID v4。CHECK 制約の追加だけが残る
  "system_attachments", // 既に UUID v4。CHECK 制約の追加だけが残る
  "system_authentication_attempts", // 既に UUID v4。CHECK 制約の追加だけが残る
  "system_dead_letters", // 既に UUID v4。CHECK 制約の追加だけが残る
  "system_inbox_messages", // 既に UUID v4。CHECK 制約の追加だけが残る
  "system_jobs", // 既に UUID v4。CHECK 制約の追加だけが残る
  "system_machine_credentials", // 既に UUID v4。CHECK 制約の追加だけが残る
  "system_outbox_messages", // 既に UUID v4。CHECK 制約の追加だけが残る
  "system_password_reset_challenges", // 既に UUID v4。CHECK 制約の追加だけが残る
  "system_principals", // 既に UUID v4。CHECK 制約の追加だけが残る
  "system_sessions", // 既に UUID v4。CHECK 制約の追加だけが残る
  "system_step_up_grants", // 既に UUID v4。CHECK 制約の追加だけが残る
])

const apiRoot = resolve(import.meta.dir, "../..")

/** migration を適用しただけの schema を作る。制約の正本は Drizzle ではなく DB にある。 */
function createMigratedDatabase(): Database {
  const database = new Database(":memory:")
  const migrationsDir = resolve(apiRoot, "migrations")

  for (const file of readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    executeSql(database, readFileSync(resolve(migrationsDir, file), "utf8"), `migration ${file}`)
  }

  return database
}

type TableColumn = { readonly name: string; readonly type: string; readonly pk: number }

const database = createMigratedDatabase()

const tableNames = database
  .query<{ name: string }, []>(
    `SELECT name FROM sqlite_master
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\'
     ORDER BY name`,
  )
  .all()
  .map((row) => row.name)

/** 主キー列を宣言順で返す。 */
function primaryKeyColumns(table: string): TableColumn[] {
  return database
    .query<TableColumn, []>(`PRAGMA table_info("${table}")`)
    .all()
    .filter((column) => column.pk > 0)
    .toSorted((left, right) => left.pk - right.pk)
}

/** CREATE TABLE 文に、その列の UUID CHECK が含まれているか。 */
function hasUuidCheck(table: string, column: string): boolean {
  const definition =
    database
      .query<{ sql: string | null }, [string]>(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
      )
      .get(table)?.sql ?? ""
  const normalized = definition.replaceAll(/\s+/g, " ")

  return [`"${column}"`, `\`${column}\``, column].some((reference) =>
    normalized.includes(uuidCheckPredicate(reference).replaceAll(/\s+/g, " ")),
  )
}

describe("主キーは UUID に統一する (#1311)", () => {
  test("変換済みの table は UUID の主キーと CHECK 制約を持つ", () => {
    const converted = tableNames.filter(
      (table) => !PERMANENTLY_NON_UUID.has(table) && !NOT_YET_CONVERTED.has(table),
    )
    const violations = converted.flatMap((table) => {
      const columns = primaryKeyColumns(table)

      if (columns.length === 0) {
        return [`${table}: 主キーがありません`]
      }

      return columns.flatMap((column) => {
        if (column.type.toUpperCase() !== "TEXT") {
          return [`${table}.${column.name}: 主キーが TEXT ではありません (${column.type})`]
        }
        if (!hasUuidCheck(table, column.name)) {
          return [`${table}.${column.name}: UUID の CHECK 制約がありません`]
        }
        return []
      })
    })

    expect(violations).toEqual([])
  })

  test("どちらの list にも無い table は UUID 化済みでなければならない", () => {
    const unknown = tableNames.filter(
      (table) =>
        !PERMANENTLY_NON_UUID.has(table) &&
        !NOT_YET_CONVERTED.has(table) &&
        primaryKeyColumns(table).some((column) => !hasUuidCheck(table, column.name)),
    )

    expect(unknown).toEqual([])
  })

  test("list に載っている table はすべて実在する", () => {
    const existing = new Set(tableNames)
    const stale = [...PERMANENTLY_NON_UUID, ...NOT_YET_CONVERTED].filter(
      (table) => !existing.has(table),
    )

    expect(stale).toEqual([])
  })

  test("同じ table を両方の list に載せない", () => {
    const duplicated = [...PERMANENTLY_NON_UUID].filter((table) => NOT_YET_CONVERTED.has(table))

    expect(duplicated).toEqual([])
  })
})
