import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedLeaveBalances } from "@/contexts/leave/test/seed/seed-leave-balances.test-support"
import { seedLeaveRequests } from "@/contexts/leave/test/seed/seed-leave-requests.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import {
  initializeCompanyMembershipTestState,
  initializeStandardCompanyTestState,
} from "@tests/api/support/initialize-standard-company-test-state"
import { initializeCompanyTestFixture } from "@tests/api/support/initialize-company-test-fixture"
import { z } from "zod"

const leaveRequestCreateResponseSchema = z.object({
  id: z.number(),
  employee_id: zEmployeeId,
  leave_type: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  days: z.number(),
  reason: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  approver_id: zEmployeeId.nullable(),
  decided_comment: z.string().nullable(),
  created_at: z.string(),
})

const jwtSecret = "leave-requests-route-test-secret"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

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

  await initializeCompanyMembershipTestState(db, [
    { departmentCode: "D003", employeeCode: "E005", managerEmployeeCode: "E004" },
  ])

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
    seedLeaveBalances.map((balance) => ({
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
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
  })
}

describe("POST /leave-requests", () => {
  test("creates a pending leave request and returns 201", async () => {
    const response = await request({
      path: "/leave/leave-requests",
      token: await tokenFor(5),
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
      expect(parsed.data.employee_id).toBe(toWorkforceEmployeeId(5))
      expect(parsed.data.days).toBe(5)
      expect(parsed.data.status).toBe("pending")
      expect(parsed.data.approver_id).toBeNull()
    }
  })

  test("returns 409 when an overlapping pending request already exists", async () => {
    // 以降の重複テストは seed の申請 1（employee 5・2026-06-01〜2026-06-03・pending）に
    // 依存する。seed が変わったら無言で壊れないよう前提をここで明示検証する。
    const seeded = seedLeaveRequests[0]

    expect(seeded?.employeeId).toBe(toWorkforceEmployeeId(5))
    expect(seeded?.status).toBe("pending")
    expect(seeded?.startDate).toBe("2026-06-01")
    expect(seeded?.endDate).toBe("2026-06-03")

    const response = await request({
      path: "/leave/leave-requests",
      token: await tokenFor(5),
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
      path: "/leave/leave-requests",
      token: await tokenFor(5),
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
      path: "/leave/leave-requests",
      token: await tokenFor(5),
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
      path: "/leave/leave-requests",
      token: await tokenFor(5),
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
      path: "/leave/leave-requests",
      token: await tokenFor(5),
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
      path: "/leave/leave-requests",
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

  test("returns 409 at submission time when the balance is insufficient", async () => {
    // employee 5 の annual remaining は 15（seed-leave-balances.ts）。20 日分は超過するため申請自体を拒否する。
    const response = await request({
      path: "/leave/leave-requests",
      token: await tokenFor(5),
      method: "POST",
      body: {
        leave_type: "annual",
        start_date: "2026-09-01",
        end_date: "2026-09-20",
      },
    })

    expect(response.status).toBe(409)
  })

  test("returns 409 at submission time when no balance record exists for the leave type", async () => {
    // employee 9 には leave_balances が一切ない（seed-leave-balances.ts は employee 5/10 のみ）。
    const response = await request({
      path: "/leave/leave-requests",
      token: await tokenFor(9),
      method: "POST",
      body: {
        leave_type: "annual",
        start_date: "2026-08-01",
        end_date: "2026-08-02",
      },
    })

    expect(response.status).toBe(409)
  })

  test("consumes only 0.5 day for a half-day request once approved", async () => {
    const db = await createTestDb()

    const created = await requestWithContext({
      db,
      jwtSecret,
      path: "/leave/leave-requests",
      token: await tokenFor(5),
      method: "POST",
      body: {
        leave_type: "annual",
        start_date: "2026-09-10",
        end_date: "2026-09-10",
        unit: "half_day_am",
      },
    })

    expect(created.status).toBe(201)

    const createdBody = leaveRequestCreateResponseSchema.parse(await created.json())

    const approveResponse = await requestWithContext({
      db,
      jwtSecret,
      path: `/leave/leave-requests/${createdBody.id}/approve`,
      token: await tokenFor(4),
      method: "POST",
      body: { comment: null },
    })

    expect(approveResponse.status).toBe(200)

    const balance = z
      .object({ remaining_days: z.number() })
      .parse(
        await db
          .prepare(
            "SELECT remaining_days FROM leave_balances WHERE employee_id = 5 AND fiscal_year = '2026' AND leave_type = 'annual'",
          )
          .first(),
      )

    // seed の remaining(15) から半休0.5日分だけ減る。
    expect(balance.remaining_days).toBe(14.5)
  })
})

const leaveAdminItemSchema = z.object({
  id: z.number(),
  applicant_id: zEmployeeId,
  applicant_name: z.string(),
  applicant_dept_name: z.string().nullable(),
  leave_type: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  days: z.number(),
  reason: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  created_at: z.string(),
})

const leaveListSchema = z.object({
  data: z.array(leaveAdminItemSchema),
  total: z.number(),
})

/** scope/relation 用に、manager(id2)が id20/id21 の 2 名を配下に持つ小さな組織を組む。 */
const scopeEmployeeRows = [
  { id: 2, code: "M002", email: "you+m002@example.com", role: "manager", departmentId: 1 },
  { id: 20, code: "R020", email: "you+r020@example.com", role: "member", departmentId: 1 },
  { id: 21, code: "R021", email: "you+r021@example.com", role: "member", departmentId: 1 },
  { id: 22, code: "S022", email: "you+s022@example.com", role: "manager", departmentId: 2 },
]

async function createScopeTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedCompanyEmployees(
    db,
    scopeEmployeeRows.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.code,
      deptId: employee.departmentId,
      deptName: "Dept",
      position: "-",
      status: "active",
    })),
  )

  await seedIamForEmployees(
    db,
    scopeEmployeeRows.map((employee) => ({
      id: employee.id,
      email: employee.email,
      passwordHash: "x",
      role: employee.role,
    })),
  )

  await seedD1(db, "leave_requests", [
    {
      id: 100,
      employee_id: "20",
      leave_type: "annual",
      start_date: "2026-06-01",
      end_date: "2026-06-02",
      days: 2,
      reason: null,
      status: "pending",
      approver_id: null,
      decided_comment: null,
      created_at: "2026-05-20T00:00:00Z",
    },
    {
      id: 101,
      employee_id: "21",
      leave_type: "special",
      start_date: "2026-07-01",
      end_date: "2026-07-01",
      days: 1,
      reason: null,
      status: "approved",
      approver_id: "2",
      decided_comment: "ok",
      created_at: "2026-05-21T00:00:00Z",
    },
  ])

  await initializeCompanyTestFixture({
    db,
    employees: scopeEmployeeRows.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.code,
      deptId: employee.departmentId,
      status: "active",
    })),
    departments: [
      { id: 1, code: "D001", name: "Dept One", managerEmployeeCode: "M002" },
      { id: 2, code: "D002", name: "Dept Two", managerEmployeeCode: "S022" },
    ],
    memberships: [
      { departmentCode: "D001", employeeCode: "M002", managerEmployeeCode: null },
      { departmentCode: "D001", employeeCode: "R020", managerEmployeeCode: "M002" },
      { departmentCode: "D001", employeeCode: "R021", managerEmployeeCode: "M002" },
      { departmentCode: "D002", employeeCode: "S022", managerEmployeeCode: null },
    ],
  })

  return db
}

describe("GET /leave-requests", () => {
  test("manager reads a single report's requests via employee_id", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/leave/leave-requests?employee_id=20",
      token: await tokenFor(2),
    })

    expect(response.status).toBe(200)

    const parsed = leaveListSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(
        parsed.data.data.every((item) => item.applicant_id === toWorkforceEmployeeId(20)),
      ).toBe(true)
    }
  })

  test("member requesting another employee_id is forbidden", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/leave/leave-requests?employee_id=21",
      token: await tokenFor(20),
    })

    expect(response.status).toBe(403)
  })

  test("manager gets scope=reports across all reports (2 employees)", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/leave/leave-requests?scope=reports",
      token: await tokenFor(2),
    })

    expect(response.status).toBe(200)

    const parsed = leaveListSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(2)

      const applicantIds = parsed.data.data
        .map((item) => item.applicant_id)
        .sort((left, right) => left.localeCompare(right))

      expect(applicantIds).toEqual([toWorkforceEmployeeId(20), toWorkforceEmployeeId(21)])
    }
  })

  test("manager with no reports gets an empty scope=reports list", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/leave/leave-requests?scope=reports",
      token: await tokenFor(22),
    })

    expect(response.status).toBe(200)

    const parsed = leaveListSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(0)
    }
  })

  test("member requesting scope=reports is forbidden", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/leave/leave-requests?scope=reports",
      token: await tokenFor(20),
    })

    expect(response.status).toBe(403)
  })
})
