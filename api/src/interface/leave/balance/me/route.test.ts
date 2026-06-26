import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedLeaveBalances } from "@/infrastructure/seed/seed-leave-balances"
import { seedLeaveRequests } from "@/infrastructure/seed/seed-leave-requests"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
import { z } from "zod"

const leaveBalanceResponseSchema = z.object({
  fiscal_year: z.string(),
  leave_type: z.enum(["annual", "special"]),
  granted_days: z.number(),
  used_days: z.number(),
  remaining_days: z.number(),
})

const jwtSecret = "leave-balance-me-route-test-secret"

// 2026 年度（4 月始まり）内の日付。シードの fiscal_year "2026" と整合させる。
const fiscalNow = "2026-06-01T00:00:00.000Z"

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
    "leave_requests",
    seedLeaveRequests.map((leaveRequest) => ({
      id: leaveRequest.id,
      employee_id: leaveRequest.employeeId,
      leave_type: leaveRequest.leaveType,
      start_date: leaveRequest.startDate,
      end_date: leaveRequest.endDate,
      days: leaveRequest.days,
      reason: leaveRequest.reason,
      status: leaveRequest.status,
      approver_id: leaveRequest.approverId,
      decided_comment: leaveRequest.decidedComment,
      created_at: leaveRequest.createdAt,
    })),
  )

  await seedD1(
    db,
    "leave_balances",
    seedLeaveBalances.map((balance) => ({
      employee_id: balance.employeeId,
      fiscal_year: balance.fiscalYear,
      leave_type: balance.leaveType,
      granted_days: balance.grantedDays,
      used_days: balance.usedDays,
      remaining_days: balance.remainingDays,
    })),
  )

  return db
}

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role,
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
    now: fiscalNow,
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
  })
}

describe("GET /leave/balance/me", () => {
  test("returns 200 with the balance rows for the current fiscal year", async () => {
    const response = await request({
      path: "/leave/balance/me",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = z.array(leaveBalanceResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(2)

      const annual = parsed.data.find((row) => row.leave_type === "annual")

      expect(annual?.remaining_days).toBe(15)
      expect(annual?.fiscal_year).toBe("2026")
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/leave/balance/me", token: null })

    expect(response.status).toBe(401)
  })
})
