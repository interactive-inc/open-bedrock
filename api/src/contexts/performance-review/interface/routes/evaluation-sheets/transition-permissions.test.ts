import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company-compatibility/infrastructure/seed/seed-employees"
import { createTestToken } from "@/api/test/support/create-test-token"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createLifecycleRouteDb } from "@/api/test/support/lifecycle-route-fixture"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { verifyStandardCompanyMigration } from "@/api/test/support/verify-standard-company-migration"

const jwtSecret = "transition-permissions-test-secret"

/**
 * テスト構成:
 * - employee 5 (member): 被評価者 (owner)
 * - employee 4 (manager): 一次評価者 (primary evaluator) — evaluation:administer なし
 * - employee 6 (member): 二次評価者 (secondary evaluator) — evaluation:administer なし
 * - employee 1 (root): 管理者 (admin) — evaluation:administer あり
 */
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

  await seedD1(db, "org_memberships", [
    {
      employee_code: seedEmployees[4].code,
      department_code: "D003",
      manager_employee_code: seedEmployees[3].code,
    },
  ])

  await verifyStandardCompanyMigration(db)

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `e${employeeId}@example.com`,
  })
}

async function createSheetWithEvaluators(
  db: D1Database,
  opts?: { secondaryEvaluatorId?: number | null },
): Promise<{ id: number; revision: number }> {
  const token = await createTestToken(jwtSecret, {
    employeeId: 1,
    email: "admin@example.com",
  })

  const secondaryId = opts?.secondaryEvaluatorId !== undefined ? opts.secondaryEvaluatorId : 6

  const response = await requestWithContext({
    db,
    jwtSecret,
    path: "/evaluation-sheets",
    token,
    method: "POST",
    body: {
      employee_id: 5,
      period: "2026-H1",
      primary_evaluator_id: 4,
      ...(secondaryId !== null ? { secondary_evaluator_id: secondaryId } : {}),
    },
  })

  if (response.status !== 201) {
    throw new Error(`Failed to create sheet: ${response.status}`)
  }

  return (await response.json()) as { id: number; revision: number }
}

async function transition(
  db: D1Database,
  sheetId: number,
  targetStatus: string,
  expectedRevision: number,
  token: string,
): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path: `/evaluation-sheets/${sheetId}/transition`,
    token,
    method: "POST",
    body: {
      status: targetStatus,
      expected_revision: expectedRevision,
    },
  })
}

/** ヘルパー: シートを指定ステータスまで遷移させる */
async function advanceTo(
  db: D1Database,
  sheetId: number,
  revision: number,
  target: string,
): Promise<number> {
  const steps: Array<{ status: string; actor: number }> = []

  const path: Record<string, Array<{ status: string; actor: number }>> = {
    pending_approval: [{ status: "pending_approval", actor: 5 }],
    approved: [
      { status: "pending_approval", actor: 5 },
      { status: "approved", actor: 4 },
    ],
    self_eval: [
      { status: "pending_approval", actor: 5 },
      { status: "approved", actor: 4 },
      { status: "self_eval", actor: 5 },
    ],
    primary_eval: [
      { status: "pending_approval", actor: 5 },
      { status: "approved", actor: 4 },
      { status: "self_eval", actor: 5 },
      { status: "primary_eval", actor: 5 },
    ],
    secondary_eval: [
      { status: "pending_approval", actor: 5 },
      { status: "approved", actor: 4 },
      { status: "self_eval", actor: 5 },
      { status: "primary_eval", actor: 5 },
      { status: "secondary_eval", actor: 4 },
    ],
    finalized: [
      { status: "pending_approval", actor: 5 },
      { status: "approved", actor: 4 },
      { status: "self_eval", actor: 5 },
      { status: "primary_eval", actor: 5 },
      { status: "secondary_eval", actor: 4 },
      { status: "finalized", actor: 6 },
    ],
  }

  steps.push(...(path[target] ?? []))

  let rev = revision

  for (const step of steps) {
    const tk = await tokenFor(step.actor)
    const res = await transition(db, sheetId, step.status, rev, tk)

    if (res.status !== 200) {
      const body = await res.text()
      throw new Error(`advanceTo failed at ${step.status}: ${res.status} ${body}`)
    }

    const json = (await res.json()) as { revision: number }
    rev = json.revision
  }

  return rev
}

/** ヘルパー: シートに weight 合計 100% の目標をセットする（submit に必須） */
async function seedGoals(
  db: D1Database,
  sheetId: number,
  weights: number[] = [100],
): Promise<void> {
  const ownerTk = await tokenFor(5)

  for (const [index, weight] of weights.entries()) {
    const res = await requestWithContext({
      db,
      jwtSecret,
      path: "/performance-goals",
      token: ownerTk,
      method: "POST",
      body: {
        period: "2026-H1",
        title: `Goal ${index + 1}`,
        weight,
        evaluation_sheet_id: sheetId,
      },
    })

    if (res.status !== 201) {
      const body = await res.text()
      throw new Error(`seedGoals failed at index ${index}: ${res.status} ${body}`)
    }
  }
}

/**
 * advanceTo の submit ステップ前に goals を seed する拡張ヘルパー。
 * draft → pending_approval のときだけ goals が必要なので、
 * advanceTo を分割して submit 前に seedGoals を差し込む。
 */
async function advanceToWithGoals(
  db: D1Database,
  sheetId: number,
  revision: number,
  target: string,
): Promise<number> {
  // goals を seed してから submit → target まで進める
  await seedGoals(db, sheetId, [60, 40])

  return advanceTo(db, sheetId, revision, target)
}

// ---------------------------------------------------------------------------
// currentStatus × targetStatus × role マトリクス
// ---------------------------------------------------------------------------
describe("transition permissions matrix", () => {
  // draft → pending_approval: owner only (with goals)
  test("owner can submit (draft → pending_approval)", async () => {
    const db = await createTestDb()
    const sheet = await createSheetWithEvaluators(db)
    await seedGoals(db, sheet.id, [60, 40])
    const res = await transition(
      db,
      sheet.id,
      "pending_approval",
      sheet.revision,
      await tokenFor(5),
    )
    expect(res.status).toBe(200)
  })

  test("admin cannot submit on behalf of owner (draft → pending_approval)", async () => {
    const db = await createTestDb()
    const sheet = await createSheetWithEvaluators(db)
    await seedGoals(db, sheet.id, [100])
    const res = await transition(
      db,
      sheet.id,
      "pending_approval",
      sheet.revision,
      await tokenFor(1),
    )
    expect(res.status).toBe(403)
  })

  test("primary evaluator cannot submit (draft → pending_approval)", async () => {
    const db = await createTestDb()
    const sheet = await createSheetWithEvaluators(db)
    await seedGoals(db, sheet.id, [100])
    const res = await transition(
      db,
      sheet.id,
      "pending_approval",
      sheet.revision,
      await tokenFor(4),
    )
    expect(res.status).toBe(403)
  })

  // pending_approval → approved: primary evaluator only
  test("primary evaluator can approve (pending_approval → approved)", async () => {
    const db = await createTestDb()
    const sheet = await createSheetWithEvaluators(db)
    const rev = await advanceToWithGoals(db, sheet.id, sheet.revision, "pending_approval")
    const res = await transition(db, sheet.id, "approved", rev, await tokenFor(4))
    expect(res.status).toBe(200)
  })

  test("admin (non-evaluator) cannot approve (pending_approval → approved)", async () => {
    const db = await createTestDb()
    const sheet = await createSheetWithEvaluators(db)
    const rev = await advanceToWithGoals(db, sheet.id, sheet.revision, "pending_approval")
    const res = await transition(db, sheet.id, "approved", rev, await tokenFor(1))
    expect(res.status).toBe(403)
  })

  test("owner cannot approve their own sheet", async () => {
    const db = await createTestDb()
    const sheet = await createSheetWithEvaluators(db)
    const rev = await advanceToWithGoals(db, sheet.id, sheet.revision, "pending_approval")
    const res = await transition(db, sheet.id, "approved", rev, await tokenFor(5))
    expect(res.status).toBe(403)
  })

  // pending_approval → rejected: primary evaluator only
  test("primary evaluator can reject (pending_approval → rejected)", async () => {
    const db = await createTestDb()
    const sheet = await createSheetWithEvaluators(db)
    const rev = await advanceToWithGoals(db, sheet.id, sheet.revision, "pending_approval")
    const res = await transition(db, sheet.id, "rejected", rev, await tokenFor(4))
    expect(res.status).toBe(200)
  })

  // approved → self_eval: owner only
  test("owner can start self-eval (approved → self_eval)", async () => {
    const db = await createTestDb()
    const sheet = await createSheetWithEvaluators(db)
    const rev = await advanceToWithGoals(db, sheet.id, sheet.revision, "approved")
    const res = await transition(db, sheet.id, "self_eval", rev, await tokenFor(5))
    expect(res.status).toBe(200)
  })

  test("admin cannot start self-eval on behalf of owner (approved → self_eval)", async () => {
    const db = await createTestDb()
    const sheet = await createSheetWithEvaluators(db)
    const rev = await advanceToWithGoals(db, sheet.id, sheet.revision, "approved")
    const res = await transition(db, sheet.id, "self_eval", rev, await tokenFor(1))
    expect(res.status).toBe(403)
  })

  // self_eval → primary_eval: owner only
  test("owner can complete self-eval (self_eval → primary_eval)", async () => {
    const db = await createTestDb()
    const sheet = await createSheetWithEvaluators(db)
    const rev = await advanceToWithGoals(db, sheet.id, sheet.revision, "self_eval")
    const res = await transition(db, sheet.id, "primary_eval", rev, await tokenFor(5))
    expect(res.status).toBe(200)
  })

  // primary_eval → secondary_eval: primary evaluator
  test("primary evaluator can forward to secondary (primary_eval → secondary_eval)", async () => {
    const db = await createTestDb()
    const sheet = await createSheetWithEvaluators(db)
    const rev = await advanceToWithGoals(db, sheet.id, sheet.revision, "primary_eval")
    const res = await transition(db, sheet.id, "secondary_eval", rev, await tokenFor(4))
    expect(res.status).toBe(200)
  })

  // primary_eval → finalized: primary evaluator or admin only when no secondary
  test("primary evaluator can finalize when no secondary (primary_eval → finalized)", async () => {
    const db = await createTestDb()
    const sheet = await createSheetWithEvaluators(db, {
      secondaryEvaluatorId: null,
    })
    const rev = await advanceToWithGoals(db, sheet.id, sheet.revision, "primary_eval")
    const res = await transition(db, sheet.id, "finalized", rev, await tokenFor(4))
    expect(res.status).toBe(200)
  })

  test("admin can finalize when no secondary (primary_eval → finalized)", async () => {
    const db = await createTestDb()
    const sheet = await createSheetWithEvaluators(db, {
      secondaryEvaluatorId: null,
    })
    const rev = await advanceToWithGoals(db, sheet.id, sheet.revision, "primary_eval")
    const res = await transition(db, sheet.id, "finalized", rev, await tokenFor(1))
    expect(res.status).toBe(200)
  })

  test("primary evaluator cannot finalize when secondary exists (primary_eval → finalized)", async () => {
    const db = await createTestDb()
    const sheet = await createSheetWithEvaluators(db)
    const rev = await advanceToWithGoals(db, sheet.id, sheet.revision, "primary_eval")
    const res = await transition(db, sheet.id, "finalized", rev, await tokenFor(4))
    // Entity rejects this transition (primary_eval→finalized requires secondary_eval first when secondary exists)
    // Route should return 403 or entity should return 409
    expect([403, 409]).toContain(res.status)
  })

  // secondary_eval → finalized: secondary evaluator or admin
  test("secondary evaluator can finalize (secondary_eval → finalized)", async () => {
    const db = await createTestDb()
    const sheet = await createSheetWithEvaluators(db)
    const rev = await advanceToWithGoals(db, sheet.id, sheet.revision, "secondary_eval")
    const res = await transition(db, sheet.id, "finalized", rev, await tokenFor(6))
    expect(res.status).toBe(200)
  })

  test("admin can finalize (secondary_eval → finalized)", async () => {
    const db = await createTestDb()
    const sheet = await createSheetWithEvaluators(db)
    const rev = await advanceToWithGoals(db, sheet.id, sheet.revision, "secondary_eval")
    const res = await transition(db, sheet.id, "finalized", rev, await tokenFor(1))
    expect(res.status).toBe(200)
  })

  // finalized → reopened/archived: admin only
  test("admin can reopen (finalized → reopened)", async () => {
    const db = await createTestDb()
    const sheet = await createSheetWithEvaluators(db)
    const rev = await advanceToWithGoals(db, sheet.id, sheet.revision, "finalized")
    const res = await transition(db, sheet.id, "reopened", rev, await tokenFor(1))
    expect(res.status).toBe(200)
  })

  test("non-admin cannot reopen (finalized → reopened)", async () => {
    const db = await createTestDb()
    const sheet = await createSheetWithEvaluators(db)
    const rev = await advanceToWithGoals(db, sheet.id, sheet.revision, "finalized")
    const res = await transition(db, sheet.id, "reopened", rev, await tokenFor(5))
    expect(res.status).toBe(403)
  })

  test("admin can archive (finalized → archived)", async () => {
    const db = await createTestDb()
    const sheet = await createSheetWithEvaluators(db)
    const rev = await advanceToWithGoals(db, sheet.id, sheet.revision, "finalized")
    const res = await transition(db, sheet.id, "archived", rev, await tokenFor(1))
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// submit weight 検証
// ---------------------------------------------------------------------------
describe("submit weight validation", () => {
  test("rejects submit when no goals exist", async () => {
    const db = await createTestDb()
    const sheet = await createSheetWithEvaluators(db)

    // No goals seeded — submit should fail
    const res = await transition(
      db,
      sheet.id,
      "pending_approval",
      sheet.revision,
      await tokenFor(5),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe("no_goals")
  })

  test("rejects submit when total weight is not 100%", async () => {
    const db = await createTestDb()
    const sheet = await createSheetWithEvaluators(db)

    // Seed goals totaling 80%
    await seedGoals(db, sheet.id, [50, 30])

    const res = await transition(
      db,
      sheet.id,
      "pending_approval",
      sheet.revision,
      await tokenFor(5),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe("weight_not_100")
  })

  test("allows submit when total weight is exactly 100%", async () => {
    const db = await createTestDb()
    const sheet = await createSheetWithEvaluators(db)

    await seedGoals(db, sheet.id, [40, 35, 25])

    const res = await transition(
      db,
      sheet.id,
      "pending_approval",
      sheet.revision,
      await tokenFor(5),
    )
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// createWithAuditLog readback: ID の正当性
// ---------------------------------------------------------------------------
describe("createWithAuditLog readback", () => {
  test("returned id can be used to GET the same sheet", async () => {
    const db = await createTestDb()
    const adminTk = await tokenFor(1)

    const createRes = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets",
      token: adminTk,
      method: "POST",
      body: {
        employee_id: 5,
        period: "2026-H1",
        primary_evaluator_id: 4,
      },
    })

    expect(createRes.status).toBe(201)

    const created = (await createRes.json()) as {
      id: number
      employee_id: number
    }

    expect(created.id).toBeGreaterThan(0)
    expect(created.employee_id).toBe(5)

    // GET with the returned ID
    const getRes = await requestWithContext({
      db,
      jwtSecret,
      path: `/evaluation-sheets/${created.id}`,
      token: adminTk,
      method: "GET",
    })

    expect(getRes.status).toBe(200)

    const fetched = (await getRes.json()) as {
      id: number
      employee_id: number
    }

    expect(fetched.id).toBe(created.id)
    expect(fetched.employee_id).toBe(5)
  })

  test("readback id is correct when extra audit row diverges counters", async () => {
    const db = await createTestDb()
    const adminTk = await tokenFor(1)

    // シート 1 作成（sheet_id=1, audit_id=1）
    const res1 = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets",
      token: adminTk,
      method: "POST",
      body: {
        employee_id: 4,
        period: "2026-H1",
        primary_evaluator_id: 5,
      },
    })
    expect(res1.status).toBe(201)
    const sheet1 = (await res1.json()) as { id: number }

    // 手動で audit ログを挿入して ID カウンタを意図的にずらす
    // これにより audit_logs の次の ID は 3 になり、sheet の次の ID は 2 のまま
    await db
      .prepare(
        `INSERT INTO evaluation_sheet_audit_logs
           (sheet_id, actor_id, action, from_value, to_value, note, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      )
      .bind(sheet1.id, 1, "manual_diverge", null, null, null, "2026-01-01T00:00:00.000Z")
      .run()

    // シート 2 作成 — sheet_id=2, audit_id=3 になるはず
    const res2 = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets",
      token: adminTk,
      method: "POST",
      body: {
        employee_id: 5,
        period: "2026-H1",
        primary_evaluator_id: 4,
      },
    })
    expect(res2.status).toBe(201)
    const sheet2 = (await res2.json()) as { id: number }

    // sheet ID と audit log ID は異なるカウンタ。
    // readback が audit_id (3) ではなく正しい sheet_id (2) を返すことを確認。
    expect(sheet2.id).toBe(sheet1.id + 1)

    const getRes = await requestWithContext({
      db,
      jwtSecret,
      path: `/evaluation-sheets/${sheet2.id}`,
      token: adminTk,
      method: "GET",
    })

    expect(getRes.status).toBe(200)
    const fetched = (await getRes.json()) as { id: number; employee_id: number }
    expect(fetched.id).toBe(sheet2.id)
    expect(fetched.employee_id).toBe(5)
  })

  test("createWithAuditLog rolls back sheet when audit insert fails (trigger)", async () => {
    const db = await createTestDb()

    // audit INSERT を失敗させる BEFORE INSERT トリガーを設置
    await db.exec(`
      CREATE TRIGGER fail_audit BEFORE INSERT ON evaluation_sheet_audit_logs
      BEGIN
        SELECT RAISE(ABORT, 'deliberate audit failure');
      END;
    `)

    const beforeCount = await db
      .prepare("SELECT COUNT(*) AS c FROM evaluation_sheets")
      .first<{ c: number }>()

    // 実際の API エンドポイント経由で createWithAuditLog を実行
    const adminTk = await tokenFor(1)
    const res = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets",
      token: adminTk,
      method: "POST",
      body: {
        employee_id: 5,
        period: "2026-ROLLBACK",
        primary_evaluator_id: 4,
      },
    })

    // batch 全体がロールバックし、500 で返る
    expect(res.status).toBe(500)

    const afterCount = await db
      .prepare("SELECT COUNT(*) AS c FROM evaluation_sheets")
      .first<{ c: number }>()

    // シートも挿入されていないことを確認（batch ロールバック）
    expect(afterCount?.c).toBe(beforeCount?.c ?? 0)

    // トリガーを削除して後続テストに影響しないようにする
    await db.exec("DROP TRIGGER fail_audit")
  })
})

// ---------------------------------------------------------------------------
// weight sum 検証
// ---------------------------------------------------------------------------
describe("weight sum validation", () => {
  test("rejects goal when total weight would exceed 100%", async () => {
    const db = await createTestDb()
    const adminTk = await tokenFor(1)

    // Create sheet
    const sheetRes = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets",
      token: adminTk,
      method: "POST",
      body: {
        employee_id: 5,
        period: "2026-H1",
        primary_evaluator_id: 4,
      },
    })

    const sheet = (await sheetRes.json()) as { id: number }
    const ownerTk = await tokenFor(5)

    // Create first goal at 60%
    const goal1Res = await requestWithContext({
      db,
      jwtSecret,
      path: "/performance-goals",
      token: ownerTk,
      method: "POST",
      body: {
        period: "2026-H1",
        title: "Goal 1",
        weight: 60,
        evaluation_sheet_id: sheet.id,
      },
    })

    expect(goal1Res.status).toBe(201)

    // Create second goal at 50% — should fail (60 + 50 > 100)
    const goal2Res = await requestWithContext({
      db,
      jwtSecret,
      path: "/performance-goals",
      token: ownerTk,
      method: "POST",
      body: {
        period: "2026-H1",
        title: "Goal 2",
        weight: 50,
        evaluation_sheet_id: sheet.id,
      },
    })

    expect(goal2Res.status).toBe(400)

    const body = (await goal2Res.json()) as { code: string }

    expect(body.code).toBe("weight_exceeded")
  })

  test("allows goals totaling exactly 100%", async () => {
    const db = await createTestDb()
    const adminTk = await tokenFor(1)

    const sheetRes = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets",
      token: adminTk,
      method: "POST",
      body: {
        employee_id: 5,
        period: "2026-H1",
        primary_evaluator_id: 4,
      },
    })

    const sheet = (await sheetRes.json()) as { id: number }
    const ownerTk = await tokenFor(5)

    const goal1Res = await requestWithContext({
      db,
      jwtSecret,
      path: "/performance-goals",
      token: ownerTk,
      method: "POST",
      body: {
        period: "2026-H1",
        title: "Goal 1",
        weight: 60,
        evaluation_sheet_id: sheet.id,
      },
    })

    expect(goal1Res.status).toBe(201)

    const goal2Res = await requestWithContext({
      db,
      jwtSecret,
      path: "/performance-goals",
      token: ownerTk,
      method: "POST",
      body: {
        period: "2026-H1",
        title: "Goal 2",
        weight: 40,
        evaluation_sheet_id: sheet.id,
      },
    })

    expect(goal2Res.status).toBe(201)
  })

  test("update: rejects when updated weight would exceed 100%", async () => {
    const db = await createTestDb()
    const adminTk = await tokenFor(1)

    const sheetRes = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets",
      token: adminTk,
      method: "POST",
      body: {
        employee_id: 5,
        period: "2026-H1",
        primary_evaluator_id: 4,
      },
    })

    const sheet = (await sheetRes.json()) as { id: number }
    const ownerTk = await tokenFor(5)

    // Create two goals: 60 + 30 = 90
    const goal1Res = await requestWithContext({
      db,
      jwtSecret,
      path: "/performance-goals",
      token: ownerTk,
      method: "POST",
      body: {
        period: "2026-H1",
        title: "Goal 1",
        weight: 60,
        evaluation_sheet_id: sheet.id,
      },
    })
    expect(goal1Res.status).toBe(201)

    const goal2Res = await requestWithContext({
      db,
      jwtSecret,
      path: "/performance-goals",
      token: ownerTk,
      method: "POST",
      body: {
        period: "2026-H1",
        title: "Goal 2",
        weight: 30,
        evaluation_sheet_id: sheet.id,
      },
    })
    expect(goal2Res.status).toBe(201)
    const goal2 = (await goal2Res.json()) as { id: number }

    // Update goal2 weight: 60 + 50 = 110 > 100 → should fail
    const updateRes = await requestWithContext({
      db,
      jwtSecret,
      path: `/performance-goals/${goal2.id}`,
      token: ownerTk,
      method: "PUT",
      body: {
        period: "2026-H1",
        title: "Goal 2 updated",
        weight: 50,
      },
    })

    // 409 (atomic guard ConflictError) or 400 (pre-validation)
    expect([400, 409]).toContain(updateRes.status)
  })

  test("update: allows when updated weight keeps total within 100%", async () => {
    const db = await createTestDb()
    const adminTk = await tokenFor(1)

    const sheetRes = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets",
      token: adminTk,
      method: "POST",
      body: {
        employee_id: 5,
        period: "2026-H1",
        primary_evaluator_id: 4,
      },
    })

    const sheet = (await sheetRes.json()) as { id: number }
    const ownerTk = await tokenFor(5)

    const goal1Res = await requestWithContext({
      db,
      jwtSecret,
      path: "/performance-goals",
      token: ownerTk,
      method: "POST",
      body: {
        period: "2026-H1",
        title: "Goal 1",
        weight: 60,
        evaluation_sheet_id: sheet.id,
      },
    })
    expect(goal1Res.status).toBe(201)

    const goal2Res = await requestWithContext({
      db,
      jwtSecret,
      path: "/performance-goals",
      token: ownerTk,
      method: "POST",
      body: {
        period: "2026-H1",
        title: "Goal 2",
        weight: 30,
        evaluation_sheet_id: sheet.id,
      },
    })
    expect(goal2Res.status).toBe(201)
    const goal2 = (await goal2Res.json()) as { id: number }

    // Update goal2: 60 + 40 = 100 → OK
    const updateRes = await requestWithContext({
      db,
      jwtSecret,
      path: `/performance-goals/${goal2.id}`,
      token: ownerTk,
      method: "PUT",
      body: {
        period: "2026-H1",
        title: "Goal 2 updated",
        weight: 40,
      },
    })

    expect(updateRes.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// sheet status guard for goal mutations
// ---------------------------------------------------------------------------
describe("sheet status guard for goals", () => {
  test("rejects goal creation when sheet is not in draft/rejected", async () => {
    const db = await createTestDb()
    const adminTk = await tokenFor(1)

    // Create sheet and advance to pending_approval
    const sheetRes = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets",
      token: adminTk,
      method: "POST",
      body: {
        employee_id: 5,
        period: "2026-H1",
        primary_evaluator_id: 4,
      },
    })

    const sheet = (await sheetRes.json()) as { id: number; revision: number }
    const ownerTk = await tokenFor(5)

    // Seed goals and submit
    await seedGoals(db, sheet.id, [60, 40])
    const submitRes = await transition(db, sheet.id, "pending_approval", sheet.revision, ownerTk)

    expect(submitRes.status).toBe(200)

    // Try to create a goal on a pending_approval sheet — should fail
    const goalRes = await requestWithContext({
      db,
      jwtSecret,
      path: "/performance-goals",
      token: ownerTk,
      method: "POST",
      body: {
        period: "2026-H1",
        title: "Late goal",
        weight: 10,
        evaluation_sheet_id: sheet.id,
      },
    })

    expect(goalRes.status).toBe(400)

    const body = (await goalRes.json()) as { code: string }

    expect(body.code).toBe("sheet_not_editable")
  })

  test("allows goal deletion when sheet is rejected (back to editable)", async () => {
    const db = await createTestDb()
    const adminTk = await tokenFor(1)

    const sheetRes = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets",
      token: adminTk,
      method: "POST",
      body: {
        employee_id: 5,
        period: "2026-H1",
        primary_evaluator_id: 4,
      },
    })

    const sheet = (await sheetRes.json()) as { id: number; revision: number }
    const ownerTk = await tokenFor(5)

    // Seed goals and submit → pending_approval
    await seedGoals(db, sheet.id, [60, 40])
    const submitRes = await transition(db, sheet.id, "pending_approval", sheet.revision, ownerTk)
    const submitted = (await submitRes.json()) as { revision: number }

    // Reject → rejected
    const evaluatorTk = await tokenFor(4)
    const rejectRes = await transition(db, sheet.id, "rejected", submitted.revision, evaluatorTk)

    expect(rejectRes.status).toBe(200)

    // List goals to get an ID for deletion
    const goalsRes = await requestWithContext({
      db,
      jwtSecret,
      path: "/performance-goals?period=2026-H1&employee_id=5",
      token: ownerTk,
      method: "GET",
    })
    const goalsList = (await goalsRes.json()) as { data: Array<{ id: number }> }
    expect(goalsList.data.length).toBeGreaterThan(0)

    // Delete a goal on rejected sheet — should succeed (204)
    const deleteRes = await requestWithContext({
      db,
      jwtSecret,
      path: `/performance-goals/${goalsList.data[0].id}`,
      token: ownerTk,
      method: "DELETE",
    })

    expect(deleteRes.status).toBe(204)
  })
})

// ---------------------------------------------------------------------------
// linked-goal audit logs
// ---------------------------------------------------------------------------
describe("linked-goal audit logs", () => {
  test("goal create writes goal_add audit log with full snapshot", async () => {
    const db = await createTestDb()
    const adminTk = await tokenFor(1)

    const sheetRes = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets",
      token: adminTk,
      method: "POST",
      body: {
        employee_id: 5,
        period: "2026-H1",
        primary_evaluator_id: 4,
      },
    })
    const sheet = (await sheetRes.json()) as { id: number }

    const ownerTk = await tokenFor(5)
    const goalRes = await requestWithContext({
      db,
      jwtSecret,
      path: "/performance-goals",
      token: ownerTk,
      method: "POST",
      body: {
        period: "2026-H1",
        title: "Audit Goal",
        weight: 50,
        evaluation_sheet_id: sheet.id,
      },
    })
    expect(goalRes.status).toBe(201)
    const goal = (await goalRes.json()) as { id: number }

    // 監査ログに goal_add が記録されていることを確認
    const auditRows = await db
      .prepare(
        "SELECT action, to_value FROM evaluation_sheet_audit_logs WHERE sheet_id = ?1 AND action = 'goal_add'",
      )
      .bind(sheet.id)
      .all<{ action: string; to_value: string }>()

    expect(auditRows.results.length).toBe(1)
    expect(auditRows.results[0].action).toBe("goal_add")

    const toValue = JSON.parse(auditRows.results[0].to_value)
    expect(toValue.goal_id).toBe(goal.id)
    expect(toValue.title).toBe("Audit Goal")
    expect(toValue.weight).toBe(50)
    expect(toValue.period).toBe("2026-H1")
    expect(toValue.kpi).toBeNull()
  })

  test("goal update writes goal_update audit log with full snapshot", async () => {
    const db = await createTestDb()
    const adminTk = await tokenFor(1)

    const sheetRes = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets",
      token: adminTk,
      method: "POST",
      body: {
        employee_id: 5,
        period: "2026-H1",
        primary_evaluator_id: 4,
      },
    })
    const sheet = (await sheetRes.json()) as { id: number }

    const ownerTk = await tokenFor(5)
    const goalRes = await requestWithContext({
      db,
      jwtSecret,
      path: "/performance-goals",
      token: ownerTk,
      method: "POST",
      body: {
        period: "2026-H1",
        title: "Original",
        weight: 50,
        kpi: "Revenue > 1M",
        evaluation_sheet_id: sheet.id,
      },
    })
    expect(goalRes.status).toBe(201)
    const goal = (await goalRes.json()) as { id: number }

    // Update the goal
    const updateRes = await requestWithContext({
      db,
      jwtSecret,
      path: `/performance-goals/${goal.id}`,
      token: ownerTk,
      method: "PUT",
      body: {
        period: "2026-H1",
        title: "Updated",
        weight: 60,
        kpi: "Revenue > 2M",
      },
    })
    expect(updateRes.status).toBe(200)

    // 監査ログに goal_update が記録されていることを確認
    const auditRows = await db
      .prepare(
        "SELECT action, from_value, to_value FROM evaluation_sheet_audit_logs WHERE sheet_id = ?1 AND action = 'goal_update'",
      )
      .bind(sheet.id)
      .all<{ action: string; from_value: string; to_value: string }>()

    expect(auditRows.results.length).toBe(1)

    const fromValue = JSON.parse(auditRows.results[0].from_value)
    expect(fromValue.goal_id).toBe(goal.id)
    expect(fromValue.title).toBe("Original")
    expect(fromValue.weight).toBe(50)
    expect(fromValue.period).toBe("2026-H1")
    expect(fromValue.kpi).toBe("Revenue > 1M")

    const toValue = JSON.parse(auditRows.results[0].to_value)
    expect(toValue.goal_id).toBe(goal.id)
    expect(toValue.title).toBe("Updated")
    expect(toValue.weight).toBe(60)
    expect(toValue.period).toBe("2026-H1")
    expect(toValue.kpi).toBe("Revenue > 2M")
  })

  test("goal delete writes goal_delete audit log with full snapshot", async () => {
    const db = await createTestDb()
    const adminTk = await tokenFor(1)

    const sheetRes = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets",
      token: adminTk,
      method: "POST",
      body: {
        employee_id: 5,
        period: "2026-H1",
        primary_evaluator_id: 4,
      },
    })
    const sheet = (await sheetRes.json()) as { id: number }

    const ownerTk = await tokenFor(5)
    const goalRes = await requestWithContext({
      db,
      jwtSecret,
      path: "/performance-goals",
      token: ownerTk,
      method: "POST",
      body: {
        period: "2026-H1",
        title: "To Delete",
        weight: 30,
        kpi: "NPS > 50",
        evaluation_sheet_id: sheet.id,
      },
    })
    expect(goalRes.status).toBe(201)
    const goal = (await goalRes.json()) as { id: number }

    // Delete the goal
    const deleteRes = await requestWithContext({
      db,
      jwtSecret,
      path: `/performance-goals/${goal.id}`,
      token: ownerTk,
      method: "DELETE",
    })
    expect(deleteRes.status).toBe(204)

    // 監査ログに goal_delete が記録されていることを確認
    const auditRows = await db
      .prepare(
        "SELECT action, from_value FROM evaluation_sheet_audit_logs WHERE sheet_id = ?1 AND action = 'goal_delete'",
      )
      .bind(sheet.id)
      .all<{ action: string; from_value: string }>()

    expect(auditRows.results.length).toBe(1)

    const fromValue = JSON.parse(auditRows.results[0].from_value)
    expect(fromValue.goal_id).toBe(goal.id)
    expect(fromValue.title).toBe("To Delete")
    expect(fromValue.weight).toBe(30)
    expect(fromValue.period).toBe("2026-H1")
    expect(fromValue.kpi).toBe("NPS > 50")
  })
})

// ---------------------------------------------------------------------------
// atomic operations: submit & delete with sheet status guard
// ---------------------------------------------------------------------------
describe("atomic operations with sheet status guard", () => {
  test("delete is rejected atomically when sheet is submitted concurrently", async () => {
    const db = await createTestDb()
    const adminTk = await tokenFor(1)

    // Create sheet with goals
    const sheetRes = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets",
      token: adminTk,
      method: "POST",
      body: {
        employee_id: 5,
        period: "2026-H1",
        primary_evaluator_id: 4,
      },
    })
    const sheet = (await sheetRes.json()) as { id: number; revision: number }

    const ownerTk = await tokenFor(5)

    // Create 2 goals: 60 + 40 = 100
    await seedGoals(db, sheet.id, [60, 40])

    // List goals to get IDs
    const goalsRes = await requestWithContext({
      db,
      jwtSecret,
      path: "/performance-goals?period=2026-H1&employee_id=5",
      token: ownerTk,
      method: "GET",
    })
    const goalsList = (await goalsRes.json()) as { data: Array<{ id: number }> }
    const goalId = goalsList.data[0].id

    // Simulate race: submit the sheet directly via SQL (bypassing pre-validation)
    await db
      .prepare(
        "UPDATE evaluation_sheets SET status = 'pending_approval', revision = revision + 1 WHERE id = ?1",
      )
      .bind(sheet.id)
      .run()

    // Try to delete goal — should fail because sheet is now pending_approval
    const deleteRes = await requestWithContext({
      db,
      jwtSecret,
      path: `/performance-goals/${goalId}`,
      token: ownerTk,
      method: "DELETE",
    })

    // 409 (atomic guard catches the concurrent submit)
    expect(deleteRes.status).toBe(409)
  })

  test("submit fails when concurrent goal deletion drops weight below 100", async () => {
    const db = await createTestDb()
    const adminTk = await tokenFor(1)

    const sheetRes = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets",
      token: adminTk,
      method: "POST",
      body: {
        employee_id: 5,
        period: "2026-H1",
        primary_evaluator_id: 4,
      },
    })
    const sheet = (await sheetRes.json()) as { id: number; revision: number }

    const ownerTk = await tokenFor(5)

    // Create 2 goals: 60 + 40 = 100
    await seedGoals(db, sheet.id, [60, 40])

    // Simulate concurrent delete: remove the 40-weight goal directly via SQL
    await db
      .prepare("DELETE FROM performance_goals WHERE evaluation_sheet_id = ?1 AND weight = 40")
      .bind(sheet.id)
      .run()

    // Try to submit — weight is only 60, atomic guard should catch it
    const submitRes = await transition(db, sheet.id, "pending_approval", sheet.revision, ownerTk)

    // 400 (pre-validation weight_not_100) or 409 (atomic guard)
    expect([400, 409]).toContain(submitRes.status)
  })

  test("submit fails via API after goal deletion via API (non-concurrent)", async () => {
    const db = await createTestDb()
    const adminTk = await tokenFor(1)

    const sheetRes = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets",
      token: adminTk,
      method: "POST",
      body: {
        employee_id: 5,
        period: "2026-H1",
        primary_evaluator_id: 4,
      },
    })
    const sheet = (await sheetRes.json()) as { id: number; revision: number }
    const ownerTk = await tokenFor(5)

    // Create 2 goals: 60 + 40 = 100
    await seedGoals(db, sheet.id, [60, 40])

    // List goals to get IDs
    const goalsRes = await requestWithContext({
      db,
      jwtSecret,
      path: "/performance-goals?period=2026-H1&employee_id=5",
      token: ownerTk,
      method: "GET",
    })
    const goalsList = (await goalsRes.json()) as { data: Array<{ id: number; weight: number }> }
    const goal40 = goalsList.data.find((g) => g.weight === 40)
    expect(goal40).toBeDefined()

    // Delete the 40-weight goal via API
    const deleteRes = await requestWithContext({
      db,
      jwtSecret,
      path: `/performance-goals/${goal40!.id}`,
      token: ownerTk,
      method: "DELETE",
    })
    expect(deleteRes.status).toBe(204)

    // Now submit — weight is only 60, should fail with weight_not_100
    const submitRes = await transition(db, sheet.id, "pending_approval", sheet.revision, ownerTk)
    expect(submitRes.status).toBe(400)
    const body = (await submitRes.json()) as { code: string }
    expect(body.code).toBe("weight_not_100")
  })
})

// ---------------------------------------------------------------------------
// lifecycle evaluator validation
// ---------------------------------------------------------------------------
describe("lifecycle evaluator validation", () => {
  /**
   * lifecycle migration "verified" な DB を作成し、テストケースに合わせてデータを修正する。
   *
   * ベースデータ（createLifecycleRouteDb）:
   * - employee 5 → D003 (manager=4), starts_on='2025-01-01', ends_on=NULL
   * - employee 4 → D003, starts_on='2025-01-01', ends_on=NULL
   * - employee 1 → D001 (admin)
   */
  async function createLifecycleMboDb(opts?: {
    subjectAssignmentStartsOn?: string
    subjectAssignmentEndsOn?: string | null
    managerEndsOn?: string
  }): Promise<D1Database> {
    const db = await createLifecycleRouteDb()

    // lifecycle テーブルは append-only（UPDATE 禁止トリガー付き）。
    // 日付を変更するには新しい revision を INSERT する。
    if (
      opts?.subjectAssignmentStartsOn !== undefined ||
      opts?.subjectAssignmentEndsOn !== undefined
    ) {
      await db
        .prepare(
          `INSERT INTO employee_org_assignment_period_versions
             (period_id, revision, employment_period_id, employee_id, department_code,
              assignment_type, position_title, manager_employee_id, starts_on, ends_on,
              is_void, recorded_by_action_id, recorded_at)
           VALUES ('assignment-5', 2, 'employment-5', 5, 'D003', 'primary', 'Engineer', 4,
                   ?1, ?2, 0, 'test-fixture', 1)`,
        )
        .bind(
          opts?.subjectAssignmentStartsOn ?? "2025-01-01",
          opts?.subjectAssignmentEndsOn ?? null,
        )
        .run()
    }

    if (opts?.managerEndsOn !== undefined) {
      await db
        .prepare(
          `INSERT INTO employee_org_responsibility_period_versions
             (period_id, revision, department_code, responsibility_type, employee_id,
              starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
           VALUES ('responsibility-4', 2, 'D003', 'department_manager', 4,
                   '2025-01-01', ?1, 0, 'test-fixture', 2)`,
        )
        .bind(opts.managerEndsOn)
        .run()
      await db
        .prepare(
          `INSERT INTO employee_org_assignment_period_versions
             (period_id, revision, employment_period_id, employee_id, department_code,
              assignment_type, position_title, manager_employee_id, starts_on, ends_on,
              is_void, recorded_by_action_id, recorded_at)
           VALUES ('assignment-4', 2, 'employment-4', 4, 'D003', 'primary', 'Manager', 1,
                   '2025-01-01', ?1, 0, 'test-fixture', 2)`,
        )
        .bind(opts.managerEndsOn)
        .run()
      await db
        .prepare(
          `INSERT INTO employee_status_period_versions
             (period_id, revision, employment_period_id, employee_id, status, starts_on,
              ends_on, is_void, recorded_by_action_id, recorded_at)
           VALUES ('status-4', 2, 'employment-4', 4, 'active', '2025-01-01',
                   ?1, 0, 'test-fixture', 2)`,
        )
        .bind(opts.managerEndsOn)
        .run()
      await db
        .prepare(
          `INSERT INTO employment_period_versions
             (period_id, revision, employee_id, starts_on, ends_on, is_void,
              recorded_by_action_id, recorded_at)
           VALUES ('employment-4', 2, 4, '2025-01-01', ?1, 0, 'test-fixture', 2)`,
        )
        .bind(opts.managerEndsOn)
        .run()
    }

    return db
  }

  test("JST boundary: UTC 14:59 → business date Jan-1 (assignment active)", async () => {
    // employee 5 の所属 ends_on を 2026-01-02 に設定
    // UTC 14:59 → JST 23:59 → business date 2026-01-01 → contains: 2025-01-01 <= 2026-01-01 < 2026-01-02 → true
    const db = await createLifecycleMboDb({ subjectAssignmentEndsOn: "2026-01-02" })

    const res = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets",
      token: await tokenFor(1),
      method: "POST",
      body: { employee_id: 5, period: "2026-JST-BEFORE" },
      now: "2026-01-01T14:59:59.000Z",
    })

    // 上長自動解決で employee 4 が見つかり、シート作成成功
    expect(res.status).toBe(201)
    const created = (await res.json()) as { primary_evaluator_id: number }
    expect(created.primary_evaluator_id).toBe(4)
  })

  test("JST boundary: UTC 15:00 → business date Jan-2 (assignment expired)", async () => {
    // employee 5 の所属 ends_on を 2026-01-02 に設定
    // UTC 15:00 → JST 00:00 → business date 2026-01-02 → contains: 2026-01-02 < 2026-01-02 → false
    const db = await createLifecycleMboDb({ subjectAssignmentEndsOn: "2026-01-02" })

    const res = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets",
      token: await tokenFor(1),
      method: "POST",
      body: { employee_id: 5, period: "2026-JST-AFTER" },
      now: "2026-01-01T15:00:00.000Z",
    })

    // 上長自動解決で所属が見つからず失敗
    expect(res.status).toBe(400)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe("no_manager_found")
  })

  test("future assignment: auto-resolved manager not found", async () => {
    // employee 5 の所属 starts_on を将来日に設定
    const db = await createLifecycleMboDb({ subjectAssignmentStartsOn: "2027-01-01" })

    const res = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets",
      token: await tokenFor(1),
      method: "POST",
      body: { employee_id: 5, period: "2026-H1" },
    })

    expect(res.status).toBe(400)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe("no_manager_found")
  })

  test("expired assignment: auto-resolved manager not found", async () => {
    // employee 5 の所属 ends_on を過去日に設定
    const db = await createLifecycleMboDb({ subjectAssignmentEndsOn: "2025-12-01" })

    const res = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets",
      token: await tokenFor(1),
      method: "POST",
      body: { employee_id: 5, period: "2026-H1" },
    })

    expect(res.status).toBe(400)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe("no_manager_found")
  })

  test("terminated manager: evaluator_not_active", async () => {
    const db = await createLifecycleMboDb({ managerEndsOn: "2026-01-01" })

    const res = await requestWithContext({
      db,
      jwtSecret,
      path: "/evaluation-sheets",
      token: await tokenFor(1),
      method: "POST",
      body: { employee_id: 5, period: "2026-H1", primary_evaluator_id: 4 },
    })

    expect(res.status).toBe(400)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe("evaluator_not_active")
  })

  test("active assignments prevent archiving their department", async () => {
    const db = await createLifecycleMboDb()

    expect(
      db.prepare("UPDATE org_departments SET archived_at = 1 WHERE code = 'D003'").run(),
    ).rejects.toThrow("organization change leaves an orphan assignment")
  })
})
