import { InitialAccountProfileStatementAdapter } from "@/contexts/company/infrastructure/adapters/account-profile/initial-account-profile-statement.adapter"
import { FindRegisteredEmployeeByOperationAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/find-registered-employee-by-operation.adapter"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

function createDatabase(): D1Database {
  const sqlite = new Database(":memory:")
  sqlite.run(`CREATE TABLE company_personnel_actions (id TEXT PRIMARY KEY, employee_id TEXT, kind TEXT,
    payload_fingerprint TEXT, recorded_by_account_id TEXT, operation_id TEXT)`)
  sqlite.run(`CREATE TABLE company_resource_revisions (organization_id TEXT, resource_type TEXT,
    resource_id TEXT, revision INTEGER, command_id TEXT, attributes_json TEXT)`)
  sqlite.run(
    "CREATE TABLE company_account_employee_resource_bindings (employee_id TEXT, account_id TEXT)",
  )
  sqlite.run(`CREATE TABLE company_account_profiles (organization_id TEXT, account_id TEXT,
    display_name TEXT, created_at INTEGER, updated_at INTEGER)`)
  sqlite.run(`INSERT INTO company_resource_revisions VALUES
    ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'employee', 'employee-1', 1, 'initial-workforce:action-1',
      '{"personId":"person:employee-1","employeeCode":"E900"}'),
    ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'person', 'person:employee-1', 1, 'initial-workforce:action-1',
      '{"officialName":"Example Person","email":null,"phone":null}'),
    ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'person', 'person:employee-1', 2, 'rename',
      '{"officialName":"Renamed Person","email":null,"phone":null}')`)
  sqlite.run(
    "INSERT INTO company_account_employee_resource_bindings VALUES ('employee-1', 'd5858208-e680-4db8-a05d-8bf4f900c24e')",
  )
  sqlite.run(
    "INSERT INTO company_personnel_actions VALUES ('action-1', 'employee-1', 'hire', 'fingerprint', 'actor', 'operation-1')",
  )
  return createCompanyD1TestDatabase(sqlite)
}

test("冪等keyで確定済みの入社発令と、登録時に公開した値、対応するAccountを返す", async () => {
  const adapter = new FindRegisteredEmployeeByOperationAdapter(createDatabase())

  expect(await adapter.find("operation-1")).toEqual({
    kind: "hire",
    payloadFingerprint: "fingerprint",
    recordedByAccountId: "actor",
    employeeCode: "E900",
    officialName: "Example Person",
    accountId: "d5858208-e680-4db8-a05d-8bf4f900c24e",
  })
  expect(await adapter.find("operation-unknown")).toBeNull()
})

test("保存先を参照できない場合は未登録として扱わず失敗を返す", async () => {
  const adapter = new FindRegisteredEmployeeByOperationAdapter(
    createCompanyD1TestDatabase(new Database(":memory:")),
  )

  expect(await adapter.find("operation-1")).toBeInstanceOf(Error)
})

test("表示名の初期保存は作成時刻と更新時刻へ同じ時刻を保存する", async () => {
  const database = createDatabase()
  await database.batch([
    new InitialAccountProfileStatementAdapter(database).prepare({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      accountId: "d5858208-e680-4db8-a05d-8bf4f900c24e",
      displayName: "Example Person",
      at: 1234,
    }),
  ])

  expect(
    await database
      .prepare("SELECT * FROM company_account_profiles")
      .first<Record<string, unknown>>(),
  ).toEqual({
    organization_id: COMPANY_DEFAULT_ORGANIZATION_ID,
    account_id: "d5858208-e680-4db8-a05d-8bf4f900c24e",
    display_name: "Example Person",
    created_at: 1234,
    updated_at: 1234,
  })
})
