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

  // swap request id=1: requester=5, target=4, date="2026-06-01", pending
  // requester gets pattern 1 (Early), target gets pattern 2 (Late)
  await seedD1(db, "shift_assignments", [
    {
      id: 1,
      employee_id: 5,
      pattern_id: 1,
      date: "2026-06-01",
      note: null,
      published_at: "2026-05-20T09:00:00Z",
    },
    {
      id: 2,
      employee_id: 4,
      pattern_id: 2,
      date: "2026-06-01",
      note: null,
      published_at: "2026-05-20T09:00:00Z",
    },
  ])

  return db
}

// 割当なしの DB を作る（swap request は seeded だが shift_assignments は空）。
async function createTestDbWithoutAssignments(): Promise<D1Database> {
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

// 片方の割当のみある DB を作る（requester の割当だけ）。
async function createTestDbWithPartialAssignment(): Promise<D1Database> {
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

  // requester (employee 5) のみ割当あり
  await seedD1(db, "shift_assignments", [
    {
      id: 1,
      employee_id: 5,
      pattern_id: 1,
      date: "2026-06-01",
      note: null,
      published_at: "2026-05-20T09:00:00Z",
    },
  ])

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
  db?: D1Database
}

async function request(props: RequestProps): Promise<Response> {
  return requestWithContext({
    db: props.db ?? (await createTestDb()),
    jwtSecret,
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
  })
}

describe("POST /shift/swap-requests/:id/approve", () => {
  test("privileged role approves a pending swap request, swaps pattern_id, and returns 200", async () => {
    const db = await createTestDb()

    const response = await request({
      path: "/shift/swap-requests/1/approve",
      token: await tokenFor(1, "admin"),
      method: "POST",
      db,
    })

    expect(response.status).toBe(200)

    const parsed = shiftSwapRequestResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("approved")
      expect(parsed.data.approved_at).toBe(now)
    }

    // 両者の pattern_id が入れ替わっていることを確認する。
    // requester (employee 5) は元 pattern 1 → pattern 2 になる。
    // target (employee 4) は元 pattern 2 → pattern 1 になる。
    const requesterRow = await db
      .prepare("SELECT pattern_id FROM shift_assignments WHERE id = 1")
      .first<{ pattern_id: number }>()

    const targetRow = await db
      .prepare("SELECT pattern_id FROM shift_assignments WHERE id = 2")
      .first<{ pattern_id: number }>()

    expect(requesterRow?.pattern_id).toBe(2)
    expect(targetRow?.pattern_id).toBe(1)
  })

  test("creates notifications for both requester and target", async () => {
    const db = await createTestDb()

    await request({
      path: "/shift/swap-requests/1/approve",
      token: await tokenFor(1, "admin"),
      method: "POST",
      db,
    })

    const notifications = await db
      .prepare("SELECT recipient_employee_id, kind, source_domain FROM notifications")
      .all<{ recipient_employee_id: number; kind: string; source_domain: string }>()

    const results = notifications.results

    expect(results.length).toBe(2)

    const recipientIds = results.map((r) => r.recipient_employee_id).sort()
    expect(recipientIds).toEqual([4, 5])

    for (const row of results) {
      expect(row.kind).toBe("approval_result")
      expect(row.source_domain).toBe("shift_swap_request")
    }
  })

  test("returns 409 when neither requester nor target has an assignment", async () => {
    const response = await request({
      path: "/shift/swap-requests/1/approve",
      token: await tokenFor(1, "admin"),
      method: "POST",
      db: await createTestDbWithoutAssignments(),
    })

    expect(response.status).toBe(409)
  })

  test("returns 409 when only requester has an assignment (target missing)", async () => {
    const response = await request({
      path: "/shift/swap-requests/1/approve",
      token: await tokenFor(1, "admin"),
      method: "POST",
      db: await createTestDbWithPartialAssignment(),
    })

    expect(response.status).toBe(409)
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
