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

const leaveRequestCreateResponseSchema = z.object({
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

const jwtSecret = "leave-requests-route-test-secret"

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

describe("POST /leave/requests", () => {
  test("creates a pending leave request and returns 201", async () => {
    const response = await request({
      path: "/leave/requests",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: {
        leave_type: "annual",
        start_date: "2026-08-01",
        end_date: "2026-08-05",
        reason: "summer vacation",
      },
    })

    expect(response.status).toBe(201)

    const parsed = leaveRequestCreateResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.employee_id).toBe(5)
      expect(parsed.data.days).toBe(5)
      expect(parsed.data.status).toBe("pending")
      expect(parsed.data.approver_id).toBeNull()
    }
  })

  test("returns 409 when an overlapping pending request already exists", async () => {
    // 以降の重複テストは seed の申請 1（employee 5・2026-06-01〜2026-06-03・pending）に
    // 依存する。seed が変わったら無言で壊れないよう前提をここで明示検証する。
    const seeded = seedLeaveRequests[0]

    expect(seeded?.employeeId).toBe(5)
    expect(seeded?.status).toBe("pending")
    expect(seeded?.startDate).toBe("2026-06-01")
    expect(seeded?.endDate).toBe("2026-06-03")

    const response = await request({
      path: "/leave/requests",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: {
        leave_type: "annual",
        start_date: "2026-06-02",
        end_date: "2026-06-04",
      },
    })

    expect(response.status).toBe(409)
  })

  test("treats a shared boundary date as an overlap", async () => {
    const response = await request({
      path: "/leave/requests",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: {
        leave_type: "annual",
        start_date: "2026-06-03",
        end_date: "2026-06-05",
      },
    })

    expect(response.status).toBe(409)
  })

  test("allows a request that starts immediately after an existing one", async () => {
    const response = await request({
      path: "/leave/requests",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: {
        leave_type: "annual",
        start_date: "2026-06-04",
        end_date: "2026-06-06",
      },
    })

    expect(response.status).toBe(201)
  })

  test("returns 400 when the end date precedes the start date", async () => {
    const response = await request({
      path: "/leave/requests",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: {
        leave_type: "annual",
        start_date: "2026-08-05",
        end_date: "2026-08-01",
      },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when leave_type is invalid", async () => {
    const response = await request({
      path: "/leave/requests",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: {
        leave_type: "bogus",
        start_date: "2026-08-01",
        end_date: "2026-08-05",
      },
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/leave/requests",
      token: null,
      method: "POST",
      body: {
        leave_type: "annual",
        start_date: "2026-08-01",
        end_date: "2026-08-05",
      },
    })

    expect(response.status).toBe(401)
  })
})
