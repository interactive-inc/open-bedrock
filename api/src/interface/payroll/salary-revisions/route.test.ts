import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedPayslips } from "@/infrastructure/seed/seed-payslips"
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

const jwtSecret = "payroll-salary-revisions-create-route-test-secret"

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
    "payslips",
    seedPayslips.map((payslip) => ({
      id: payslip.id,
      employee_id: payslip.employeeId,
      period: payslip.period,
      base_salary: payslip.baseSalary,
      allowances: payslip.allowances,
      deductions: payslip.deductions,
      net_pay: payslip.netPay,
      issued_at: payslip.issuedAt,
      status: payslip.status,
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

describe("POST /salary-revisions", () => {
  test("privileged role creates a revision resolving previous base salary", async () => {
    const response = await request("/salary-revisions", await adminToken(), "POST", {
      employee_code: "E005",
      effective_date: "2026-04-01",
      new_base_salary: 320000,
      reason: "annual_raise",
    })

    expect(response.status).toBe(201)

    const parsed = salaryRevisionResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.employee_id).toBe(5)
      expect(parsed.data.previous_base_salary).toBe(300000)
      expect(parsed.data.new_base_salary).toBe(320000)
      expect(parsed.data.created_at).toBe("2026-01-01T00:00:00.000Z")
    }
  })

  test("defaults previous base salary to 0 when no prior revision", async () => {
    const response = await request("/salary-revisions", await adminToken(), "POST", {
      employee_code: "E010",
      effective_date: "2026-04-01",
      new_base_salary: 250000,
    })

    expect(response.status).toBe(201)

    const parsed = salaryRevisionResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.previous_base_salary).toBe(0)
      expect(parsed.data.reason).toBeNull()
    }
  })

  test("backdated revision resolves previous base salary from the prior effective date", async () => {
    const db = await createTestDb()

    const token = await adminToken()

    // 登録順: 4月 → 6月 → 5月（バックデート）。E005 は 2025-04-01 の改定をシード済み。
    await requestWithContext({
      db,
      jwtSecret,
      path: "/salary-revisions",
      token,
      method: "POST",
      body: { employee_code: "E005", effective_date: "2026-04-01", new_base_salary: 320000 },
    })

    await requestWithContext({
      db,
      jwtSecret,
      path: "/salary-revisions",
      token,
      method: "POST",
      body: { employee_code: "E005", effective_date: "2026-06-01", new_base_salary: 340000 },
    })

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/salary-revisions",
      token,
      method: "POST",
      body: { employee_code: "E005", effective_date: "2026-05-01", new_base_salary: 330000 },
    })

    expect(response.status).toBe(201)

    const parsed = salaryRevisionResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      // 直前は 2026-04-01（320000）であり、登録が最後の 2026-06-01（340000）ではない。
      expect(parsed.data.previous_base_salary).toBe(320000)
    }
  })

  test("member is forbidden", async () => {
    const response = await request("/salary-revisions", await memberToken(), "POST", {
      employee_code: "E005",
      effective_date: "2026-04-01",
      new_base_salary: 320000,
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown employee_code", async () => {
    const response = await request("/salary-revisions", await adminToken(), "POST", {
      employee_code: "E999",
      effective_date: "2026-04-01",
      new_base_salary: 320000,
    })

    expect(response.status).toBe(404)
  })

  test("returns 400 when new_base_salary is missing", async () => {
    const response = await request("/salary-revisions", await adminToken(), "POST", {
      employee_code: "E005",
      effective_date: "2026-04-01",
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when new_base_salary is negative", async () => {
    const response = await request("/salary-revisions", await adminToken(), "POST", {
      employee_code: "E005",
      effective_date: "2026-04-01",
      new_base_salary: -1,
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when new_base_salary is not an integer", async () => {
    const response = await request("/salary-revisions", await adminToken(), "POST", {
      employee_code: "E005",
      effective_date: "2026-04-01",
      new_base_salary: 320000.5,
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/salary-revisions", null, "POST", {
      employee_code: "E005",
      effective_date: "2026-04-01",
      new_base_salary: 320000,
    })

    expect(response.status).toBe(401)
  })
})
