import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedShiftSwapRequests } from "@/contexts/shift/test/seed/seed-shift-swap-requests.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const jwtSecret = "shift-swap-request-crud-test-secret"

const shiftSwapRequestResponseSchema = z.object({
  id: z.number(),
  requester_employee_id: zEmployeeId,
  target_employee_id: zEmployeeId,
  date: z.string(),
  note: z.string().nullable(),
  status: z.string(),
  approved_at: z.string().nullable(),
})

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

describe("GET /shift-swap-requests/me", () => {
  test("returns only the requester's own requests", async () => {
    const response = await request({
      path: "/shift/shift-swap-requests/me",
      token: await tokenFor(5),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(shiftSwapRequestResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0].requester_employee_id).toBe(toWorkforceEmployeeId(5))
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/shift/shift-swap-requests/me", token: null })

    expect(response.status).toBe(401)
  })
})

describe("GET /shift-swap-requests/:id", () => {
  test("the requester can read their own request", async () => {
    const response = await request({
      path: "/shift/shift-swap-requests/1",
      token: await tokenFor(5),
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
      path: "/shift/shift-swap-requests/1",
      token: await tokenFor(1),
    })

    expect(response.status).toBe(200)
  })

  test("returns 403 for a non-requester non-approver", async () => {
    const response = await request({
      path: "/shift/shift-swap-requests/1",
      token: await tokenFor(10),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown request", async () => {
    const response = await request({
      path: "/shift/shift-swap-requests/9999",
      token: await tokenFor(5),
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /shift-swap-requests/:id", () => {
  test("the requester cancels their pending request and returns 204", async () => {
    const response = await request({
      path: "/shift/shift-swap-requests/1",
      token: await tokenFor(5),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 403 when cancelling another person's request", async () => {
    const response = await request({
      path: "/shift/shift-swap-requests/1",
      token: await tokenFor(4),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 409 when cancelling an approved request", async () => {
    const response = await request({
      path: "/shift/shift-swap-requests/2",
      token: await tokenFor(4),
      method: "DELETE",
    })

    expect(response.status).toBe(409)
  })

  test("returns 404 for an unknown request", async () => {
    const response = await request({
      path: "/shift/shift-swap-requests/9999",
      token: await tokenFor(5),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/shift/shift-swap-requests/1",
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
