import { expect, test, spyOn } from "bun:test"
import { createExpenseProcedureTestContext } from "@/contexts/expense/test/expense-procedure.test-support"
import { ExpenseProcedureRepository } from "@/contexts/expense/infrastructure/repositories/expense-procedure.repository"
import { RecordExpenseDecision } from "@/contexts/expense/application/record-expense-decision"
import { CancelExpenseProcedure } from "@/contexts/expense/application/cancel-expense-procedure"
import { ConflictError, ForbiddenError } from "@/lib/errors"

test("経費・添付・判断対象を一緒に保存し、二名の承認後に一度だけ確定する", async () => {
  const c = await createExpenseProcedureTestContext()
  const expense = await c.create()
  expect(await c.submit.run(c.command)).toMatchObject({
    request: { id: expense.id },
    replayed: true,
  })
  expect(await c.attachments.findById(c.attachmentId)).toMatchObject({ status: "linked" })
  expect(expense.binding.attachments).toEqual([
    {
      id: c.attachmentId,
      sha256: "a".repeat(64),
      fileName: "receipt.pdf",
      contentType: "application/pdf",
      byteSize: 500,
    },
  ])
  expect(await expense.decide(c.requester)).toBeInstanceOf(ForbiddenError)
  expect(await expense.decide(c.first)).toMatchObject({ status: "pending", needsExecution: false })
  expect(await c.repository.findById(expense.id)).toMatchObject({ status: "pending" })
  expect(await expense.decide(c.second)).toMatchObject({ status: "approved", needsExecution: true })
  expect(await expense.complete()).toEqual({ status: "approved", replayed: false })
  expect(await expense.complete()).toEqual({ status: "approved", replayed: true })
  expect(await expense.proposal()).toMatchObject({ status: "executed" })
  expect(await c.repository.findById(expense.id)).toMatchObject({ status: "approved" })
})

test("添付の不足・他人の添付・重複を拒否し、何も作らず同じキーで再試行できる", async () => {
  const c = await createExpenseProcedureTestContext()
  for (const attachmentIds of [["missing"], [c.attachmentId, c.attachmentId]])
    expect(await c.submit.run({ ...c.command, attachmentIds })).toBeInstanceOf(Error)
  await c.database
    .prepare("UPDATE system_attachments SET owner_account_id = ?1 WHERE id = ?2")
    .bind(c.first.accountId, c.attachmentId)
    .run()
  expect(await c.submit.run(c.command)).toBeInstanceOf(Error)
  expect(
    await c.database.prepare("SELECT count(*) AS total FROM expenses").first<number>("total"),
  ).toBe(0)
  expect(
    await c.database
      .prepare("SELECT count(*) AS total FROM system_cases WHERE subject_context = 'expense'")
      .first<number>("total"),
  ).toBe(0)
  await c.database
    .prepare("UPDATE system_attachments SET owner_account_id = ?1 WHERE id = ?2")
    .bind(c.requester.accountId, c.attachmentId)
    .run()
  expect((await c.create()).id).toBeGreaterThan(0)
})

test("監査保存の失敗で経費・添付状態・案件を巻き戻し再試行できる", async () => {
  const c = await createExpenseProcedureTestContext()
  await c.database.exec(
    "CREATE TRIGGER fail_expense_submission BEFORE INSERT ON system_audit_events WHEN NEW.action = 'expense.request.submitted' BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END",
  )
  expect(await c.submit.run(c.command)).toBeInstanceOf(Error)
  expect(await c.attachments.findById(c.attachmentId)).toMatchObject({
    status: "pending",
    linkedAt: null,
  })
  expect(
    await c.database.prepare("SELECT count(*) AS total FROM expenses").first<number>("total"),
  ).toBe(0)
  await c.database.exec("DROP TRIGGER fail_expense_submission")
  await c.create()
})

test("提出後の内容・添付変更と実行許可を使わない確定をDBが拒否する", async () => {
  const c = await createExpenseProcedureTestContext()
  const expense = await c.create()
  for (const sql of [
    "UPDATE expenses SET amount = 600 WHERE id = ?1",
    "UPDATE expenses SET status = 'approved' WHERE id = ?1",
    "DELETE FROM expenses WHERE id = ?1",
    "DELETE FROM expense_attachments WHERE expense_id = ?1",
    "UPDATE expense_attachments SET attachment_id = 'other' WHERE expense_id = ?1",
  ])
    expect(
      await c.database
        .prepare(sql)
        .bind(expense.id)
        .run()
        .catch((cause: unknown) => cause),
    ).toBeInstanceOf(Error)
  expect(await c.repository.findById(expense.id)).toMatchObject({ amount: 500, status: "pending" })
})

test("確認した添付の消去・変更を判断と実行直前に拒否する", async () => {
  const c = await createExpenseProcedureTestContext()
  const expense = await c.create()
  await c.database
    .prepare("UPDATE system_attachments SET plaintext_sha256 = ?1 WHERE id = ?2")
    .bind("b".repeat(64), c.attachmentId)
    .run()
  expect(await expense.decide()).toBeInstanceOf(ConflictError)
  await c.database
    .prepare("UPDATE system_attachments SET plaintext_sha256 = ?1 WHERE id = ?2")
    .bind("a".repeat(64), c.attachmentId)
    .run()
  await expense.decide(c.first)
  await expense.decide(c.second)
  const execute = c.repository.executeAuthorized.bind(c.repository)
  const interception = spyOn(
    ExpenseProcedureRepository.prototype,
    "executeAuthorized",
  ).mockImplementation(async function (this: ExpenseProcedureRepository, input) {
    await c.database
      .prepare("UPDATE system_attachments SET plaintext_sha256 = ?1 WHERE id = ?2")
      .bind("b".repeat(64), c.attachmentId)
      .run()
    return execute(input)
  })
  try {
    expect(await expense.complete()).toBeInstanceOf(ConflictError)
  } finally {
    interception.mockRestore()
  }
  expect(await c.repository.findById(expense.id)).toMatchObject({ status: "pending" })
  expect(await expense.proposal()).toMatchObject({ status: "approved" })
  await c.database
    .prepare("UPDATE system_attachments SET plaintext_sha256 = ?1 WHERE id = ?2")
    .bind("a".repeat(64), c.attachmentId)
    .run()
  expect(await expense.complete()).toMatchObject({ status: "approved" })
})

test("差戻し元の添付を保持して新しい番号で一回だけ再提出する", async () => {
  const c = await createExpenseProcedureTestContext("return")
  const expense = await c.create()
  expect(await expense.decide(c.first, "reject")).toMatchObject({ status: "returned" })
  const command = {
    ...c.command,
    requestKey: crypto.randomUUID(),
    previousExpenseId: expense.id,
    note: "Corrected",
  }
  const revised = await c.submit.run(command)
  if (revised instanceof Error) throw revised
  expect(revised.request.id).not.toBe(expense.id)
  expect(await c.submit.run(command)).toMatchObject({
    request: { id: revised.request.id },
    replayed: true,
  })
  expect(await c.submit.run({ ...command, requestKey: crypto.randomUUID() })).toBeInstanceOf(
    ConflictError,
  )
  expect(await c.repository.readAttachmentIds(expense.id)).toEqual([c.attachmentId])
})

test("取消と同時再送は同じ対象に収束し、古い対象への判断は通さない", async () => {
  const c = await createExpenseProcedureTestContext()
  const expense = await c.create()
  const command = {
    expenseId: expense.id,
    session: c.session(c.requester),
    tokenVersion: 0,
    decisionTarget: expense.decisionTarget,
    cancelledAt: c.at,
  }
  const cancel = new CancelExpenseProcedure(c.context)
  const outcomes = await Promise.all([cancel.run(command), cancel.run(command)])
  expect(outcomes).toEqual(
    expect.arrayContaining([
      { status: "cancelled", replayed: false },
      { status: "cancelled", replayed: true },
    ]),
  )
  expect(
    await new RecordExpenseDecision(c.context).run({
      expenseId: expense.id,
      session: c.session(c.first),
      tokenVersion: 0,
      decisionTarget: { ...expense.decisionTarget, taskRound: 2 },
      action: "approve",
      comment: null,
      decidedAt: c.at,
    }),
  ).toBeInstanceOf(ConflictError)
})

test("同時提出と異なる内容の再送を区別し、添付と案件を一回だけ保存する", async () => {
  const c = await createExpenseProcedureTestContext()
  const submitted = await Promise.all([c.submit.run(c.command), c.submit.run(c.command)])
  const ids = submitted.map((result) => {
    if (result instanceof Error) throw result
    return result.request.id
  })
  expect(new Set(ids).size).toBe(1)
  expect(submitted.map((result) => (result instanceof Error ? null : result.replayed))).toEqual(
    expect.arrayContaining([false, true]),
  )
  expect(await c.submit.run({ ...c.command, amount: 600 })).toBeInstanceOf(ConflictError)
  expect(
    await c.database
      .prepare("SELECT count(*) AS total FROM expense_procedure_bindings")
      .first<number>("total"),
  ).toBe(1)
  expect(
    await c.database
      .prepare("SELECT count(*) AS total FROM expense_attachments")
      .first<number>("total"),
  ).toBe(1)
})

test("準備後の技術権限失効で判断・通知を保存せず、再付与後の同じ判断は通る", async () => {
  const c = await createExpenseProcedureTestContext()
  const expense = await c.create()
  const record = c.repository.recordDecision.bind(c.repository)
  const interception = spyOn(
    ExpenseProcedureRepository.prototype,
    "recordDecision",
  ).mockImplementation(async function (this: ExpenseProcedureRepository, input) {
    await c.database.exec(
      "DELETE FROM system_iam_role_permissions WHERE role_id = 'expense-test-role' AND permission_key = 'expense:approve'",
    )
    return record(input)
  })
  try {
    expect(await expense.decide()).toBeInstanceOf(ConflictError)
  } finally {
    interception.mockRestore()
  }
  expect(await expense.proposal()).toMatchObject({ status: "pending" })
  expect(
    await c.database
      .prepare("SELECT count(*) AS total FROM system_human_attestations WHERE case_id = ?1")
      .bind(expense.binding.caseId)
      .first<number>("total"),
  ).toBe(0)
  await c.database.exec(
    "INSERT INTO system_iam_role_permissions (role_id,permission_key) VALUES ('expense-test-role','expense:approve')",
  )
  expect(await expense.decide()).toMatchObject({ status: "pending" })
})

test("旧経費を元の内容と添付で接続し、過去の決定を引き継がない", async () => {
  const c = await createExpenseProcedureTestContext()
  const legacy = await c.database
    .prepare(`INSERT INTO expenses
    (employee_id,organization_unit_id,category,amount,spent_at,note,status,created_at)
    VALUES (?1,?2,?3,?4,?5,?6,'pending',?7) RETURNING id`)
    .bind(
      c.requester.employeeId,
      c.root.id,
      c.command.category,
      c.command.amount,
      c.command.spentAt,
      c.command.note,
      c.at.toISOString(),
    )
    .first<{ id: number }>()
  if (legacy === null) throw new Error("legacy missing")
  const linked = await c.attachments.markLinked(c.attachmentId, c.at)
  if (linked instanceof Error) throw linked
  await c.database
    .prepare(
      "INSERT INTO expense_attachments (expense_id,attachment_id,created_at) VALUES (?1,?2,?3)",
    )
    .bind(legacy.id, c.attachmentId, c.at.toISOString())
    .run()
  const command = {
    ...c.command,
    existingExpenseId: legacy.id,
    createdAt: new Date(c.at.getTime() + 1000),
  }
  expect(await c.submit.run({ ...command, amount: 600 })).toBeInstanceOf(ConflictError)
  const create = c.repository.createWithProcedure.bind(c.repository)
  const interception = spyOn(
    ExpenseProcedureRepository.prototype,
    "createWithProcedure",
  ).mockImplementation(async (input) => {
    await c.database
      .prepare(
        "UPDATE expense_attachments SET attachment_id = 'changed-attachment' WHERE expense_id = ?1",
      )
      .bind(legacy.id)
      .run()
    return create(input)
  })
  try {
    expect(await c.submit.run(command)).toBeInstanceOf(ConflictError)
  } finally {
    interception.mockRestore()
  }
  expect(await c.repository.findProcedure(legacy.id)).toBeNull()
  await c.database
    .prepare("UPDATE expense_attachments SET attachment_id = ?1 WHERE expense_id = ?2")
    .bind(c.attachmentId, legacy.id)
    .run()
  expect(await c.submit.run(command)).toMatchObject({
    request: { id: legacy.id, createdAt: c.at.toISOString() },
    replayed: false,
  })
  expect(await c.submit.run(command)).toMatchObject({ request: { id: legacy.id }, replayed: true })
  expect(
    await c.database
      .prepare("SELECT count(*) AS total FROM system_human_attestations")
      .first<number>("total"),
  ).toBe(0)
})

test("承認後に一人の会社資格が失効すると経費の確定と実行許可の保存を拒否する", async () => {
  const c = await createExpenseProcedureTestContext()
  const expense = await c.create()
  await expense.decide(c.first)
  await expense.decide(c.second)
  await c.revokeFirstVoting()
  expect(await expense.complete()).toBeInstanceOf(ForbiddenError)
  expect(await c.repository.findById(expense.id)).toMatchObject({ status: "pending" })
  expect(await expense.proposal()).toMatchObject({ status: "approved" })
  expect(
    await c.database
      .prepare("SELECT count(*) AS total FROM system_execution_authorizations WHERE case_id = ?1")
      .bind(expense.binding.caseId)
      .first<number>("total"),
  ).toBe(0)
})
