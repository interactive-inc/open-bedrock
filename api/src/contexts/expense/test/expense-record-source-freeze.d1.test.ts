import { PrepareExpenseWriteGuardAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-write-guard.adapter"
import { afterAll, beforeAll, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { createExpenseProcedureTestContext } from "@/contexts/expense/test/expense-procedure.test-support"
import { RecordSourceFreezeEntity } from "@system/domain/entities/record-source-freeze.entity"
import { CancelExpenseProcedure } from "@/contexts/expense/application/cancel-expense-procedure"
import { PublishExpenseProcedure } from "@/contexts/expense/application/publish-expense-procedure"
import { CaptureExpenseRecordAdapter } from "@/contexts/expense/infrastructure/adapters/capture-expense-record.adapter"
import { ExpenseProcedureRepository } from "@/contexts/expense/infrastructure/repositories/expense-procedure.repository"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"
import { execSql } from "@tests/d1/support/exec-sql"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(8)
})

afterAll(async () => {
  await pool.dispose()
})

async function saveFreeze(
  database: D1Database,
  freeze: RecordSourceFreezeEntity,
  previous: RecordSourceFreezeEntity | null = null,
) {
  const value = freeze.snapshot
  const release = value.release
  const audit = database
    .prepare(`INSERT INTO system_audit_events
    (event_id,actor_account_id,action,target_type,target_id,outcome,authorization_json,before_json,after_json,occurred_at)
    VALUES (?1,?2,?3,'system:record-source-freeze',?4,'succeeded','{}',?5,?6,?7)`)
    .bind(
      release?.auditEventId ?? value.auditEventId,
      release?.actorAccountId ?? value.actorAccountId,
      release === null
        ? "system.record.source.freeze.created"
        : "system.record.source.freeze.released",
      value.id,
      previous === null ? null : JSON.stringify(previous.snapshot),
      JSON.stringify(value),
      Date.parse(release?.at ?? value.createdAt),
    )
  const mutation =
    previous === null
      ? database
          .prepare(`INSERT INTO system_record_source_freezes
      (id,source_namespace,owner_context,revision,created_audit_event_id,release_audit_event_id,snapshot_json)
      VALUES (?1,?2,?3,1,?4,NULL,?5)`)
          .bind(
            value.id,
            value.sourceNamespace,
            value.ownerContext,
            value.auditEventId,
            JSON.stringify(value),
          )
      : database
          .prepare(`UPDATE system_record_source_freezes SET revision=2,release_audit_event_id=?1,snapshot_json=?2
      WHERE id=?3 AND revision=1`)
          .bind(release?.auditEventId, JSON.stringify(value), value.id)
  await database.batch([audit, mutation])
}

test("経費の停止は5表すべての追加・更新・削除・置換を拒否し、解除後に業務更新を再開する", async () => {
  const c = await createExpenseProcedureTestContext(await pool.next())
  await c.create()
  await c.database
    .prepare(`INSERT INTO expense_approvals
    (id,expense_id,approver_id,action,comment,created_at)
    SELECT '01900050-0000-7000-8000-000000000385',id,?1,'approve',NULL,created_at FROM expenses LIMIT 1`)
    .bind(c.first.employeeId)
    .run()
  await execSql(
    c.database,
    `INSERT INTO expense_budgets
    (id,organization_unit_id,fiscal_period,period_start,period_end,amount,name,note,created_at)
    SELECT '01900050-0000-7000-8000-000000000385',organization_unit_id,'2026','2026-04-01','2027-03-31',100000,'Annual budget',NULL,created_at
    FROM expenses LIMIT 1`,
  )
  const freeze = RecordSourceFreezeEntity.create({
    id: crypto.randomUUID(),
    sourceNamespace: "example-source",
    ownerContext: "expense",
    actorAccountId: c.requester.accountId,
    reason: "Preserve all source records",
    createdAt: c.at.toISOString(),
    auditEventId: crypto.randomUUID(),
    revision: 1,
    release: null,
  })
  if (freeze instanceof Error) throw freeze
  const queued = c.database.prepare(
    "UPDATE expense_budgets SET amount=200000 WHERE id='01900050-0000-7000-8000-000000000385'",
  )
  await saveFreeze(c.database, freeze)
  const tables = [
    { table: "expenses", column: "note" },
    { table: "expense_approvals", column: "comment" },
    { table: "expense_attachments", column: "created_at" },
    { table: "expense_procedure_bindings", column: "attachment_evidence_json" },
    { table: "expense_budgets", column: "amount" },
  ]
  for (const source of tables) {
    const before = await c.database.prepare(`SELECT * FROM ${source.table}`).all()
    expect(before.results.length).toBeGreaterThan(0)
    for (const mutation of [
      `UPDATE ${source.table} SET ${source.column}=${source.column}`,
      `DELETE FROM ${source.table}`,
      `INSERT OR REPLACE INTO ${source.table} SELECT * FROM ${source.table}`,
    ]) {
      const rejected = await c.database
        .prepare(mutation)
        .run()
        .catch((error: unknown) => error)
      expect(rejected).toBeInstanceOf(Error)
      if (!(rejected instanceof Error)) throw new Error("停止中の書込みが成功しました")
      expect(rejected.message).toContain("expense_record_source_frozen")
    }
    expect((await c.database.prepare(`SELECT * FROM ${source.table}`).all()).results).toEqual(
      before.results,
    )
  }
  await execSql(c.database, "CREATE TABLE expense_freeze_receipts (id TEXT PRIMARY KEY)")
  expect(
    await c.database
      .batch([c.database.prepare("INSERT INTO expense_freeze_receipts VALUES ('queued')"), queued])
      .catch((error: unknown) => error),
  ).toBeInstanceOf(Error)
  expect(
    await c.database
      .prepare("SELECT count(*) AS n FROM expense_freeze_receipts")
      .first<number>("n"),
  ).toBe(0)
  const released = freeze.release({
    actorAccountId: c.requester.accountId,
    reason: "Resume source writes",
    at: c.at.toISOString(),
    auditEventId: crypto.randomUUID(),
  })
  if (released instanceof Error) throw released
  await saveFreeze(c.database, released, freeze)
  expect(await queued.run()).toMatchObject({ success: true })
  expect(
    await c.database
      .prepare("SELECT amount FROM expense_budgets WHERE id='01900050-0000-7000-8000-000000000385'")
      .first<number>("amount"),
  ).toBe(200000)
})

for (const operation of ["decision", "cancel", "publish", "submit", "execute"]) {
  test(`経費の停止中はSystemへの${operation}も保存せず、原記録の読取りは続けられる`, async () => {
    const c = await createExpenseProcedureTestContext(await pool.next())
    const record = await c.create()
    if (operation === "execute") {
      const first = await record.decide(c.first)
      const second = await record.decide(c.second)
      if (first instanceof Error) throw first
      if (second instanceof Error) throw second
    }
    const freeze = RecordSourceFreezeEntity.create({
      id: crypto.randomUUID(),
      sourceNamespace: "example-source",
      ownerContext: "expense",
      actorAccountId: c.requester.accountId,
      reason: "Preserve workflow source",
      createdAt: c.at.toISOString(),
      auditEventId: crypto.randomUUID(),
      revision: 1,
      release: null,
    })
    if (freeze instanceof Error) throw freeze
    await saveFreeze(c.database, freeze)
    const before = await record.proposal()
    const audits = await c.database
      .prepare("SELECT * FROM system_audit_events ORDER BY event_id")
      .all()
    const run = async () => {
      if (operation === "decision") return record.decide()
      if (operation === "cancel")
        return new CancelExpenseProcedure(c.context).run({
          expenseId: record.id,
          session: c.session(c.requester),
          tokenVersion: 0,
          decisionTarget: record.decisionTarget,
          cancelledAt: c.at,
        })
      if (operation === "publish")
        return new PublishExpenseProcedure(c.context).run({
          expectedRevision: 1,
          workflow: c.workflow,
          session: c.session(c.requester),
          tokenVersion: 0,
          publishedAt: c.at,
        })
      if (operation === "submit")
        return c.submit.run({
          ...c.command,
          requestKey: crypto.randomUUID(),
          attachmentIds: [],
        })
      return record.complete()
    }
    expect(await run()).toMatchObject({ code: "expense_record_source_frozen" })
    expect(await record.proposal()).toEqual(before)
    expect(
      (await c.database.prepare("SELECT * FROM system_audit_events ORDER BY event_id").all())
        .results,
    ).toEqual(audits.results)
    const captured = await new CaptureExpenseRecordAdapter({
      ...c.context,
      now: () => c.at,
    }).prepare({
      expenseId: record.id,
      sourceNamespace: "example-source",
      session: c.session(c.requester),
      authentication: {
        accountId: c.requester.accountId,
        tokenVersion: 0,
        issuedAtMs: c.at.getTime() - 1000,
        expiresAtMs: c.at.getTime() + 60000,
        identityBindingId: null,
        machineCredentialId: null,
      },
    })
    if (captured instanceof Error) throw captured
    expect(captured.source.props.recordId).toBe(String(record.id))
    const released = freeze.release({
      actorAccountId: c.requester.accountId,
      reason: "Resume workflow writes",
      at: c.at.toISOString(),
      auditEventId: crypto.randomUUID(),
    })
    if (released instanceof Error) throw released
    await saveFreeze(c.database, released, freeze)
    expect(await run()).not.toBeInstanceOf(Error)
  })
}

test("判断資格の確認後に停止が確定しても、Systemへの承認保存を拒否する", async () => {
  const c = await createExpenseProcedureTestContext(await pool.next())
  const record = await c.create()
  const before = await record.proposal()
  const freeze = RecordSourceFreezeEntity.create({
    id: crypto.randomUUID(),
    sourceNamespace: "example-source",
    ownerContext: "expense",
    actorAccountId: c.requester.accountId,
    reason: "Stop before decision persistence",
    createdAt: c.at.toISOString(),
    auditEventId: crypto.randomUUID(),
    revision: 1,
    release: null,
  })
  if (freeze instanceof Error) throw freeze
  const save = c.repository.recordDecision.bind(c.repository)
  const interception = spyOn(
    ExpenseProcedureRepository.prototype,
    "recordDecision",
  ).mockImplementation(async (input) => {
    await saveFreeze(c.database, freeze)
    return save(input)
  })
  try {
    expect(await record.decide()).toMatchObject({ code: "expense_record_source_frozen" })
  } finally {
    interception.mockRestore()
  }
  expect(await record.proposal()).toEqual(before)
  expect(
    await c.database
      .prepare(
        "SELECT count(*) AS n FROM system_audit_events WHERE action='expense.request.approve'",
      )
      .first<number>("n"),
  ).toBe(0)
})

test("停止エラーの分類はSQL本文・入力値・別の制約を権限や停止へ読み替えない", async () => {
  const c = await createExpenseProcedureTestContext(await pool.next())
  const adapter = new PrepareExpenseWriteGuardAdapter(c.context)
  for (const error of [
    new Error("SELECT json_extract('{}','expense_record_source_frozen')"),
    new Error("malformed JSON"),
    new Error("bad JSON path: 'other_guard'"),
    new Error("permission denied: expense_record_source_frozen"),
    { message: "expense_record_source_frozen" },
    "expense_record_source_frozen",
  ])
    expect(adapter.failure(error)).toBeNull()
  const cycle = new Error("unrelated")
  cycle.cause = cycle
  expect(adapter.failure(cycle)).toBeNull()
  for (const message of [
    "expense_record_source_frozen",
    "bad JSON path: 'expense_record_source_frozen'",
    "D1_ERROR: JSON path error near 'expense_record_source_frozen': SQLITE_ERROR",
    "D1_ERROR: expense_record_source_frozen: SQLITE_CONSTRAINT",
  ]) {
    const cause = new Error("wrapped database error", { cause: new Error(message) })
    expect(adapter.failure(cause)).toMatchObject({ code: "expense_record_source_frozen", cause })
  }
})
