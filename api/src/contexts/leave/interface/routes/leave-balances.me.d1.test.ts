import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedLeaveBalances } from "@/contexts/leave/test/seed/seed-leave-balances.test-support"
import { seedLeaveRequests } from "@/contexts/leave/test/seed/seed-leave-requests.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(2)
})

afterAll(async () => {
  await pool.dispose()
})

const leaveBalanceResponseSchema = z.object({
  fiscal_year: z.string(),
  leave_type: z.string(),
  granted_days: z.number(),
  used_days: z.number(),
  remaining_days: z.number(),
})

const jwtSecret = "leave-balance-me-route-test-secret"

/** 2026 年度（4 月始まり）内の日付。シードの fiscal_year "2026" と整合させる。 */
const fiscalNow = "2026-06-01T00:00:00.000Z"

async function createTestDb(): Promise<D1Database> {
  const db = await pool.next()

  await seedCompanyEmployees(
    db,
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      deptId: employee.deptId,
      deptName: employee.deptName,
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
      consumed_days: leaveRequest.days,
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
    seedLeaveBalances.map((balance, index) => ({
      id: `0190004c-0000-7000-8000-${String(index + 1).padStart(12, "0")}`,
      employee_id: balance.employeeId,
      fiscal_year: balance.fiscalYear,
      leave_type: balance.leaveType,
      granted_days: balance.grantedDays,
      used_days: balance.usedDays,
      remaining_days: balance.remainingDays,
    })),
  )
  await initializeStandardCompanyTestState(db)

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
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

describe("GET /leave-balances/me", () => {
  test("returns 200 with the balance rows for the current fiscal year", async () => {
    const response = await request({
      path: "/leave/leave-balances/me",
      token: await tokenFor(5),
    })

    expect(response.status).toBe(200)

    const parsed = z.array(leaveBalanceResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(5)

      const annual = parsed.data.find((row) => row.leave_type === "annual")

      expect(annual?.remaining_days).toBe(15)
      expect(annual?.fiscal_year).toBe("2026")
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/leave/leave-balances/me", token: null })

    expect(response.status).toBe(401)
  })
})
