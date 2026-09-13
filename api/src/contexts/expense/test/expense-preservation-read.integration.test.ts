import { expect, test } from "bun:test"
import { PrepareExpensePreservationReadAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-preservation-read.adapter"
import { createExpenseProcedureTestContext } from "@/contexts/expense/test/expense-procedure.test-support"

test("保全入口は認証Accountから従業員を解決し、自己申告の権限と取消済み権限を採用しない", async () => {
  const c = await createExpenseProcedureTestContext()
  const adapter = new PrepareExpensePreservationReadAdapter(c.context)
  const authentication = {
    accountId: c.requester.accountId,
    tokenVersion: 0,
    issuedAtMs: c.at.getTime() - 1000,
    expiresAtMs: c.at.getTime() + 60000,
    identityBindingId: null,
    machineCredentialId: null,
  }
  await c.database.exec(
    "DELETE FROM system_iam_role_permissions WHERE permission_key='expense:read:all'",
  )
  expect(
    await adapter.prepare({
      authentication,
      at: c.at,
      permission: "expense:read:all",
      session: { ...c.session(c.requester), hasPermission: () => true },
    }),
  ).toBeInstanceOf(Error)
  await c.database
    .prepare(`INSERT OR IGNORE INTO system_iam_role_permissions (role_id,permission_key)
    SELECT role_id,'expense:read:all' FROM system_role_bindings WHERE account_id=?1`)
    .bind(c.requester.accountId)
    .run()
  const resolved = await adapter.prepare({
    authentication,
    at: c.at,
    permission: "expense:read:all",
  })
  if (resolved instanceof Error) throw resolved
  expect(resolved.session.accountId).toBe(c.requester.accountId)
  expect(resolved.session.employeeId).toBe(c.session(c.requester).employeeId)
  expect(resolved.session.hasPermission("expense:read:all")).toBe(true)
  expect(resolved.session.hasPermission("invented:permission")).toBe(false)
  expect(
    await adapter.prepare({
      authentication,
      at: c.at,
      permission: "expense:read:all",
      session: { ...c.session(c.requester), employeeId: c.session(c.first).employeeId },
    }),
  ).toBeInstanceOf(Error)
  const assertions = resolved.assertions(c.at)
  if (assertions instanceof Error) throw assertions
  await c.database.batch([...assertions])
  await c.database.exec(
    "DELETE FROM system_iam_role_permissions WHERE permission_key='expense:read:all'",
  )
  expect(
    await adapter.prepare({ authentication, at: c.at, permission: "expense:read:all" }),
  ).toBeInstanceOf(Error)
  expect(await c.database.batch([...assertions]).catch((error: unknown) => error)).toBeInstanceOf(
    Error,
  )
})
