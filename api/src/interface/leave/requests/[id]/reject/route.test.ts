import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedLeaveBalances } from "@/infrastructure/seed/seed-leave-balances"
import { seedLeaveRequests } from "@/infrastructure/seed/seed-leave-requests"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

const leaveBalanceResponseSchema = z.object({
  fiscal_year: z.string(),
  leave_type: z.enum(["annual", "special"]),
  granted_days: z.number(),
  used_days: z.number(),
  remaining_days: z.number(),
})

const leaveDecisionResponseSchema = z.object({
  id: z.number(),
  employee_id: z.number(),
  leave_type: z.enum(["annual", "special"]),
  start_date: z.string(),
  end_date: z.string(),
  days: z.number(),
  reason: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  approver_id: z.number().nullable(),
  decided_comment: z.string().nullable(),
  created_at: z.string(),
})

const jwtSecret = "leave-requests-reject-route-test-secret"

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

describe("POST /leave/requests/:id/reject", () => {
  test("rejects a pending request without touching the balance", async () => {
    const db = await createTestDb()

    const managerToken = await tokenFor(4, "manager")

    const rejectResponse = await requestWithContext({
      db,
      jwtSecret,
      now: fiscalNow,
      path: "/leave/requests/1/reject",
      token: managerToken,
      method: "POST",
      body: { comment: "not this time" },
    })

    expect(rejectResponse.status).toBe(200)

    const rejectParsed = leaveDecisionResponseSchema.safeParse(await rejectResponse.json())

    expect(rejectParsed.success).toBe(true)

    if (rejectParsed.success) {
      expect(rejectParsed.data.status).toBe("rejected")
      expect(rejectParsed.data.approver_id).toBe(4)
      expect(rejectParsed.data.decided_comment).toBe("not this time")
      expect(rejectParsed.data.employee_id).toBe(5)
      expect(rejectParsed.data.leave_type).toBe("annual")
    }

    const ownerToken = await tokenFor(5, "member")

    const balanceResponse = await requestWithContext({
      db,
      jwtSecret,
      now: fiscalNow,
      path: "/leave/balance/me",
      token: ownerToken,
    })

    const balances = z.array(leaveBalanceResponseSchema).parse(await balanceResponse.json())

    const annual = balances.find((row) => row.leave_type === "annual")

    expect(annual?.remaining_days).toBe(15)
  })

  test("returns 403 for a member", async () => {
    const response = await request({
      path: "/leave/requests/1/reject",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { comment: "rejected" },
    })

    expect(response.status).toBe(403)
  })
})
