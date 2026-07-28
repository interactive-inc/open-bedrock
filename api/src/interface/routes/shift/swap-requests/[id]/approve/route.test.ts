import { describe, expect, test } from "bun:test"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/d1/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/d1/is-aborted-by-guard"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedShiftSwapRequests } from "@/infrastructure/seed/seed-shift-swap-requests"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
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

/** 割当なしの DB を作る（swap request は seeded だが shift_assignments は空）。 */
async function createTestDbWithoutAssignments(): Promise<D1Database> {
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

/** pattern_id が NULL の割当を持つ DB を作る（申請者・交代相手ともに pattern_id = NULL）。 */
async function createTestDbWithNullPatternIds(): Promise<D1Database> {
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

  // swap request id=1: requester=5, target=4, date="2026-06-01"
  // 両者とも pattern_id = NULL（シフト種別未設定の割当）
  await seedD1(db, "shift_assignments", [
    {
      id: 1,
      employee_id: 5,
      pattern_id: null,
      date: "2026-06-01",
      note: null,
      published_at: "2026-05-20T09:00:00Z",
    },
    {
      id: 2,
      employee_id: 4,
      pattern_id: null,
      date: "2026-06-01",
      note: null,
      published_at: "2026-05-20T09:00:00Z",
    },
  ])

  return db
}

/** requester の pattern_id が NULL、target の pattern_id が非 NULL の DB を作る。 */
async function createTestDbWithRequesterNullPatternId(): Promise<D1Database> {
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

  // requester (employee 5) は pattern_id = NULL、target (employee 4) は pattern_id = 2
  await seedD1(db, "shift_assignments", [
    {
      id: 1,
      employee_id: 5,
      pattern_id: null,
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

/** 片方の割当のみある DB を作る（requester の割当だけ）。 */
async function createTestDbWithPartialAssignment(): Promise<D1Database> {
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
      token: await tokenFor(1, "root"),
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
      token: await tokenFor(1, "root"),
      method: "POST",
      db,
    })

    const notifications = await db
      .prepare("SELECT recipient_employee_id, kind, source_domain FROM notifications")
      .all<{ recipient_employee_id: number; kind: string; source_domain: string }>()

    const results = notifications.results

    expect(results.length).toBe(2)

    const recipientIds = results.map((r) => r.recipient_employee_id).sort((a, b) => a - b)
    expect(recipientIds).toEqual([4, 5])

    for (const row of results) {
      expect(row.kind).toBe("approval_result")
      expect(row.source_domain).toBe("shift_swap_request")
    }
  })

  test("returns 409 when neither requester nor target has an assignment", async () => {
    const response = await request({
      path: "/shift/swap-requests/1/approve",
      token: await tokenFor(1, "root"),
      method: "POST",
      db: await createTestDbWithoutAssignments(),
    })

    expect(response.status).toBe(409)
  })

  test("returns 409 when only requester has an assignment (target missing)", async () => {
    const response = await request({
      path: "/shift/swap-requests/1/approve",
      token: await tokenFor(1, "root"),
      method: "POST",
      db: await createTestDbWithPartialAssignment(),
    })

    expect(response.status).toBe(409)
  })

  test("returns 409 when already approved", async () => {
    const response = await request({
      path: "/shift/swap-requests/2/approve",
      token: await tokenFor(1, "root"),
      method: "POST",
    })

    expect(response.status).toBe(409)
  })

  test("returns 404 for a missing swap request", async () => {
    const response = await request({
      path: "/shift/swap-requests/9999/approve",
      token: await tokenFor(1, "root"),
      method: "POST",
    })

    expect(response.status).toBe(404)
  })

  test("requester with manager role cannot self-approve (forbidden)", async () => {
    // swap request id=1 の申請者は employee 5。manager ロールでも当事者は承認できない。
    const response = await request({
      path: "/shift/swap-requests/1/approve",
      token: await tokenFor(5, "manager"),
      method: "POST",
    })

    expect(response.status).toBe(403)
  })

  test("target with manager role cannot self-approve (forbidden)", async () => {
    // swap request id=1 の交代相手は employee 4。manager ロールでも当事者は承認できない。
    const response = await request({
      path: "/shift/swap-requests/1/approve",
      token: await tokenFor(4, "manager"),
      method: "POST",
    })

    expect(response.status).toBe(403)
  })

  test("third-party manager can approve (not a party to the swap)", async () => {
    // swap request id=1 の当事者は employee 5 と 4。第三者 manager (employee 1) は従来どおり承認できる。
    const response = await request({
      path: "/shift/swap-requests/1/approve",
      token: await tokenFor(1, "manager"),
      method: "POST",
    })

    expect(response.status).toBe(200)
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

  // 同日多重交換の並行承認で lost update を防ぐ楽観ロックの検証。
  // 同一社員 (employee 5) が同日に 2 件の交換申請を持ち、1 件目が承認された直後に
  // 2 件目のバッチが「古い pattern_id」で UPDATE を発行するシナリオを再現する。
  // WHERE pattern_id = ?expectedOld が 0 行を返し、abortWhenPreviousStatementChangedNoRows
  // がバッチを中断することで、先の交換の効果が失われないことを確認する。
  test("rejects concurrent swap when assignment pattern_id was changed (lost update prevention)", async () => {
    const db = await createTestDb()

    // --- 1. 正規の承認で pattern_id を入れ替える ---
    const firstResponse = await request({
      path: "/shift/swap-requests/1/approve",
      token: await tokenFor(1, "root"),
      method: "POST",
      db,
    })

    expect(firstResponse.status).toBe(200)

    // 承認後: requester (id=1) は pattern 2、target (id=2) は pattern 1
    const afterFirst = await db
      .prepare("SELECT pattern_id FROM shift_assignments WHERE id = 1")
      .first<{ pattern_id: number }>()

    expect(afterFirst?.pattern_id).toBe(2)

    // --- 2. 並行承認を再現: 古い pattern_id (1) で UPDATE を試行する ---
    // 並行リーダーは承認前の pattern_id=1 を読み取っている。
    // この stale な値で UPDATE を発行すると WHERE 不一致で 0 行になり、ガードが発火する。
    const stalePatternId = 1

    let aborted = false

    try {
      await db.batch([
        db
          .prepare("UPDATE shift_assignments SET pattern_id = ?1 WHERE id = ?2 AND pattern_id = ?3")
          .bind(3, 1, stalePatternId),
        abortWhenPreviousStatementChangedNoRows(db),
      ])
    } catch (error) {
      aborted = isAbortedByGuard(error)
    }

    expect(aborted).toBe(true)

    // pattern_id が上書きされていないことを確認する（先の交換が保全されている）。
    const preserved = await db
      .prepare("SELECT pattern_id FROM shift_assignments WHERE id = 1")
      .first<{ pattern_id: number }>()

    expect(preserved?.pattern_id).toBe(2)
  })

  // pattern_id が NULL の割当に対する楽観ロックの NULL-safe 比較の検証。
  // SQLite では `NULL = NULL` が false になるため、`IS` 演算子を使わないと
  // pattern_id が NULL の割当への UPDATE が 0 行になり、409 が返ってしまう。
  test("approves swap when both requester and target have null pattern_id (returns 200)", async () => {
    const db = await createTestDbWithNullPatternIds()

    const response = await request({
      path: "/shift/swap-requests/1/approve",
      token: await tokenFor(1, "root"),
      method: "POST",
      db,
    })

    expect(response.status).toBe(200)

    const parsed = shiftSwapRequestResponseSchema.safeParse(await response.json())
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("approved")
    }

    // NULL どうしの交換後も両者の pattern_id は NULL のまま（交換結果として一貫している）。
    const requesterRow = await db
      .prepare("SELECT pattern_id FROM shift_assignments WHERE id = 1")
      .first<{ pattern_id: number | null }>()

    const targetRow = await db
      .prepare("SELECT pattern_id FROM shift_assignments WHERE id = 2")
      .first<{ pattern_id: number | null }>()

    expect(requesterRow?.pattern_id).toBeNull()
    expect(targetRow?.pattern_id).toBeNull()
  })

  test("approves swap when requester has null pattern_id and target has non-null pattern_id (returns 200)", async () => {
    const db = await createTestDbWithRequesterNullPatternId()

    const response = await request({
      path: "/shift/swap-requests/1/approve",
      token: await tokenFor(1, "root"),
      method: "POST",
      db,
    })

    expect(response.status).toBe(200)

    const parsed = shiftSwapRequestResponseSchema.safeParse(await response.json())
    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("approved")
    }

    // requester (id=1) は NULL → 2、target (id=2) は 2 → NULL になる。
    const requesterRow = await db
      .prepare("SELECT pattern_id FROM shift_assignments WHERE id = 1")
      .first<{ pattern_id: number | null }>()

    const targetRow = await db
      .prepare("SELECT pattern_id FROM shift_assignments WHERE id = 2")
      .first<{ pattern_id: number | null }>()

    expect(requesterRow?.pattern_id).toBe(2)
    expect(targetRow?.pattern_id).toBeNull()
  })
})
