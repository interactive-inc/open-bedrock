import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/api/test/support/company/seed-employees.repository"
import { seedShiftSwapRequests } from "@/contexts/shift/infrastructure/seed/seed-shift-swap-requests.repository"
import { createTestToken } from "@/api/test/support/create-test-token"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { initializeStandardCompanyTestState } from "@/api/test/support/initialize-standard-company-test-state"
import { z } from "zod"

const jwtSecret = "shift-swap-admin-route-test-secret"

const swapAdminResponseSchema = z.object({
  id: z.number(),
  requester_employee_id: z.number(),
  requester_employee_code: z.string(),
  requester_name: z.string(),
  requester_dept_name: z.string().nullable(),
  target_employee_id: z.number(),
  target_employee_code: z.string(),
  target_name: z.string(),
  date: z.string(),
  note: z.string().nullable(),
  status: z.string(),
  approved_at: z.string().nullable(),
})

const listSchema = z.object({
  data: z.array(swapAdminResponseSchema),
  total: z.number(),
})

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
    "shift_swap_requests",
    seedShiftSwapRequests.map((swap) => ({
      id: swap.id,
      requester_employee_id: swap.requesterEmployeeId,
      target_employee_id: swap.targetEmployeeId,
      date: swap.date,
      note: swap.note,
      status: swap.status,
      approved_at: swap.approvedAt,
    })),
  )

  await initializeStandardCompanyTestState(db)

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: employeeId,
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

describe("GET /shift-swap-requests/admin", () => {
  test("returns 200 with all swap requests for admin", async () => {
    const response = await request("/shift-swap-requests/admin", await tokenFor(1))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(seedShiftSwapRequests.length)

      const first = parsed.data.data.find((item) => item.id === 1)

      expect(first?.requester_name).toBe("Emery Lane")
      expect(first?.target_name).toBe("Drew Sato")
    }
  })

  test("returns 403 for manager", async () => {
    const response = await request("/shift-swap-requests/admin", await tokenFor(4))

    expect(response.status).toBe(403)
  })

  test("returns 403 for member", async () => {
    const response = await request("/shift-swap-requests/admin", await tokenFor(5))

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/shift-swap-requests/admin", null)

    expect(response.status).toBe(401)
  })

  test("filters by status", async () => {
    const response = await request("/shift-swap-requests/admin?status=pending", await tokenFor(1))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((item) => item.status === "pending")).toBe(true)
    }
  })

  test("filters by requester_id", async () => {
    const response = await request("/shift-swap-requests/admin?requester_id=5", await tokenFor(1))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((item) => item.requester_employee_id === 5)).toBe(true)
    }
  })

  test("filters by date range", async () => {
    const response = await request(
      "/shift-swap-requests/admin?from=2026-06-01&to=2026-06-01",
      await tokenFor(1),
    )

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((item) => item.date === "2026-06-01")).toBe(true)
    }
  })
})
