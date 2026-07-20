import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedSalaryRevisions } from "@/infrastructure/seed/seed-salary-revisions"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

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

  return db
}

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role: role,
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
    const response = await request("/salary-revisions?employee_id=5", await tokenFor(1, "admin"))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.employee_id).toBe(5)
    }
  })

  test("returns 403 for a member viewing their own history (no self exception)", async () => {
    const response = await request("/salary-revisions?employee_id=5", await tokenFor(5, "member"))

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/salary-revisions?employee_id=5", null)

    expect(response.status).toBe(401)
  })
})

describe("POST /salary-revisions", () => {
  test("creates a salary revision as admin", async () => {
    const response = await request("/salary-revisions", await tokenFor(1, "admin"), "POST", {
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
    const response = await request("/salary-revisions", await tokenFor(1, "admin"), "POST", {
      employee_id: 5,
      effective_date: "2025-04-01",
      previous_base_salary: 280000,
      new_base_salary: 300000,
    })

    expect(response.status).toBe(409)
  })

  test("returns 403 for a member", async () => {
    const response = await request("/salary-revisions", await tokenFor(5, "member"), "POST", {
      employee_id: 1,
      effective_date: "2026-05-01",
      previous_base_salary: 1,
      new_base_salary: 2,
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown employee", async () => {
    const response = await request("/salary-revisions", await tokenFor(1, "admin"), "POST", {
      employee_id: 9999,
      effective_date: "2026-05-01",
      previous_base_salary: 1,
      new_base_salary: 2,
    })

    expect(response.status).toBe(404)
  })
})
