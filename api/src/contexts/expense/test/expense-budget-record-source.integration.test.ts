import { expect, test } from "bun:test"
import { CaptureExpenseBudgetRecordAdapter } from "@/contexts/expense/infrastructure/adapters/capture-expense-budget-record.adapter"
import { createExpenseProcedureTestContext } from "@/contexts/expense/test/expense-procedure.test-support"

test("部署予算は実際の管理権限で全保存列を取得し、権限取消後の確定を拒否する", async () => {
  const c = await createExpenseProcedureTestContext()
  const submitted = await c.submit.run({ ...c.command, attachmentIds: [] })
  if (submitted instanceof Error) throw submitted
  await c.database
    .prepare(`INSERT INTO expense_budgets
    (id,organization_unit_id,fiscal_period,period_start,period_end,amount,name,note,created_at)
    SELECT 901,organization_unit_id,'2026','2026-04-01','2027-03-31',100000,'Annual budget',NULL,created_at
    FROM expenses WHERE id=?1`)
    .bind(submitted.request.id)
    .run()
  const source = new CaptureExpenseBudgetRecordAdapter({ ...c.context, now: () => c.at })
  const input = {
    budgetId: 901,
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
  await c.database.exec(
    "DELETE FROM system_iam_role_permissions WHERE permission_key='budget:manage'",
  )
  expect(await source.prepare(input)).toBeInstanceOf(Error)
  await c.database
    .prepare(`INSERT OR IGNORE INTO system_iam_role_permissions (role_id,permission_key)
    SELECT role_id,'budget:manage' FROM system_role_bindings WHERE account_id=?1`)
    .bind(c.requester.accountId)
    .run()
  const captured = await source.prepare(input)
  if (captured instanceof Error) throw captured
  const original = await c.database.prepare("SELECT * FROM expense_budgets WHERE id=901").first()
  expect(JSON.parse(new TextDecoder().decode(captured.content))).toEqual({
    format: "expense-budget",
    version: 1,
    record: original,
  })
  expect(captured.source.props).toMatchObject({
    recordKind: "expense-budget",
    recordId: "901",
    sourceRevision: null,
    sourceRecordedAt: null,
  })
  expect(await source.prepare({ ...input, budgetId: 902 })).toBeInstanceOf(Error)
  expect(await source.prepare({ ...input, session: c.session(c.first) })).toBeInstanceOf(Error)
  await c.database.exec("UPDATE expense_budgets SET amount=9007199254740993 WHERE id=901")
  const largeAmount = await source.prepare(input)
  if (largeAmount instanceof Error) throw largeAmount
  const amountText = await c.database
    .prepare("SELECT CAST(amount AS TEXT) AS amount FROM expense_budgets WHERE id=901")
    .first<string>("amount")
  expect(amountText).toBe("9007199254740993")
  expect(new TextDecoder().decode(largeAmount.content)).toContain('"amount":9007199254740993')
  expect(largeAmount.source.props.contentDigest).not.toBe(captured.source.props.contentDigest)
  await c.database.exec("UPDATE expense_budgets SET amount=100000 WHERE id=901")
  await c.database.exec(
    "DELETE FROM system_iam_role_permissions WHERE permission_key='budget:manage'",
  )
  expect(await source.prepare(input)).toBeInstanceOf(Error)
  await c.database.exec("CREATE TABLE budget_capture_receipts (id TEXT PRIMARY KEY)")
  expect(
    await c.database
      .batch([
        c.database.prepare("INSERT INTO budget_capture_receipts VALUES ('stale')"),
        ...captured.assertions,
      ])
      .catch((error: unknown) => error),
  ).toBeInstanceOf(Error)
  expect(
    await c.database
      .prepare("SELECT count(*) AS n FROM budget_capture_receipts")
      .first<number>("n"),
  ).toBe(0)
})
