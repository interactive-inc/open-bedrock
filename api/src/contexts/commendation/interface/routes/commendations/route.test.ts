import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"

const jwtSecret = "commendation-route-test-secret"

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

  await seedIamForEmployees(db)

  return db
}

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role,
  })
}

async function createCommendation(db: D1Database): Promise<number> {
  const response = await requestWithContext({
    db,
    jwtSecret,
    path: "/commendations",
    token: await tokenFor(1, "root"),
    method: "POST",
    body: {
      employee_id: 5,
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
      token: await tokenFor(5, "member"),
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
      token: await tokenFor(5, "member"),
    })

    const body = (await response.json()) as { total: number }

    expect(body.total).toBe(0)
  })

  test("member without commendation:manage cannot create", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/commendations",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { employee_id: 5, title: "x", reason: "y", awarded_on: "2026-06-01" },
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
      token: await tokenFor(5, "member"),
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
      token: await tokenFor(1, "root"),
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
