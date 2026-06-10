import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedShiftSwapRequests } from "@/infrastructure/seed/seed-shift-swap-requests"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

const jwtSecret = "shift-swap-request-crud-test-secret"

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

describe("GET /shift/swap-requests/me", () => {
  test("returns only the requester's own requests", async () => {
    const response = await request({
      path: "/shift/swap-requests/me",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = z.array(shiftSwapRequestResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(1)
      expect(parsed.data[0].requester_employee_id).toBe(5)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/shift/swap-requests/me", token: null })

    expect(response.status).toBe(401)
  })
})

describe("GET /shift/swap-requests/:id", () => {
  test("the requester can read their own request", async () => {
    const response = await request({
      path: "/shift/swap-requests/1",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = shiftSwapRequestResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(1)
    }
  })

  test("an approver can read another person's request", async () => {
    const response = await request({
      path: "/shift/swap-requests/1",
      token: await tokenFor(1, "admin"),
    })

    expect(response.status).toBe(200)
  })

  test("returns 403 for a non-requester non-approver", async () => {
    const response = await request({
      path: "/shift/swap-requests/1",
      token: await tokenFor(10, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown request", async () => {
    const response = await request({
      path: "/shift/swap-requests/9999",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /shift/swap-requests/:id", () => {
  test("the requester cancels their pending request and returns 204", async () => {
    const response = await request({
      path: "/shift/swap-requests/1",
      token: await tokenFor(5, "member"),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 403 when cancelling another person's request", async () => {
    const response = await request({
      path: "/shift/swap-requests/1",
      token: await tokenFor(4, "member"),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 409 when cancelling an approved request", async () => {
    const response = await request({
      path: "/shift/swap-requests/2",
      token: await tokenFor(4, "member"),
      method: "DELETE",
    })

    expect(response.status).toBe(409)
  })

  test("returns 404 for an unknown request", async () => {
    const response = await request({
      path: "/shift/swap-requests/9999",
      token: await tokenFor(5, "member"),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/shift/swap-requests/1",
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
