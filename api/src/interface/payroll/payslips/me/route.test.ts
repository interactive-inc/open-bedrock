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

const payslipResponseSchema = z.object({
  id: z.number(),
  employee_id: z.number(),
  period: z.string(),
  base_salary: z.number(),
  allowances: z.number(),
  deductions: z.number(),
  net_pay: z.number(),
  issued_at: z.string().nullable(),
  status: z.enum(["draft", "issued"]),
})

const jwtSecret = "payroll-payslips-me-route-test-secret"

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

const payslipListResponseSchema = z.object({
  data: z.array(payslipResponseSchema),
  total: z.number(),
})

describe("GET /payslips/me", () => {
  test("returns 200 with the caller's payslips", async () => {
    const response = await request("/payslips/me", await memberToken())

    expect(response.status).toBe(200)

    const parsed = payslipListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
      expect(parsed.data.total).toBe(2)
      expect(parsed.data.data.every((payslip) => payslip.employee_id === 5)).toBe(true)
    }
  })

  test("filters by period", async () => {
    const response = await request("/payslips/me?period=2099-01", await memberToken())

    expect(response.status).toBe(200)

    const parsed = payslipListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(0)
      expect(parsed.data.total).toBe(0)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/payslips/me", null)

    expect(response.status).toBe(401)
  })
})
