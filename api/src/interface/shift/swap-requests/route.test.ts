import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedShiftSwapRequests } from "@/infrastructure/seed/seed-shift-swap-requests"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

const jwtSecret = "shift-swap-requests-create-route-test-secret"

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

const pendingSwapRequestSchema = z.object({
  id: z.number(),
  requester_employee_code: z.string(),
  target_employee_code: z.string(),
  date: z.string(),
  note: z.string().nullable(),
  status: z.string(),
  approved_at: z.string().nullable(),
})

describe("GET /shift/swap-requests", () => {
  test("an approver gets only pending requests with employee codes", async () => {
    const response = await request({
      path: "/shift/swap-requests",
      token: await tokenFor(1, "admin"),
    })

    expect(response.status).toBe(200)

    const parsed = z.array(pendingSwapRequestSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data).toHaveLength(1)
      expect(parsed.data[0]?.id).toBe(1)
      expect(parsed.data[0]?.status).toBe("pending")
      expect(parsed.data[0]?.requester_employee_code).toBe("E005")
      expect(parsed.data[0]?.target_employee_code).toBe("E004")
      expect(parsed.data[0]?.note).toBe("Medical appointment")
    }
  })

  test("returns 403 for a non-approver role", async () => {
    const response = await request({
      path: "/shift/swap-requests",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/shift/swap-requests",
      token: null,
    })

    expect(response.status).toBe(401)
  })
})

describe("POST /shift/swap-requests", () => {
  test("any authenticated user files a swap request and returns 201", async () => {
    // 2026-06-10 はシードに pending が存在しないため新規作成できる
    const response = await request({
      path: "/shift/swap-requests",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { target_employee_code: "E004", date: "2026-06-10", note: "Medical appointment" },
    })

    expect(response.status).toBe(201)

    const parsed = shiftSwapRequestResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.requester_employee_id).toBe(5)
      expect(parsed.data.target_employee_id).toBe(4)
      expect(parsed.data.status).toBe("pending")
    }
  })

  test("returns 409 when a pending swap request already exists for the same requester, target, and date", async () => {
    // シード id=1 が requester=5, target=4, date=2026-06-01, status=pending で存在する
    const response = await request({
      path: "/shift/swap-requests",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { target_employee_code: "E004", date: "2026-06-01" },
    })

    expect(response.status).toBe(409)
  })

  test("returns 404 for an unknown target_employee_code", async () => {
    const response = await request({
      path: "/shift/swap-requests",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { target_employee_code: "E999", date: "2026-06-01" },
    })

    expect(response.status).toBe(404)
  })

  test("returns 400 when date is missing", async () => {
    const response = await request({
      path: "/shift/swap-requests",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { target_employee_code: "E004" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/shift/swap-requests",
      token: null,
      method: "POST",
      body: { target_employee_code: "E004", date: "2026-06-01" },
    })

    expect(response.status).toBe(401)
  })
})
