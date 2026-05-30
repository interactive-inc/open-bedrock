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
  status: z.enum(["pending", "approved", "rejected"]),
})

const jwtSecret = "leave-requests-approve-route-test-secret"

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
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
  })
}

describe("POST /leave/requests/:id/approve", () => {
  test("approves a pending request and decrements the balance", async () => {
    const db = await createTestDb()

    const managerToken = await tokenFor(4, "manager")

    const approveResponse = await requestWithContext({
      db,
      jwtSecret,
      path: "/leave/requests/1/approve",
      token: managerToken,
      method: "POST",
      body: { comment: "approved" },
    })

    expect(approveResponse.status).toBe(200)

    const approveParsed = leaveDecisionResponseSchema.safeParse(await approveResponse.json())

    expect(approveParsed.success).toBe(true)

    if (approveParsed.success) {
      expect(approveParsed.data.status).toBe("approved")
    }

    const ownerToken = await tokenFor(5, "member")

    const balanceResponse = await requestWithContext({
      db,
      jwtSecret,
      path: "/leave/balance/me",
      token: ownerToken,
    })

    const balances = z.array(leaveBalanceResponseSchema).parse(await balanceResponse.json())

    const annual = balances.find((row) => row.leave_type === "annual")

    expect(annual?.remaining_days).toBe(12)
    expect(annual?.used_days).toBe(8)
  })

  test("returns 403 for a member", async () => {
    const response = await request({
      path: "/leave/requests/1/approve",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { comment: null },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 when the request does not exist", async () => {
    const response = await request({
      path: "/leave/requests/9999/approve",
      token: await tokenFor(4, "manager"),
      method: "POST",
      body: { comment: null },
    })

    expect(response.status).toBe(404)
  })

  test("returns 400 for an invalid id", async () => {
    const response = await request({
      path: "/leave/requests/abc/approve",
      token: await tokenFor(4, "manager"),
      method: "POST",
      body: { comment: null },
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/leave/requests/1/approve",
      token: null,
      method: "POST",
      body: { comment: null },
    })

    expect(response.status).toBe(401)
  })
})
