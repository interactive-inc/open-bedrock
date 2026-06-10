import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedSalaryRevisions } from "@/infrastructure/seed/seed-salary-revisions"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

const salaryRevisionResponseSchema = z.object({
  id: z.number(),
  employee_id: z.number(),
  effective_date: z.string(),
  previous_base_salary: z.number(),
  new_base_salary: z.number(),
  reason: z.string().nullable(),
  created_at: z.string(),
})

const jwtSecret = "payroll-salary-revisions-id-route-test-secret"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "employees",
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      email: employee.email,
      password_hash: employee.passwordHash,
      role: employee.role,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  await seedD1(
    db,
    "salary_revisions",
    seedSalaryRevisions.map((revision) => ({
      id: revision.id,
      employee_id: revision.employeeId,
      effective_date: revision.effectiveDate,
      previous_base_salary: revision.previousBaseSalary,
      new_base_salary: revision.newBaseSalary,
      reason: revision.reason,
      created_at: revision.createdAt,
    })),
  )

  return db
}

function adminToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 1,
    email: "you+e001@example.com",
    role: "admin",
  })
}

function memberToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 5,
    email: "you+e005@example.com",
    role: "member",
  })
}

async function request(
  path: string,
  token: string | null,
  method?: string,
  body?: unknown,
): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path,
    token,
    method,
    body,
  })
}

describe("PUT /salary-revisions/:id", () => {
  test("privileged role corrects a revision", async () => {
    const response = await request("/salary-revisions/1", await adminToken(), "PUT", {
      effective_date: "2025-05-01",
      new_base_salary: 310000,
      reason: "correction",
    })

    expect(response.status).toBe(200)

    const parsed = salaryRevisionResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(1)
      expect(parsed.data.effective_date).toBe("2025-05-01")
      expect(parsed.data.new_base_salary).toBe(310000)
      expect(parsed.data.reason).toBe("correction")
      // previous_base_salary は訂正対象外で元の値を保つ。
      expect(parsed.data.previous_base_salary).toBe(280000)
    }
  })

  test("accepts a null reason", async () => {
    const response = await request("/salary-revisions/1", await adminToken(), "PUT", {
      effective_date: "2025-05-01",
      new_base_salary: 310000,
      reason: null,
    })

    expect(response.status).toBe(200)

    const parsed = salaryRevisionResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.reason).toBeNull()
    }
  })

  test("member is forbidden", async () => {
    const response = await request("/salary-revisions/1", await memberToken(), "PUT", {
      effective_date: "2025-05-01",
      new_base_salary: 310000,
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown id", async () => {
    const response = await request("/salary-revisions/9999", await adminToken(), "PUT", {
      effective_date: "2025-05-01",
      new_base_salary: 310000,
    })

    expect(response.status).toBe(404)
  })

  test("returns 404 for a non-numeric id", async () => {
    const response = await request("/salary-revisions/abc", await adminToken(), "PUT", {
      effective_date: "2025-05-01",
      new_base_salary: 310000,
    })

    expect(response.status).toBe(404)
  })

  test("returns 400 when new_base_salary is missing", async () => {
    const response = await request("/salary-revisions/1", await adminToken(), "PUT", {
      effective_date: "2025-05-01",
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when new_base_salary is negative", async () => {
    const response = await request("/salary-revisions/1", await adminToken(), "PUT", {
      effective_date: "2025-05-01",
      new_base_salary: -1,
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when new_base_salary is not an integer", async () => {
    const response = await request("/salary-revisions/1", await adminToken(), "PUT", {
      effective_date: "2025-05-01",
      new_base_salary: 310000.5,
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/salary-revisions/1", null, "PUT", {
      effective_date: "2025-05-01",
      new_base_salary: 310000,
    })

    expect(response.status).toBe(401)
  })
})

describe("DELETE /salary-revisions/:id", () => {
  test("privileged role cancels a revision", async () => {
    const response = await request("/salary-revisions/1", await adminToken(), "DELETE")

    expect(response.status).toBe(204)
  })

  test("member is forbidden", async () => {
    const response = await request("/salary-revisions/1", await memberToken(), "DELETE")

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown id", async () => {
    const response = await request("/salary-revisions/9999", await adminToken(), "DELETE")

    expect(response.status).toBe(404)
  })

  test("returns 404 for a non-numeric id", async () => {
    const response = await request("/salary-revisions/abc", await adminToken(), "DELETE")

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/salary-revisions/1", null, "DELETE")

    expect(response.status).toBe(401)
  })
})
