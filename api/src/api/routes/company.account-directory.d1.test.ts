import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { testAccountId, testDerivedId, testEmployeeId } from "@tests/api/support/test-identity-id"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { prepareUnpublishedEmployment } from "@/contexts/company/test/unpublished-employment.test-support"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { publishTestEmployeeResources } from "@tests/api/support/company/publish-test-employee-resources"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(3)
})

afterAll(async () => {
  await pool.dispose()
})

const jwtSecret = "account-directory-route-test-secret"

async function createTestDatabase(): Promise<D1Database> {
  const database = await pool.next()
  const employees = [
    { id: 1, code: "E001", name: "Admin", email: "admin@example.com", role: "root" },
    { id: 2, code: "E002", name: "Member", email: "member@example.com", role: "member" },
  ]

  await seedD1(
    database,
    "company_employees",
    employees.map((employee) => ({
      id: testEmployeeId(employee.id),
      employee_code: employee.code,
      official_name: employee.name,
      email: employee.email,
      phone: null,
      created_at: 0,
      updated_at: 0,
    })),
  )
  await seedIamForEmployees(
    database,
    employees.map((employee) => ({
      id: employee.id,
      email: employee.email,
      passwordHash: "x",
      role: employee.role,
    })),
  )
  for (const employee of employees) {
    const initialEmployment = await prepareUnpublishedEmployment(database, {
      employeeId: toWorkforceEmployeeId(testEmployeeId(employee.id)),
      employmentId: restoreWorkforceId("employment", testDerivedId("employment", employee.id)),
      effectiveOn: restoreCalendarDate("1970-01-01"),
      status: "active",
      occurredAt: new Date(0),
      actorAccountId: null,
      operationId: `seed:${employee.id}`,
      reason: "Initial test employment",
    })
    await database.batch([...initialEmployment])
    await publishTestEmployeeResources(database, {
      employeeId: testEmployeeId(employee.id),
      employmentId: testDerivedId("employment", employee.id),
      officialName: employee.name,
      employeeCode: employee.code,
      email: employee.email,
      employmentType: "FULL_TIME",
      employmentStatus: "ACTIVE",
      effectiveFrom: "1970-01-01",
      recordedAt: 0,
    })
  }
  return database
}

describe("GET /directory/accounts", () => {
  test("iam:read を持つ管理者へ Account と従業員プロフィールを返す", async () => {
    const database = await createTestDatabase()
    const token = await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(1) })
    const response = await requestWithContext({
      db: database,
      jwtSecret,
      path: "/company/account-directory?status=active",
      token,
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: [
        {
          account_id: testAccountId(1),
          name: "Admin",
          email: "admin@example.com",
          status: "active",
        },
        {
          account_id: testAccountId(2),
          name: "Member",
          email: "member@example.com",
          status: "active",
        },
      ],
      total: 2,
    })
  })

  test("失効 Identity を候補から外し、利用可能なメールを決定的に選ぶ", async () => {
    const database = await createTestDatabase()
    await database
      .prepare("UPDATE system_identity_bindings SET revoked_at = 1 WHERE account_id = ?1")
      .bind(testAccountId(2))
      .run()
    const token = await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(1) })
    const response = await requestWithContext({
      db: database,
      jwtSecret,
      path: "/company/account-directory?status=active",
      token,
    })
    const body = (await response.json()) as {
      data: ReadonlyArray<{ account_id: string; email: string | null }>
    }

    expect(response.status).toBe(200)
    expect(body.data.find((account) => account.account_id === testAccountId(2))?.email).toBe(null)
  })

  test("iam:read を持たないメンバーは拒否する", async () => {
    const database = await createTestDatabase()
    const token = await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(2) })
    const response = await requestWithContext({
      db: database,
      jwtSecret,
      path: "/company/account-directory",
      token,
    })

    expect(response.status).toBe(403)
  })
})
