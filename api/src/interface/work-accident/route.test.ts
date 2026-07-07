import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"

const jwtSecret = "work-accident-route-test-secret"

// E001=admin(work_accident:manage / read:all), E005=member。
async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(db, "work_accidents", [
    {
      id: 1,
      occurred_on: "2026-03-01",
      employee_id: 5,
      location: "倉庫",
      summary: "転倒による軽傷",
      severity: "minor",
      status: "reported",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: 2,
      occurred_on: "2026-02-01",
      employee_id: null,
      location: null,
      summary: "対象者不特定の設備事故",
      severity: null,
      status: "closed",
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ])

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

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
  })
}

async function request(props: {
  path: string
  token: string | null
  method?: string
  body?: unknown
}): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
  })
}

describe("GET /work-accidents", () => {
  test("returns 200 with all accidents for admin (work_accident:read:all)", async () => {
    const response = await request({ path: "/work-accidents", token: await tokenFor(1) })

    expect(response.status).toBe(200)

    const body = await response.json()

    expect(body.total).toBe(2)
  })

  test("returns 403 for a member (no self-view concept)", async () => {
    const response = await request({ path: "/work-accidents", token: await tokenFor(5) })

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/work-accidents", token: null })

    expect(response.status).toBe(401)
  })

  test("filters by status", async () => {
    const response = await request({
      path: "/work-accidents?status=reported",
      token: await tokenFor(1),
    })

    expect(response.status).toBe(200)

    const body = await response.json()

    expect(body.data.every((item: { status: string }) => item.status === "reported")).toBe(true)
    expect(body.total).toBe(1)
  })
})

describe("POST /work-accidents", () => {
  test("creates an accident for admin (work_accident:manage)", async () => {
    const response = await request({
      path: "/work-accidents",
      token: await tokenFor(1),
      method: "POST",
      body: { occurred_on: "2026-05-01", summary: "作業中の切創", severity: "minor" },
    })

    expect(response.status).toBe(201)

    const body = await response.json()

    expect(body.status).toBe("reported")
    expect(body.employee_id).toBeNull()
  })

  test("returns 403 for a member", async () => {
    const response = await request({
      path: "/work-accidents",
      token: await tokenFor(5),
      method: "POST",
      body: { occurred_on: "2026-05-01", summary: "作業中の切創" },
    })

    expect(response.status).toBe(403)
  })
})

describe("POST /work-accidents/:id/close", () => {
  test("closes a reported accident for admin", async () => {
    const response = await request({
      path: "/work-accidents/1/close",
      token: await tokenFor(1),
      method: "POST",
    })

    expect(response.status).toBe(200)

    const body = await response.json()

    expect(body.status).toBe("closed")
  })

  test("returns 409 when already closed", async () => {
    const response = await request({
      path: "/work-accidents/2/close",
      token: await tokenFor(1),
      method: "POST",
    })

    expect(response.status).toBe(409)
  })

  test("returns 403 for a member", async () => {
    const response = await request({
      path: "/work-accidents/1/close",
      token: await tokenFor(5),
      method: "POST",
    })

    expect(response.status).toBe(403)
  })
})
