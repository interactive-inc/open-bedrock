import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/api/test/support/company/seed-employees.repository"
import { seedSalaryRevisions } from "@/contexts/compensation-change/infrastructure/seed/seed-salary-revisions.repository"
import { createTestToken } from "@/api/test/support/create-test-token"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@/api/test/support/initialize-standard-company-test-state"

const jwtSecret = "salary-revision-route-test-secret"

const revisionSchema = z.object({
  id: z.number(),
  employee_id: z.number(),
  effective_date: z.string(),
  previous_base_salary: z.number(),
  new_base_salary: z.number(),
  reason: z.string().nullable(),
  created_at: z.string(),
})

const listSchema = z.object({ data: z.array(revisionSchema), total: z.number() })

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
  await initializeStandardCompanyTestState(db)

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: employeeId,
  })
}

async function request(
  path: string,
  token: string | null,
  method?: string,
  body?: unknown,
): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token, method, body })
}

describe("GET /salary-revisions", () => {
  test("returns 200 for admin viewing an employee's history", async () => {
    const response = await request("/salary-revisions?employee_id=5", await tokenFor(1))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.employee_id).toBe(5)
    }
  })

  test("returns 403 for a member viewing their own history (no self exception)", async () => {
    const response = await request("/salary-revisions?employee_id=5", await tokenFor(5))

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/salary-revisions?employee_id=5", null)

    expect(response.status).toBe(401)
  })
})

describe("POST /salary-revisions", () => {
  test("creates a salary revision as admin", async () => {
    const response = await request("/salary-revisions", await tokenFor(1), "POST", {
      employee_id: 1,
      effective_date: "2026-04-01",
      previous_base_salary: 280000,
      new_base_salary: 300000,
      reason: "annual_raise",
    })

    expect(response.status).toBe(201)

    const parsed = revisionSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.new_base_salary).toBe(300000)
    }
  })

  test("returns 409 on duplicate employee + effective_date", async () => {
    const response = await request("/salary-revisions", await tokenFor(1), "POST", {
      employee_id: 5,
      effective_date: "2025-04-01",
      previous_base_salary: 280000,
      new_base_salary: 300000,
    })

    expect(response.status).toBe(409)
  })

  test("returns 403 for a member", async () => {
    const response = await request("/salary-revisions", await tokenFor(5), "POST", {
      employee_id: 1,
      effective_date: "2026-05-01",
      previous_base_salary: 1,
      new_base_salary: 2,
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown employee", async () => {
    const response = await request("/salary-revisions", await tokenFor(1), "POST", {
      employee_id: 9999,
      effective_date: "2026-05-01",
      previous_base_salary: 1,
      new_base_salary: 2,
    })

    expect(response.status).toBe(404)
  })

  test("creates a salary revision by employee_code", async () => {
    const response = await request("/salary-revisions", await tokenFor(1), "POST", {
      employee_code: "E001",
      effective_date: "2026-04-01",
      previous_base_salary: 280000,
      new_base_salary: 300000,
      reason: "annual_raise",
    })

    expect(response.status).toBe(201)

    const parsed = revisionSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.employee_id).toBe(1)
    }
  })

  test("returns 404 for an unknown employee_code", async () => {
    const response = await request("/salary-revisions", await tokenFor(1), "POST", {
      employee_code: "E999",
      effective_date: "2026-05-01",
      previous_base_salary: 1,
      new_base_salary: 2,
    })

    expect(response.status).toBe(404)
  })

  test("returns 400 when both employee_id and employee_code are given", async () => {
    const response = await request("/salary-revisions", await tokenFor(1), "POST", {
      employee_id: 1,
      employee_code: "E001",
      effective_date: "2026-05-01",
      previous_base_salary: 1,
      new_base_salary: 2,
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when neither employee_id nor employee_code is given", async () => {
    const response = await request("/salary-revisions", await tokenFor(1), "POST", {
      effective_date: "2026-05-01",
      previous_base_salary: 1,
      new_base_salary: 2,
    })

    expect(response.status).toBe(400)
  })
})
