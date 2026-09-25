import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { uuidSchema } from "@/lib/validation/uuid.schema"
import { PERMANENT_NON_UUID_PRIMARY_KEYS } from "../../scripts/id-inventory-registry"
import { buildIdInventory } from "../../scripts/inventory-ids"

/**
 * すべての table の主キーを UUID に揃える (Issue #1311)。
 *
 * 各 table は次のどれかに当てはまる。
 *
 * - UUID の主キーを持つ: 単一の TEXT 列で、`uuidCheckPredicate` の CHECK を持つ
 * - 恒久的な例外: 採番器・singleton・秘密値の照合鍵。理由は `id-inventory-registry.ts` に書く
 * - 未変換: 下の `NOT_YET_CONVERTED`。移行の各段がここから削り、空になった時点で移行が終わる
 *
 * 未変換の一覧は減らすことしかできない。変換済みの table が残っていれば落ちるので、
 * 変換した PR は同時に一覧から削る。新しい table は最初から UUID の主キーで作る。
 */
const NOT_YET_CONVERTED: ReadonlySet<string> = new Set([
  // integer
  "company_lifecycle_outbox_entries",
  "company_personnel_annotations",
  "system_batch_jobs",
  "system_work_item_revisions",
  // text-uuid-candidate
  "career_sheets",
  "company_account_employee_links",
  "company_assignment_resource_adoptions",
  "company_bootstrap_receipts",
  "company_employee_lifecycle_revisions",
  "company_employee_resource_adoptions",
  "company_employees",
  "company_employment_attributes",
  "company_external_identity_sources",
  "company_organization_resource_adoptions",
  "company_personnel_action_requests",
  "company_responsibility_resource_adoptions",
  "system_account_invitations",
  "system_accounts",
  "system_attachment_preservations",
  "system_attachments",
  "system_authentication_attempts",
  "system_cases",
  "system_connectors",
  "system_dead_letters",
  "system_delegation_procedure_scopes",
  "system_delegations",
  "system_execution_authorizations",
  "system_external_assertions",
  "system_human_attestations",
  "system_iam_roles",
  "system_identity_bindings",
  "system_identity_profiles",
  "system_inbox_messages",
  "system_integration_exchanges",
  "system_jobs",
  "system_machine_credentials",
  "system_notification_deliveries",
  "system_notification_messages",
  "system_notification_resource_scopes",
  "system_outbox_messages",
  "system_password_credentials",
  "system_password_reset_challenges",
  "system_preserved_records",
  "system_principals",
  "system_proposal_cases",
  "system_proposal_series",
  "system_proposals",
  "system_reconciliation_runs",
  "system_record_coverage_pages",
  "system_record_retirement_plans",
  "system_record_retirement_receipts",
  "system_record_source_freezes",
  "system_record_source_retirements",
  "system_role_bindings",
  "system_sessions",
  "system_step_up_grants",
  "system_work_evidence",
  "system_work_items",
  // text-prefixed
  "company_account_employee_resource_bindings",
  "company_assignment_period_bindings",
  "company_assignment_resource_bindings",
  "company_employments",
  "company_organization_change_operations",
  "company_organization_resource_bindings",
  "company_organization_units",
  "company_organizations",
  "company_personnel_actions",
  "company_personnel_reporting_bindings",
  "company_responsibility_period_bindings",
  "company_responsibility_resource_bindings",
  "company_workforce_connection_completions",
  // text-business-code
  "system_procedure_definitions",
  // composite
  "company_account_profiles",
  "company_command_receipts",
  "company_definition_resource_adoptions",
  "company_employee_status_period_versions",
  "company_employment_period_versions",
  "company_external_identity_imports",
  "company_grade_award_archives",
  "company_organization_assignment_period_versions",
  "company_organization_responsibility_period_versions",
  "company_organization_unit_period_versions",
  "company_profile_change_receipts",
  "company_resource_heads",
  "company_resource_revisions",
  "company_responsibility_source_adoptions",
  "company_responsibility_source_cutovers",
  "company_workforce_resource_bindings",
  "system_decision_task_candidates",
  "system_decision_task_exclusions",
  "system_decision_tasks",
  "system_iam_role_permissions",
  "system_operation_receipts",
  "system_procedure_definition_revisions",
  "system_reconciliation_items",
  "system_record_coverage_entries",
  "system_record_disclosure_policies",
  "system_record_retirement_attachment_pins",
])

const { inventory } = buildIdInventory()

const tableNames = Object.keys(inventory.tables)

describe("主キーは UUID に揃える (#1311)", () => {
  test("どの一覧にも無い table は UUID の主キーを持つ", () => {
    const violations = tableNames.filter(
      (table) =>
        !PERMANENT_NON_UUID_PRIMARY_KEYS.has(table) &&
        !NOT_YET_CONVERTED.has(table) &&
        inventory.tables[table]?.primaryKey.uuidEnforced !== true,
    )

    expect(violations).toEqual([])
  })

  test("変換を終えた table は未変換の一覧から削る", () => {
    const converted = [...NOT_YET_CONVERTED].filter(
      (table) => inventory.tables[table]?.primaryKey.uuidEnforced === true,
    )

    expect(converted).toEqual([])
  })

  test("一覧の table はすべて実在する", () => {
    const stale = [...PERMANENT_NON_UUID_PRIMARY_KEYS.keys(), ...NOT_YET_CONVERTED].filter(
      (table) => inventory.tables[table] === undefined,
    )

    expect(stale).toEqual([])
  })

  test("恒久的な例外と未変換の一覧は重ならない", () => {
    const duplicated = [...PERMANENT_NON_UUID_PRIMARY_KEYS.keys()].filter((table) =>
      NOT_YET_CONVERTED.has(table),
    )

    expect(duplicated).toEqual([])
  })

  test("恒久的な例外は理由を持ち、UUID にしない主キーである", () => {
    const violations = [...PERMANENT_NON_UUID_PRIMARY_KEYS].filter(
      ([table, exception]) =>
        exception.reason.trim().length === 0 ||
        inventory.tables[table]?.primaryKey.uuidEnforced === true,
    )

    expect(violations).toEqual([])
  })
})

describe("seed の UUID", () => {
  test("UUID の形をした seed の値は RFC 9562 に準拠する", () => {
    const seedsDirectory = resolve(import.meta.dir, "../../seeds")
    const violations = readdirSync(seedsDirectory)
      .filter((file) => file.endsWith(".sql"))
      .flatMap((file) =>
        [
          ...readFileSync(resolve(seedsDirectory, file), "utf8").matchAll(
            /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
          ),
        ]
          .map((match) => match[0])
          .filter((value) => !uuidSchema.safeParse(value).success)
          .map((value) => `${file}: ${value}`),
      )

    expect(violations).toEqual([])
  })
})
