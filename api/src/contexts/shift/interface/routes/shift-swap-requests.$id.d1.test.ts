import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedShiftSwapRequests } from "@/contexts/shift/test/seed/seed-shift-swap-requests.test-support"
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
  pool = await startLocalD1Pool(11)
})

afterAll(async () => {
  await pool.dispose()
})

const jwtSecret = "shift-swap-request-crud-test-secret"

const shiftSwapRequestResponseSchema = z.object({
  id: z.string(),
  requester_employee_id: zEmployeeId,
  target_employee_id: zEmployeeId,
  date: z.string(),
  note: z.string().nullable(),
  status: z.string(),
  approved_at: z.string().nullable(),
})

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
      path: "/shift/shift-swap-requests/01900025-0000-7000-8000-000000000001",
      token: await tokenFor(5),
    })

    expect(response.status).toBe(200)

    const parsed = shiftSwapRequestResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe("01900025-0000-7000-8000-000000000001")
    }
  })

  test("an approver can read another person's request", async () => {
    const response = await request({
      path: "/shift/shift-swap-requests/01900025-0000-7000-8000-000000000001",
      token: await tokenFor(1),
    })

    expect(response.status).toBe(200)
  })

  test("returns 403 for a non-requester non-approver", async () => {
    const response = await request({
      path: "/shift/shift-swap-requests/01900025-0000-7000-8000-000000000001",
      token: await tokenFor(10),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown request", async () => {
    const response = await request({
      path: "/shift/shift-swap-requests/01900025-0000-7000-8000-00000000270f",
      token: await tokenFor(5),
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /shift-swap-requests/:id", () => {
  test("the requester cancels their pending request and returns 204", async () => {
    const response = await request({
      path: "/shift/shift-swap-requests/01900025-0000-7000-8000-000000000001",
      token: await tokenFor(5),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 403 when cancelling another person's request", async () => {
    const response = await request({
      path: "/shift/shift-swap-requests/01900025-0000-7000-8000-000000000001",
      token: await tokenFor(4),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 409 when cancelling an approved request", async () => {
    const response = await request({
      path: "/shift/shift-swap-requests/01900025-0000-7000-8000-000000000002",
      token: await tokenFor(4),
      method: "DELETE",
    })

    expect(response.status).toBe(409)
  })

  test("returns 404 for an unknown request", async () => {
    const response = await request({
      path: "/shift/shift-swap-requests/01900025-0000-7000-8000-00000000270f",
      token: await tokenFor(5),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/shift/shift-swap-requests/01900025-0000-7000-8000-000000000001",
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
