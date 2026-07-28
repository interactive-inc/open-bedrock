import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedShiftPatterns } from "@/infrastructure/seed/seed-shift-patterns"
import { seedShiftSwapRequests } from "@/infrastructure/seed/seed-shift-swap-requests"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
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
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  await seedIamForEmployees(db)

  await seedD1(
    db,
    "shift_patterns",
    seedShiftPatterns.map((pattern) => ({
      id: pattern.id,
      code: pattern.code,
      name: pattern.name,
      start_time: pattern.startTime,
      end_time: pattern.endTime,
      break_minutes: pattern.breakMinutes,
    })),
  )

  // 交代申請の作成は双方が対象日に公開済み割当を持つ必要がある。
  // 2026-06-10: emp5・emp4 とも公開済み。2026-06-11: emp5 のみ公開済み（emp4 は割当なし）。
  await seedD1(db, "shift_assignments", [
    {
      id: 101,
      employee_id: 5,
      pattern_id: 1,
      date: "2026-06-10",
      note: null,
      published_at: "2026-05-20T09:00:00Z",
    },
    {
      id: 102,
      employee_id: 4,
      pattern_id: 2,
      date: "2026-06-10",
      note: null,
      published_at: "2026-05-20T09:00:00Z",
    },
    {
      id: 103,
      employee_id: 5,
      pattern_id: 1,
      date: "2026-06-11",
      note: null,
      published_at: "2026-05-20T09:00:00Z",
    },
  ])

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

describe("GET /shift-swap-requests", () => {
  test("an approver gets only pending requests with employee codes", async () => {
    const response = await request({
      path: "/shift-swap-requests",
      token: await tokenFor(1, "root"),
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(pendingSwapRequestSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data).toHaveLength(1)
      expect(parsed.data.data[0]?.id).toBe(1)
      expect(parsed.data.data[0]?.status).toBe("pending")
      expect(parsed.data.data[0]?.requester_employee_code).toBe("E005")
      expect(parsed.data.data[0]?.target_employee_code).toBe("E004")
      expect(parsed.data.data[0]?.note).toBe("Medical appointment")
    }
  })

  test("returns 403 for a non-approver role", async () => {
    const response = await request({
      path: "/shift-swap-requests",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/shift-swap-requests",
      token: null,
    })

    expect(response.status).toBe(401)
  })
})

describe("POST /shift-swap-requests", () => {
  test("any authenticated user files a swap request and returns 201", async () => {
    // 2026-06-10 はシードに pending が存在しないため新規作成できる
    const response = await request({
      path: "/shift-swap-requests",
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
      path: "/shift-swap-requests",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { target_employee_code: "E004", date: "2026-06-01" },
    })

    expect(response.status).toBe(409)
  })

  test("returns 409 when the target has no published assignment on the date", async () => {
    // 2026-06-11 は emp5（申請者）のみ公開済み割当を持ち、emp4（相手）は割当なし。
    // 承認時に必ず 409 になるため、作成時点で拒否する。
    const response = await request({
      path: "/shift-swap-requests",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { target_employee_code: "E004", date: "2026-06-11" },
    })

    expect(response.status).toBe(409)
  })

  test("returns 409 when the requester has no published assignment on the date", async () => {
    // 2026-06-20 はどちらも割当を持たない。申請者側の未割当で拒否される。
    const response = await request({
      path: "/shift-swap-requests",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { target_employee_code: "E004", date: "2026-06-20" },
    })

    expect(response.status).toBe(409)
  })

  test("returns 404 for an unknown target_employee_code", async () => {
    const response = await request({
      path: "/shift-swap-requests",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { target_employee_code: "E999", date: "2026-06-01" },
    })

    expect(response.status).toBe(404)
  })

  test("returns 400 when date is missing", async () => {
    const response = await request({
      path: "/shift-swap-requests",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { target_employee_code: "E004" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/shift-swap-requests",
      token: null,
      method: "POST",
      body: { target_employee_code: "E004", date: "2026-06-01" },
    })

    expect(response.status).toBe(401)
  })
})
