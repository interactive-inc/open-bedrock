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

const leaveRequestRowSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
})

const jwtSecret = "leave-requests-approve-route-test-secret"

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

describe("POST /leave/requests/:id/approve", () => {
  test("approves a pending request and decrements the balance", async () => {
    const db = await createTestDb()

    const managerToken = await tokenFor(4, "manager")

    const approveResponse = await requestWithContext({
      db,
      jwtSecret,
      now: fiscalNow,
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
      expect(approveParsed.data.approver_id).toBe(4)
      expect(approveParsed.data.decided_comment).toBe("approved")
      expect(approveParsed.data.employee_id).toBe(5)
      expect(approveParsed.data.leave_type).toBe("annual")
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

    expect(annual?.remaining_days).toBe(12)
    expect(annual?.used_days).toBe(8)
  })

  test("re-approving an already-decided request returns 409 and does not decrement the balance twice", async () => {
    const db = await createTestDb()

    const managerToken = await tokenFor(4, "manager")

    function approve(): Promise<Response> {
      return requestWithContext({
        db,
        jwtSecret,
        now: fiscalNow,
        path: "/leave/requests/1/approve",
        token: managerToken,
        method: "POST",
        body: { comment: "approved" },
      })
    }

    const first = await approve()

    expect(first.status).toBe(200)

    const second = await approve()

    expect(second.status).toBe(409)

    const balanceResponse = await requestWithContext({
      db,
      jwtSecret,
      now: fiscalNow,
      path: "/leave/balance/me",
      token: await tokenFor(5, "member"),
    })

    const balances = z.array(leaveBalanceResponseSchema).parse(await balanceResponse.json())

    const annual = balances.find((row) => row.leave_type === "annual")

    // 1回ぶんだけ減算されている。旧実装では再承認で二重減算されていた。
    expect(annual?.remaining_days).toBe(12)
    expect(annual?.used_days).toBe(8)
  })

  test("keeps the request pending when balance is insufficient", async () => {
    const db = await createTestDb()

    await db
      .prepare(
        `
        UPDATE leave_balances
        SET used_days = 19, remaining_days = 1
        WHERE employee_id = 5 AND fiscal_year = '2026' AND leave_type = 'annual'
        `,
      )
      .run()

    const response = await requestWithContext({
      db,
      jwtSecret,
      now: fiscalNow,
      path: "/leave/requests/1/approve",
      token: await tokenFor(4, "manager"),
      method: "POST",
      body: { comment: "approved" },
    })

    expect(response.status).toBe(409)

    const requestRow = leaveRequestRowSchema.parse(
      await db.prepare("SELECT status FROM leave_requests WHERE id = 1").first(),
    )

    const balance = leaveBalanceResponseSchema.parse(
      await db
        .prepare(
          `
          SELECT fiscal_year, leave_type, granted_days, used_days, remaining_days
          FROM leave_balances
          WHERE employee_id = 5 AND fiscal_year = '2026' AND leave_type = 'annual'
          `,
        )
        .first(),
    )

    expect(requestRow.status).toBe("pending")
    expect(balance.used_days).toBe(19)
    expect(balance.remaining_days).toBe(1)
  })

  test("keeps the request pending when the balance record is missing", async () => {
    const db = await createTestDb()

    await db
      .prepare(
        `
        DELETE FROM leave_balances
        WHERE employee_id = 5 AND fiscal_year = '2026' AND leave_type = 'annual'
        `,
      )
      .run()

    const response = await requestWithContext({
      db,
      jwtSecret,
      now: fiscalNow,
      path: "/leave/requests/1/approve",
      token: await tokenFor(4, "manager"),
      method: "POST",
      body: { comment: "approved" },
    })

    expect(response.status).toBe(409)

    const requestRow = leaveRequestRowSchema.parse(
      await db.prepare("SELECT status FROM leave_requests WHERE id = 1").first(),
    )

    expect(requestRow.status).toBe("pending")
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

  test("returns 404 for an invalid id", async () => {
    const response = await request({
      path: "/leave/requests/abc/approve",
      token: await tokenFor(4, "manager"),
      method: "POST",
      body: { comment: null },
    })

    expect(response.status).toBe(404)
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
