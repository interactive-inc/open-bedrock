import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedResignations } from "@/infrastructure/seed/seed-resignations"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"

const jwtSecret = "resignation-reject-route-test-secret"

const seedId = "20000000-0000-0000-0000-000000000001"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "employees",
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
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
    "resignations",
    seedResignations.map((resignation) => ({
      id: resignation.id,
      employee_id: resignation.employeeId,
      resignation_date: resignation.resignationDate,
      last_working_date: resignation.lastWorkingDate,
      reason: resignation.reason,
      status: resignation.status,
      created_at: resignation.createdAt,
    })),
  )

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
  })
}

describe("POST /resignations/:id/reject", () => {
  test("returns 200 and rejects the resignation for hr", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: `/resignations/${seedId}/reject`,
      token: await tokenFor(99),
      method: "POST",
    })

    expect(response.status).toBe(200)

    const body = await response.json()

    expect(body.status).toBe("rejected")
  })

  test("returns 403 for a member", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: `/resignations/${seedId}/reject`,
      token: await tokenFor(5),
      method: "POST",
    })

    expect(response.status).toBe(403)
  })

  test("returns 409 when rejecting an already-decided resignation", async () => {
    const db = await createTestDb()

    const first = await requestWithContext({
      db,
      jwtSecret,
      path: `/resignations/${seedId}/reject`,
      token: await tokenFor(99),
      method: "POST",
    })

    expect(first.status).toBe(200)

    const second = await requestWithContext({
      db,
      jwtSecret,
      path: `/resignations/${seedId}/reject`,
      token: await tokenFor(99),
      method: "POST",
    })

    expect(second.status).toBe(409)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: `/resignations/${seedId}/reject`,
      token: null,
      method: "POST",
    })

    expect(response.status).toBe(401)
  })
})
