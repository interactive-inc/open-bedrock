import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedLeaveRequests } from "@/infrastructure/seed/seed-leave-requests"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "leave-admin-route-test-secret"

const leaveAdminResponseSchema = z.object({
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

const listSchema = z.object({
  data: z.array(leaveAdminResponseSchema),
  total: z.number(),
})

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "leave_requests",
    seedLeaveRequests.map((request) => ({
      id: request.id,
      employee_id: request.employeeId,
      leave_type: request.leaveType,
      start_date: request.startDate,
      end_date: request.endDate,
      days: request.days,
      reason: request.reason,
      status: request.status,
      approver_id: request.approverId,
      decided_comment: request.decidedComment,
      created_at: request.createdAt,
    })),
  )

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

  return db
}

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role: role,
  })
}

async function request(path: string, token: string | null): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path,
    token,
  })
}

describe("GET /leave/requests/admin", () => {
  test("returns 200 with all leave requests for admin", async () => {
    const response = await request("/leave/requests/admin", await tokenFor(1, "admin"))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(seedLeaveRequests.length)
    }
  })

  test("returns 403 for manager", async () => {
    const response = await request("/leave/requests/admin", await tokenFor(4, "manager"))

    expect(response.status).toBe(403)
  })

  test("returns 403 for member", async () => {
    const response = await request("/leave/requests/admin", await tokenFor(5, "member"))

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/leave/requests/admin", null)

    expect(response.status).toBe(401)
  })

  test("filters by status", async () => {
    const response = await request(
      "/leave/requests/admin?status=approved",
      await tokenFor(1, "admin"),
    )

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((item) => item.status === "approved")).toBe(true)
    }
  })

  test("filters by leave_type", async () => {
    const response = await request(
      "/leave/requests/admin?leave_type=annual",
      await tokenFor(1, "admin"),
    )

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((item) => item.leave_type === "annual")).toBe(true)
    }
  })

  test("filters by applicant_id", async () => {
    const response = await request(
      "/leave/requests/admin?applicant_id=5",
      await tokenFor(1, "admin"),
    )

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((item) => item.applicant_id === 5)).toBe(true)
    }
  })
})
