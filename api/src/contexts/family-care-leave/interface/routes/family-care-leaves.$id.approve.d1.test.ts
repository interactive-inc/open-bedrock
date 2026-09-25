import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { z } from "zod"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedFamilyCareLeaves } from "@/contexts/family-care-leave/test/seed/seed-family-care-leaves.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(4)
})

afterAll(async () => {
  await pool.dispose()
})

const jwtSecret = "family-care-leave-approve-route-test-secret"

const seedId = "20000000-0000-4000-8000-000000000001"

async function createTestDb(): Promise<D1Database> {
  const db = await pool.next()

  await seedCompanyEmployees(
    db,
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      deptId: employee.deptId,
      deptName: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  await seedIamForEmployees(db, [
    { id: 99, email: "you+e099@example.com", passwordHash: "hash", role: "hr" },
    { id: 5, email: "you+e005@example.com", passwordHash: "hash", role: "member" },
  ])

  await seedD1(
    db,
    "family_care_leaves",
    seedFamilyCareLeaves.map((familyCareLeave) => ({
      id: familyCareLeave.id,
      employee_id: familyCareLeave.employeeId,
      leave_kind: familyCareLeave.leaveKind,
      start_date: familyCareLeave.startDate,
      end_date: familyCareLeave.endDate,
      note: familyCareLeave.note,
      status: familyCareLeave.status,
      created_at: familyCareLeave.createdAt,
    })),
  )
  await initializeStandardCompanyTestState(db)

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
  })
}

describe("POST /family-care-leaves/:id/approve", () => {
  test("returns 200 and approves the leave for the applicant's manager", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: `/family-care-leave/family-care-leaves/${seedId}/approve`,
      token: await tokenFor(1),
      method: "POST",
    })

    expect(response.status).toBe(200)

    const parsed = z.object({ status: z.string() }).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("approved")
    }
  })

  test("returns 403 for a member", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: `/family-care-leave/family-care-leaves/${seedId}/approve`,
      token: await tokenFor(5),
      method: "POST",
    })

    expect(response.status).toBe(403)
  })

  test("returns 409 when approving an already-approved leave", async () => {
    const db = await createTestDb()

    const first = await requestWithContext({
      db,
      jwtSecret,
      path: `/family-care-leave/family-care-leaves/${seedId}/approve`,
      token: await tokenFor(1),
      method: "POST",
    })

    expect(first.status).toBe(200)

    const second = await requestWithContext({
      db,
      jwtSecret,
      path: `/family-care-leave/family-care-leaves/${seedId}/approve`,
      token: await tokenFor(1),
      method: "POST",
    })

    expect(second.status).toBe(409)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: `/family-care-leave/family-care-leaves/${seedId}/approve`,
      token: null,
      method: "POST",
    })

    expect(response.status).toBe(401)
  })
})
