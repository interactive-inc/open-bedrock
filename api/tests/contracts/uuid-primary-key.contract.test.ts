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
  // text-uuid-candidate
  "career_sheets",
  "company_account_employee_links",
  "company_employee_lifecycle_revisions",
  "company_employees",
  "company_employment_attributes",
  "company_external_identity_sources",
  "company_personnel_action_requests",
  "system_account_invitations",
  "system_accounts",
  "system_authentication_attempts",
  "system_identity_bindings",
  "system_identity_profiles",
  "system_machine_credentials",
  "system_password_credentials",
  "system_password_reset_challenges",
  "system_principals",
  "system_sessions",
  "system_step_up_grants",
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
  // composite
  "company_workforce_resource_bindings",
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
