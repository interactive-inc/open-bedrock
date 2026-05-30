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

const jwtSecret = "payroll-salary-revisions-list-route-test-secret"

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

describe("GET /salary-revisions/:employee_code", () => {
  test("privileged role lists revisions for an employee", async () => {
    const response = await request("/salary-revisions/E005", await adminToken())

    expect(response.status).toBe(200)

    const parsed = z.array(salaryRevisionResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(1)
    }
  })

  test("member is forbidden", async () => {
    const response = await request("/salary-revisions/E005", await memberToken())

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown employee_code", async () => {
    const response = await request("/salary-revisions/E999", await adminToken())

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/salary-revisions/E005", null)

    expect(response.status).toBe(401)
  })
})
