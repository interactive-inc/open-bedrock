import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedShiftSwapRequests } from "@/infrastructure/seed/seed-shift-swap-requests"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

const jwtSecret = "shift-swap-requests-approve-route-test-secret"

const now = "2026-01-01T00:00:00.000Z"

const shiftSwapRequestResponseSchema = z.object({
  id: z.number(),
  requester_employee_id: z.number(),
  target_employee_id: z.number(),
  date: z.string(),
  note: z.string().nullable(),
  status: z.string(),
  approved_at: z.string().nullable(),
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
    "shift_swap_requests",
    seedShiftSwapRequests.map((swapRequest) => ({
      id: swapRequest.id,
      requester_employee_id: swapRequest.requesterEmployeeId,
      target_employee_id: swapRequest.targetEmployeeId,
      date: swapRequest.date,
      note: swapRequest.note,
      status: swapRequest.status,
      approved_at: swapRequest.approvedAt,
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

type RequestProps = {
  path: string
  token: string | null
  method?: string
  body?: unknown
}

async function request(props: RequestProps): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
  })
}

describe("POST /shift/swap-requests/:id/approve", () => {
  test("privileged role approves a pending swap request and returns 200", async () => {
    const response = await request({
      path: "/shift/swap-requests/1/approve",
      token: await tokenFor(1, "admin"),
      method: "POST",
    })

    expect(response.status).toBe(200)

    const parsed = shiftSwapRequestResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("approved")
      expect(parsed.data.approved_at).toBe(now)
    }
  })

  test("returns 409 when already approved", async () => {
    const response = await request({
      path: "/shift/swap-requests/2/approve",
      token: await tokenFor(1, "admin"),
      method: "POST",
    })

    expect(response.status).toBe(409)
  })

  test("returns 404 for a missing swap request", async () => {
    const response = await request({
      path: "/shift/swap-requests/9999/approve",
      token: await tokenFor(1, "admin"),
      method: "POST",
    })

    expect(response.status).toBe(404)
  })

  test("member is forbidden", async () => {
    const response = await request({
      path: "/shift/swap-requests/1/approve",
      token: await tokenFor(5, "member"),
      method: "POST",
    })

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/shift/swap-requests/1/approve",
      token: null,
      method: "POST",
    })

    expect(response.status).toBe(401)
  })
})
