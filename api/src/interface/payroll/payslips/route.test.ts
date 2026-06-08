import { describe, expect, spyOn, test } from "bun:test"
import { PayslipRepository } from "@/infrastructure/payroll/payslip-repository"
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

const jwtSecret = "payroll-payslips-create-route-test-secret"

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

describe("POST /payslips", () => {
  test("privileged role issues a payslip with computed net pay", async () => {
    const response = await request("/payslips", await adminToken(), "POST", {
      employee_code: "E005",
      period: "2026-05",
      base_salary: 300000,
      allowances: 20000,
      deductions: 45000,
    })

    expect(response.status).toBe(201)

    const parsed = payslipResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.employee_id).toBe(5)
      expect(parsed.data.net_pay).toBe(275000)
      expect(parsed.data.status).toBe("issued")
      expect(parsed.data.issued_at).toBe("2026-01-01T00:00:00.000Z")
    }
  })

  test("member is forbidden", async () => {
    const response = await request("/payslips", await memberToken(), "POST", {
      employee_code: "E005",
      period: "2026-05",
      base_salary: 300000,
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown employee_code", async () => {
    const response = await request("/payslips", await adminToken(), "POST", {
      employee_code: "E999",
      period: "2026-05",
      base_salary: 300000,
    })

    expect(response.status).toBe(404)
  })

  test("returns 409 when a payslip already exists for the same period", async () => {
    // E005 は period 2026-04 の給与明細をシード済み。同一期間の再発行は弾く。
    const response = await request("/payslips", await adminToken(), "POST", {
      employee_code: "E005",
      period: "2026-04",
      base_salary: 300000,
    })

    expect(response.status).toBe(409)
  })

  test("issues twice for the same period only once via the duplicate guard", async () => {
    const db = await createTestDb()

    const token = await adminToken()

    const first = await requestWithContext({
      db,
      jwtSecret,
      path: "/payslips",
      token,
      method: "POST",
      body: { employee_code: "E010", period: "2026-05", base_salary: 250000 },
    })

    const second = await requestWithContext({
      db,
      jwtSecret,
      path: "/payslips",
      token,
      method: "POST",
      body: { employee_code: "E010", period: "2026-05", base_salary: 250000 },
    })

    expect(first.status).toBe(201)
    expect(second.status).toBe(409)
  })

  test("returns 409 (not 500) when the existence check races and insert hits the unique index", async () => {
    const db = await createTestDb()

    const token = await adminToken()

    function issue(): Promise<Response> {
      return requestWithContext({
        db,
        jwtSecret,
        path: "/payslips",
        token,
        method: "POST",
        body: { employee_code: "E010", period: "2026-05", base_salary: 250000 },
      })
    }

    const first = await issue()

    expect(first.status).toBe(201)

    // TOCTOU 競合を再現する。2回目の existence チェックだけ未検出（null）に偽装し
    // insert を UNIQUE 索引に当てる。insert 失敗を UNIQUE 違反として判別し 409 にマッピングする。
    const spy = spyOn(PayslipRepository.prototype, "findByEmployeeAndPeriod")

    spy.mockImplementationOnce(() => Promise.resolve(null))

    try {
      const second = await issue()

      // 500 ではなく重複として 409 を返す。
      expect(second.status).toBe(409)
    } finally {
      spy.mockRestore()
    }
  })

  test("returns 409 (not 500) even when reads keep failing after the insert races (double fault)", async () => {
    const db = await createTestDb()

    const token = await adminToken()

    function issue(): Promise<Response> {
      return requestWithContext({
        db,
        jwtSecret,
        path: "/payslips",
        token,
        method: "POST",
        body: { employee_code: "E010", period: "2026-05", base_salary: 250000 },
      })
    }

    const first = await issue()

    expect(first.status).toBe(201)

    // issue #45 の二重障害を再現する。existence チェックは未検出（null）に偽装して insert を
    // UNIQUE 索引へ当て、その後の読み取りはすべて一時的 DB エラーにする。再読込に依存せず
    // UNIQUE 違反だけで重複を判定するので、旧実装の 500 ではなく 409 を返す。
    const spy = spyOn(PayslipRepository.prototype, "findByEmployeeAndPeriod")

    spy.mockImplementationOnce(() => Promise.resolve(null))

    spy.mockImplementation(() => Promise.resolve(new Error("transient read failure")))

    try {
      const second = await issue()

      expect(second.status).toBe(409)
    } finally {
      spy.mockRestore()
    }
  })

  test("returns 500 (not 409) when the insert fails with a non-unique error", async () => {
    // UNIQUE 違反だけが 409 へ降格する契約を固定する。素の DB エラーは 500 のまま。
    const db = await createTestDb()

    const token = await adminToken()

    const spy = spyOn(PayslipRepository.prototype, "create")

    spy.mockImplementation(() => Promise.resolve(new Error("connection lost")))

    try {
      const response = await requestWithContext({
        db,
        jwtSecret,
        path: "/payslips",
        token,
        method: "POST",
        body: { employee_code: "E010", period: "2026-09", base_salary: 250000 },
      })

      expect(response.status).toBe(500)
    } finally {
      spy.mockRestore()
    }
  })

  test("returns 400 when base_salary is missing", async () => {
    const response = await request("/payslips", await adminToken(), "POST", {
      employee_code: "E005",
      period: "2026-05",
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when base_salary is negative", async () => {
    const response = await request("/payslips", await adminToken(), "POST", {
      employee_code: "E005",
      period: "2026-05",
      base_salary: -1,
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when deductions is negative", async () => {
    const response = await request("/payslips", await adminToken(), "POST", {
      employee_code: "E005",
      period: "2026-05",
      base_salary: 300000,
      deductions: -1,
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when deductions exceed base salary plus allowances (net pay would be negative)", async () => {
    const response = await request("/payslips", await adminToken(), "POST", {
      employee_code: "E005",
      period: "2026-05",
      base_salary: 100000,
      allowances: 0,
      deductions: 200000,
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when base_salary is not an integer", async () => {
    const response = await request("/payslips", await adminToken(), "POST", {
      employee_code: "E005",
      period: "2026-05",
      base_salary: 300000.5,
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when base_salary exceeds the safe integer range", async () => {
    const response = await request("/payslips", await adminToken(), "POST", {
      employee_code: "E005",
      period: "2026-05",
      base_salary: 10_000_000_000_000_000,
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/payslips", null, "POST", {
      employee_code: "E005",
      period: "2026-05",
      base_salary: 300000,
    })

    expect(response.status).toBe(401)
  })
})
