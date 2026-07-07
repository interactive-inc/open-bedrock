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

const leaveAdminItemSchema = z.object({
  id: z.number(),
  applicant_id: z.number(),
  applicant_name: z.string(),
  applicant_dept_name: z.string().nullable(),
  leave_type: z.enum(["annual", "special"]),
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

// scope/relation 用に、manager(id2)が id20/id21 の 2 名を配下に持つ小さな組織を組む。
const scopeEmployeeRows = [
  { id: 2, code: "M002", email: "you+m002@example.com", role: "manager" },
  { id: 20, code: "R020", email: "you+r020@example.com", role: "member" },
  { id: 21, code: "R021", email: "you+r021@example.com", role: "member" },
  { id: 22, code: "S022", email: "you+s022@example.com", role: "manager" },
]

async function createScopeTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "employees",
    scopeEmployeeRows.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.code,
      dept_id: 1,
      dept_name: "Dept",
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

  await seedD1(db, "org_memberships", [
    { department_code: "D001", employee_code: "M002", manager_employee_code: null },
    { department_code: "D001", employee_code: "R020", manager_employee_code: "M002" },
    { department_code: "D001", employee_code: "R021", manager_employee_code: "M002" },
    { department_code: "D002", employee_code: "S022", manager_employee_code: null },
  ])

  await seedD1(db, "leave_requests", [
    {
      id: 100,
      employee_id: 20,
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
      employee_id: 21,
      leave_type: "special",
      start_date: "2026-07-01",
      end_date: "2026-07-01",
      days: 1,
      reason: null,
      status: "approved",
      approver_id: 2,
      decided_comment: "ok",
      created_at: "2026-05-21T00:00:00Z",
    },
  ])

  return db
}

describe("GET /leave/requests", () => {
  test("manager reads a single report's requests via employee_id", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/leave/requests?employee_id=20",
      token: await tokenFor(2, "manager"),
    })

    expect(response.status).toBe(200)

    const parsed = leaveListSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((item) => item.applicant_id === 20)).toBe(true)
    }
  })

  test("member requesting another employee_id is forbidden", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/leave/requests?employee_id=21",
      token: await tokenFor(20, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("manager gets scope=reports across all reports (2 employees)", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/leave/requests?scope=reports",
      token: await tokenFor(2, "manager"),
    })

    expect(response.status).toBe(200)

    const parsed = leaveListSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(2)

      const applicantIds = parsed.data.data.map((item) => item.applicant_id).sort((a, b) => a - b)

      expect(applicantIds).toEqual([20, 21])
    }
  })

  test("manager with no reports gets an empty scope=reports list", async () => {
    const response = await requestWithContext({
      db: await createScopeTestDb(),
      jwtSecret,
      path: "/leave/requests?scope=reports",
      token: await tokenFor(22, "manager"),
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
      path: "/leave/requests?scope=reports",
      token: await tokenFor(20, "member"),
    })

    expect(response.status).toBe(403)
  })
})
