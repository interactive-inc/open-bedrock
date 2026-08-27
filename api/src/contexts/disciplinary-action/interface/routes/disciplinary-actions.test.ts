import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const jwtSecret = "disciplinary-action-route-test-secret"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

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

  await seedIamForEmployees(db)
  await initializeStandardCompanyTestState(db)

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
  })
}

async function createAction(db: D1Database): Promise<number> {
  const response = await requestWithContext({
    db,
    jwtSecret,
    path: "/disciplinary-actions",
    token: await tokenFor(1),
    method: "POST",
    body: { employee_id: "5", kind: "warning", summary: "policy breach", decided_on: "2026-06-01" },
  })

  const body = (await response.json()) as { id: number }

  return body.id
}

describe("disciplinary actions", () => {
  test("disciplinary_action:manage creates and read:all lists", async () => {
    const db = await createTestDb()

    const id = await createAction(db)

    expect(id).toBeGreaterThan(0)

    const list = await requestWithContext({
      db,
      jwtSecret,
      path: "/disciplinary-actions",
      token: await tokenFor(1),
    })

    expect(list.status).toBe(200)

    const body = (await list.json()) as { data: Array<{ kind: string }>; total: number }

    expect(body.total).toBe(1)

    expect(body.data[0]?.kind).toBe("warning")
  })

  test("member without read:all cannot list (非公開)", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/disciplinary-actions",
      token: await tokenFor(5),
    })

    expect(response.status).toBe(403)
  })

  test("manager without read:all cannot list", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/disciplinary-actions",
      token: await tokenFor(4),
    })

    expect(response.status).toBe(403)
  })

  test("the subject employee cannot read their own record (本人にも見せない)", async () => {
    const db = await createTestDb()

    await createAction(db)

    // E005 は懲戒の対象だが、本人でも閲覧できない設計。
    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/disciplinary-actions?employee_id=5",
      token: await tokenFor(5),
    })

    expect(response.status).toBe(403)
  })

  test("member without manage cannot create", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/disciplinary-actions",
      token: await tokenFor(5),
      method: "POST",
      body: { employee_id: "6", kind: "warning", summary: "x", decided_on: "2026-06-01" },
    })

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/disciplinary-actions",
      token: null,
    })

    expect(response.status).toBe(401)
  })
})
