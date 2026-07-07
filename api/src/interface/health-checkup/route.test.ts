import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"

const jwtSecret = "health-checkup-route-test-secret"

// E001=admin(health_checkup:manage / read:all), E005・E006=member。
// 実施記録: E005 が id=1(scheduled), id=2(completed) を持つ。結果は持たない。
async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(db, "health_checkups", [
    {
      id: 1,
      employee_id: 5,
      fiscal_year: 2026,
      checkup_kind: "regular",
      conducted_on: null,
      status: "scheduled",
      note: null,
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: 2,
      employee_id: 5,
      fiscal_year: 2025,
      checkup_kind: "stress_check",
      conducted_on: "2025-06-01",
      status: "completed",
      note: null,
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

describe("GET /health-checkups", () => {
  test("member can read their own records", async () => {
    const response = await request({ path: "/health-checkups", token: await tokenFor(5) })

    expect(response.status).toBe(200)

    const body = await response.json()

    expect(body.total).toBe(2)
    expect(body.data.every((item: { employee_id: number }) => item.employee_id === 5)).toBe(true)
  })

  test("member is 403 when requesting another employee's records", async () => {
    const response = await request({
      path: "/health-checkups?employee_id=5",
      token: await tokenFor(6),
    })

    expect(response.status).toBe(403)
  })

  test("admin (health_checkup:read:all) can read another employee's records", async () => {
    const response = await request({
      path: "/health-checkups?employee_id=5",
      token: await tokenFor(1),
    })

    expect(response.status).toBe(200)
  })

  test("admin without employee_id sees all records across employees", async () => {
    const response = await request({ path: "/health-checkups", token: await tokenFor(1) })

    expect(response.status).toBe(200)

    const body = await response.json()

    expect(body.total).toBe(2)
  })

  test("filters by fiscal_year", async () => {
    const response = await request({
      path: "/health-checkups?employee_id=5&fiscal_year=2026",
      token: await tokenFor(1),
    })

    expect(response.status).toBe(200)

    const body = await response.json()

    expect(body.total).toBe(1)
    expect(body.data[0].fiscal_year).toBe(2026)
  })

  test("response never exposes result columns (実施情報のみ)", async () => {
    const response = await request({ path: "/health-checkups", token: await tokenFor(5) })

    const body = await response.json()

    const keys = Object.keys(body.data[0])

    expect(keys).toEqual([
      "id",
      "employee_id",
      "fiscal_year",
      "checkup_kind",
      "conducted_on",
      "status",
      "note",
      "created_at",
    ])
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/health-checkups", token: null })

    expect(response.status).toBe(401)
  })
})

describe("POST /health-checkups", () => {
  test("creates a record for admin (health_checkup:manage)", async () => {
    const response = await request({
      path: "/health-checkups",
      token: await tokenFor(1),
      method: "POST",
      body: { employee_id: 6, fiscal_year: 2026, checkup_kind: "regular" },
    })

    expect(response.status).toBe(201)

    const body = await response.json()

    expect(body.status).toBe("scheduled")
  })

  test("returns 403 for a member", async () => {
    const response = await request({
      path: "/health-checkups",
      token: await tokenFor(5),
      method: "POST",
      body: { employee_id: 5, fiscal_year: 2026, checkup_kind: "regular" },
    })

    expect(response.status).toBe(403)
  })
})

describe("POST /health-checkups/:id/complete", () => {
  test("completes a scheduled record for admin", async () => {
    const response = await request({
      path: "/health-checkups/1/complete",
      token: await tokenFor(1),
      method: "POST",
      body: { conducted_on: "2026-06-15" },
    })

    expect(response.status).toBe(200)

    const body = await response.json()

    expect(body.status).toBe("completed")
    expect(body.conducted_on).toBe("2026-06-15")
  })

  test("returns 409 when already completed", async () => {
    const response = await request({
      path: "/health-checkups/2/complete",
      token: await tokenFor(1),
      method: "POST",
      body: { conducted_on: "2026-06-15" },
    })

    expect(response.status).toBe(409)
  })

  test("returns 403 for a member", async () => {
    const response = await request({
      path: "/health-checkups/1/complete",
      token: await tokenFor(5),
      method: "POST",
      body: { conducted_on: "2026-06-15" },
    })

    expect(response.status).toBe(403)
  })
})
