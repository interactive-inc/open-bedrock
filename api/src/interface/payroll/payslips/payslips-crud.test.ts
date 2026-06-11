import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedPayslips } from "@/infrastructure/seed/seed-payslips"
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

const jwtSecret = "payroll-payslips-crud-test-secret"

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

describe("PUT /payslips/:id", () => {
  test("admin corrects period and amounts of a payslip", async () => {
    const response = await request({
      path: "/payslips/1",
      token: await adminToken(),
      method: "PUT",
      body: {
        period: "2026-04",
        base_salary: 310000,
        allowances: 25000,
        deductions: 50000,
        net_pay: 285000,
      },
    })

    expect(response.status).toBe(200)

    const parsed = payslipResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.base_salary).toBe(310000)
      expect(parsed.data.net_pay).toBe(285000)
    }
  })

  test("returns 403 for a non-privileged member", async () => {
    const response = await request({
      path: "/payslips/1",
      token: await memberToken(),
      method: "PUT",
      body: {
        period: "2026-04",
        base_salary: 310000,
        allowances: 25000,
        deductions: 50000,
        net_pay: 285000,
      },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for a missing payslip", async () => {
    const response = await request({
      path: "/payslips/9999",
      token: await adminToken(),
      method: "PUT",
      body: {
        period: "2026-04",
        base_salary: 310000,
        allowances: 25000,
        deductions: 50000,
        net_pay: 285000,
      },
    })

    expect(response.status).toBe(404)
  })

  test("returns 404 for a non-numeric id", async () => {
    const response = await request({
      path: "/payslips/abc",
      token: await adminToken(),
      method: "PUT",
      body: {
        period: "2026-04",
        base_salary: 310000,
        allowances: 25000,
        deductions: 50000,
        net_pay: 285000,
      },
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/payslips/1",
      token: null,
      method: "PUT",
      body: {
        period: "2026-04",
        base_salary: 310000,
        allowances: 25000,
        deductions: 50000,
        net_pay: 285000,
      },
    })

    expect(response.status).toBe(401)
  })

  test("returns 400 when net_pay is negative", async () => {
    const response = await request({
      path: "/payslips/1",
      token: await adminToken(),
      method: "PUT",
      body: {
        period: "2026-04",
        base_salary: 310000,
        allowances: 25000,
        deductions: 50000,
        net_pay: -285000,
      },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when base_salary is negative", async () => {
    const response = await request({
      path: "/payslips/1",
      token: await adminToken(),
      method: "PUT",
      body: {
        period: "2026-04",
        base_salary: -1,
        allowances: 25000,
        deductions: 50000,
        net_pay: 285000,
      },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when net_pay is not an integer", async () => {
    const response = await request({
      path: "/payslips/1",
      token: await adminToken(),
      method: "PUT",
      body: {
        period: "2026-04",
        base_salary: 310000,
        allowances: 25000,
        deductions: 50000,
        net_pay: 285000.5,
      },
    })

    expect(response.status).toBe(400)
  })

  test("returns 409 when correcting a draft payslip", async () => {
    const response = await request({
      path: "/payslips/4",
      token: await adminToken(),
      method: "PUT",
      body: {
        period: "2026-05",
        base_salary: 310000,
        allowances: 25000,
        deductions: 50000,
        net_pay: 285000,
      },
    })

    expect(response.status).toBe(409)
  })
})

describe("DELETE /payslips/:id", () => {
  test("admin cancels a draft payslip and returns 204", async () => {
    const response = await request({
      path: "/payslips/4",
      token: await adminToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 409 when cancelling an issued payslip", async () => {
    const response = await request({
      path: "/payslips/1",
      token: await adminToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(409)
  })

  test("returns 403 for a non-privileged member", async () => {
    const response = await request({
      path: "/payslips/4",
      token: await memberToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for a missing payslip", async () => {
    const response = await request({
      path: "/payslips/9999",
      token: await adminToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/payslips/1",
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
