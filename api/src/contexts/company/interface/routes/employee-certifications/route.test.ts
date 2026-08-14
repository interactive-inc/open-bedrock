import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { createTestToken } from "@/contexts/company/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/contexts/company/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/contexts/company/interface/test-helpers/load-schema"
import { requestWithContext } from "@/contexts/company/interface/test-helpers/request-with-context"
import { seedD1 } from "@/contexts/company/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/contexts/company/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "employee-certification-route-test-secret"

const employeeCertificationListSchema = z.object({
  data: z.array(z.object({ employee_id: z.number() })),
  total: z.number(),
})

/**
 * E001=admin(read:all / manage), E005・E006=member。
 * 保有記録: E005 が id=1 を持つ。
 */
async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(db, "certification_definitions", [
    {
      id: 1,
      code: "FE",
      name: "基本情報技術者",
      issuer: "IPA",
      description: null,
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ])

  await seedD1(db, "employee_certifications", [
    {
      id: 1,
      employee_id: 5,
      certification_id: 1,
      acquired_on: "2024-04-01",
      expires_on: null,
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

describe("GET /employee-certifications", () => {
  test("member can read their own records without employee_id", async () => {
    const response = await request({ path: "/employee-certifications", token: await tokenFor(5) })

    expect(response.status).toBe(200)

    const parsed = employeeCertificationListSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(1)
      expect(parsed.data.data[0].employee_id).toBe(5)
    }
  })

  test("member can read their own records with own employee_id", async () => {
    const response = await request({
      path: "/employee-certifications?employee_id=5",
      token: await tokenFor(5),
    })

    expect(response.status).toBe(200)
  })

  test("member is 403 when requesting another employee's records", async () => {
    const response = await request({
      path: "/employee-certifications?employee_id=5",
      token: await tokenFor(6),
    })

    expect(response.status).toBe(403)
  })

  test("admin (certification:read:all) can read another employee's records", async () => {
    const response = await request({
      path: "/employee-certifications?employee_id=5",
      token: await tokenFor(1),
    })

    expect(response.status).toBe(200)

    const parsed = employeeCertificationListSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(1)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/employee-certifications", token: null })

    expect(response.status).toBe(401)
  })
})

describe("POST /employee-certifications", () => {
  test("creates a record for admin (certification:manage)", async () => {
    const response = await request({
      path: "/employee-certifications",
      token: await tokenFor(1),
      method: "POST",
      body: { employee_id: 6, certification_id: 1, acquired_on: "2025-04-01" },
    })

    expect(response.status).toBe(201)
  })

  test("returns 403 for a member", async () => {
    const response = await request({
      path: "/employee-certifications",
      token: await tokenFor(5),
      method: "POST",
      body: { employee_id: 5, certification_id: 1, acquired_on: "2025-04-01" },
    })

    expect(response.status).toBe(403)
  })

  test("returns 409 on duplicate (employee, certification, acquired_on)", async () => {
    const response = await request({
      path: "/employee-certifications",
      token: await tokenFor(1),
      method: "POST",
      body: { employee_id: 5, certification_id: 1, acquired_on: "2024-04-01" },
    })

    expect(response.status).toBe(409)
  })

  test("returns 404 when certification master is missing", async () => {
    const response = await request({
      path: "/employee-certifications",
      token: await tokenFor(1),
      method: "POST",
      body: { employee_id: 6, certification_id: 999, acquired_on: "2025-04-01" },
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /employee-certifications/:id", () => {
  test("deletes a record for admin (certification:manage)", async () => {
    const response = await request({
      path: "/employee-certifications/1",
      token: await tokenFor(1),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 403 for a member", async () => {
    const response = await request({
      path: "/employee-certifications/1",
      token: await tokenFor(5),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for a missing record", async () => {
    const response = await request({
      path: "/employee-certifications/999",
      token: await tokenFor(1),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })
})
