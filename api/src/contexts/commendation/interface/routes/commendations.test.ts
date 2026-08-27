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

const jwtSecret = "commendation-route-test-secret"

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

async function createCommendation(db: D1Database): Promise<number> {
  const response = await requestWithContext({
    db,
    jwtSecret,
    path: "/commendations",
    token: await tokenFor(1),
    method: "POST",
    body: {
      employee_id: "5",
      title: "MVP",
      reason: "quarter contribution",
      awarded_on: "2026-06-01",
    },
  })

  const body = (await response.json()) as { id: number }

  return body.id
}

describe("commendations", () => {
  test("commendation:manage creates and any authenticated user can read (社内公開)", async () => {
    const db = await createTestDb()

    const id = await createCommendation(db)

    expect(id).toBeGreaterThan(0)

    const list = await requestWithContext({
      db,
      jwtSecret,
      path: "/commendations",
      token: await tokenFor(5),
    })

    expect(list.status).toBe(200)

    const body = (await list.json()) as { data: Array<{ title: string }>; total: number }

    expect(body.total).toBe(1)

    expect(body.data[0]?.title).toBe("MVP")
  })

  test("filters commendations by employee_id", async () => {
    const db = await createTestDb()

    await createCommendation(db)

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/commendations?employee_id=9",
      token: await tokenFor(5),
    })

    const body = (await response.json()) as { total: number }

    expect(body.total).toBe(0)
  })

  test("member without commendation:manage cannot create", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/commendations",
      token: await tokenFor(5),
      method: "POST",
      body: { employee_id: "5", title: "x", reason: "y", awarded_on: "2026-06-01" },
    })

    expect(response.status).toBe(403)
  })

  test("member without commendation:manage cannot delete", async () => {
    const db = await createTestDb()

    const id = await createCommendation(db)

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/commendations/${id}`,
      token: await tokenFor(5),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("commendation:manage deletes a commendation", async () => {
    const db = await createTestDb()

    const id = await createCommendation(db)

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/commendations/${id}`,
      token: await tokenFor(1),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/commendations",
      token: null,
    })

    expect(response.status).toBe(401)
  })
})
