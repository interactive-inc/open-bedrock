import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { CaptureExpenseRecordAdapter } from "@/contexts/expense/infrastructure/adapters/capture-expense-record.adapter"
import { CaptureExpenseApprovalRecordAdapter } from "@/contexts/expense/infrastructure/adapters/capture-expense-approval-record.adapter"
import { CancelExpenseProcedure } from "@/contexts/expense/application/cancel-expense-procedure"
import { createExpenseProcedureTestContext } from "@/contexts/expense/test/expense-procedure.test-support"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"
import { execSql } from "@tests/d1/support/exec-sql"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(2)
})

afterAll(async () => {
  await pool.dispose()
})

test("添付なしの申請も元行の全列を取得し、案件取消後の古い保全確定を拒否する", async () => {
  const c = await createExpenseProcedureTestContext(await pool.next())
  const submitted = await c.submit.run({ ...c.command, attachmentIds: [] })
  if (submitted instanceof Error) throw submitted
  const expenseId = submitted.request.id
  if (expenseId === null) throw new Error("経費の作成を確認できません")
  const source = new CaptureExpenseRecordAdapter({ ...c.context, now: () => c.at })
  const input = {
    expenseId,
    sourceNamespace: "example-source",
    session: c.session(c.first),
    authentication: {
      accountId: c.first.accountId,
      tokenVersion: 0,
      issuedAtMs: c.at.getTime() - 1000,
      expiresAtMs: c.at.getTime() + 60000,
      identityBindingId: null,
      machineCredentialId: null,
    },
  }
  expect(await source.prepare({ ...input, expenseId: expenseId + 1000 })).toBeInstanceOf(Error)
  expect(await source.prepare({ ...input, session: c.session(c.requester) })).toBeInstanceOf(Error)
  const captured = await source.prepare(input)
  if (captured instanceof Error) throw captured
  const original = await c.database
    .prepare("SELECT * FROM expenses WHERE id=?1")
    .bind(expenseId)
    .first()
  expect(JSON.parse(new TextDecoder().decode(captured.content))).toEqual({
    format: "expense-record",
    version: 1,
    record: original,
  })
  expect(captured.source.props).toMatchObject({
    ownerContext: "expense",
    recordKind: "expense-record",
    recordId: String(expenseId),
    sourceRevision: null,
    sourceRecordedAt: null,
  })
  const binding = await c.repository.findProcedure(expenseId)
  if (binding instanceof Error || binding === null) throw new Error("案件が見つかりません")
  const cancelled = await new CancelExpenseProcedure(c.context).run({
    expenseId,
    session: c.session(c.requester),
    tokenVersion: 0,
    cancelledAt: c.at,
    decisionTarget: {
      proposalVersion: 1,
      proposalDigest: binding.proposalDigest,
      taskKey: c.step.key,
      taskRound: 1,
    },
  })
  if (cancelled instanceof Error) throw cancelled
  await execSql(c.database, "CREATE TABLE expense_source_capture_receipts (id TEXT PRIMARY KEY)")
  expect(
    await c.database
      .batch([
        c.database.prepare("INSERT INTO expense_source_capture_receipts VALUES ('stale')"),
        ...captured.assertions,
      ])
      .catch((error: unknown) => error),
  ).toBeInstanceOf(Error)
  expect(
    await c.database
      .prepare("SELECT count(*) AS n FROM expense_source_capture_receipts")
      .first<number>("n"),
  ).toBe(0)
  expect(await source.prepare(input)).toBeInstanceOf(Error)
})

test("旧承認を元行のまま取得し、別申請への付替えや取得後の内容変更を確定しない", async () => {
  const c = await createExpenseProcedureTestContext(await pool.next())
  const submitted = await c.submit.run({ ...c.command, attachmentIds: [] })
  if (submitted instanceof Error) throw submitted
  const originalId = submitted.request.id
  if (originalId === null) throw new Error("経費の作成を確認できません")
  const legacyId = await c.database
    .prepare(`INSERT INTO expenses
    (employee_id,organization_unit_id,category,amount,spent_at,note,status,created_at)
    SELECT employee_id,organization_unit_id,category,amount,spent_at,note,'approved',created_at
    FROM expenses WHERE id=?1 RETURNING id`)
    .bind(originalId)
    .first<number>("id")
  if (legacyId === null) throw new Error("旧経費fixtureを作成できません")
  await c.database
    .prepare(`INSERT INTO expense_approvals
    (id,expense_id,approver_id,action,comment,created_at) VALUES (901,?1,?2,'approve',NULL,?3)`)
    .bind(legacyId, c.first.employeeId, c.at.toISOString())
    .run()
  const source = new CaptureExpenseApprovalRecordAdapter({ ...c.context, now: () => c.at })
  const input = {
    expenseId: legacyId,
    approvalId: 901,
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
  }
  expect(await source.prepare({ ...input, expenseId: originalId })).toBeInstanceOf(Error)
  const captured = await source.prepare(input)
  if (captured instanceof Error) throw captured
  const original = await c.database.prepare("SELECT * FROM expense_approvals WHERE id=901").first()
  expect(JSON.parse(new TextDecoder().decode(captured.content))).toEqual({
    format: "expense-approval",
    version: 1,
    record: original,
  })
  expect(captured.source.props).toMatchObject({
    recordKind: "expense-approval",
    recordId: "901",
    sourceRevision: null,
    sourceRecordedAt: null,
  })
  await execSql(
    c.database,
    "UPDATE expense_approvals SET comment='Corrected legacy comment' WHERE id=901",
  )
  await execSql(c.database, "CREATE TABLE legacy_approval_capture_receipts (id TEXT PRIMARY KEY)")
  expect(
    await c.database
      .batch([
        c.database.prepare("INSERT INTO legacy_approval_capture_receipts VALUES ('stale')"),
        ...captured.assertions,
      ])
      .catch((error: unknown) => error),
  ).toBeInstanceOf(Error)
  const changed = await source.prepare(input)
  if (changed instanceof Error) throw changed
  expect(changed.source.props.contentDigest).not.toBe(captured.source.props.contentDigest)
  expect(
    await c.database
      .prepare("SELECT count(*) AS n FROM legacy_approval_capture_receipts")
      .first<number>("n"),
  ).toBe(0)
  expect(await c.repository.findProcedure(legacyId)).toBeNull()
})
