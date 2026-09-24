import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { app } from "@/api/app"
import { createExpenseProcedureTestContext } from "@/contexts/expense/test/expense-procedure.test-support"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"
import { execSql } from "@tests/d1/support/exec-sql"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(1)
})

afterAll(async () => {
  await pool.dispose()
})

test("経費の停止APIは人の管理権限・再認証・名前空間を検査し、解除と再送を監査する", async () => {
  const c = await createExpenseProcedureTestContext(await pool.next())
  const secret = "expense-freeze-generated-api-test-secret"
  const token = await new SystemAccessTokenIssuer(secret).issue({
    accountId: c.requester.accountId,
    tokenVersion: 0,
    now: c.at,
  })
  if (token instanceof Error) throw token
  const raw = "e".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(raw)
  if (hash instanceof Error) throw hash
  await c.database
    .prepare(`INSERT INTO system_step_up_grants
    (id,account_id,token_hash,method,issued_at,expires_at)
    VALUES ('expense-freeze-route-grant',?1,?2,'external_identity',?3,?4)`)
    .bind(c.requester.accountId, hash, c.at.getTime(), c.at.getTime() + 60000)
    .run()
  await execSql(
    c.database,
    "DELETE FROM system_iam_role_permissions WHERE permission_key='system:admin'",
  )
  const bindings = {
    DB: c.database,
    JWT_SECRET: secret,
    PEPPER_SECRET: "expense-freeze-test-pepper",
    RECORD_SOURCE_NAMESPACE: "example-source",
    NOW: c.at.toISOString(),
  }
  const id = crypto.randomUUID()
  const path = "/expense/record-source-freezes"
  const write = (
    suffix = "",
    stepUp = true,
    bearer = token,
    key: string = id,
    reason = "Preserve expense source",
  ) =>
    app.request(
      path + suffix,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${bearer}`,
          "content-type": "application/json",
          "idempotency-key": key,
          ...(stepUp ? { "x-system-step-up": raw } : {}),
        },
        body: JSON.stringify({ reason }),
      },
      bindings,
    )
  const read = (namespace = "example-source", resourcePath = path) =>
    app.request(
      `${resourcePath}/${id}`,
      {
        headers: { authorization: `Bearer ${token}` },
      },
      { ...bindings, RECORD_SOURCE_NAMESPACE: namespace },
    )
  expect((await write("", true, "invalid-token")).status).toBe(401)
  expect((await write()).status).toBe(403)
  await c.database
    .prepare(`INSERT OR IGNORE INTO system_iam_role_permissions (role_id,permission_key)
    SELECT role_id,'system:admin' FROM system_role_bindings WHERE account_id=?1`)
    .bind(c.requester.accountId)
    .run()
  expect((await write("", false)).status).toBe(403)
  expect((await write("", true, token, "invalid-key")).status).toBe(400)
  const created = await write()
  expect(created.status).toBe(201)
  expect(created.headers.get("cache-control")).toBe("no-store")
  expect(await created.json()).toMatchObject({
    kind: "created",
    freeze: { id, ownerContext: "expense", revision: 1 },
  })
  expect((await write()).status).toBe(200)
  expect((await write("", true, token, id, "Different reason")).status).toBe(409)
  expect((await write("", true, token, crypto.randomUUID())).status).toBe(409)
  const active = await read()
  expect(active.status).toBe(200)
  expect(active.headers.get("cache-control")).toBe("no-store")
  expect(await active.json()).toMatchObject({ freeze: { id, revision: 1, release: null } })
  expect((await read("other-source")).status).toBe(404)
  expect((await read("example-source", "/attendance/record-source-freezes")).status).toBe(404)
  expect(
    (
      await app.request(
        `${path}/${id}`,
        {
          headers: { authorization: `Bearer ${token}` },
        },
        { ...bindings, DISABLED_DEFAULT_APPS: "expenses" },
      )
    ).status,
  ).toBe(404)
  await execSql(
    c.database,
    "DELETE FROM system_iam_role_permissions WHERE permission_key='system:admin'",
  )
  expect((await read()).status).toBe(403)
  expect((await write(`/${id}/release`)).status).toBe(403)
  await c.database
    .prepare(`INSERT OR IGNORE INTO system_iam_role_permissions (role_id,permission_key)
    SELECT role_id,'system:admin' FROM system_role_bindings WHERE account_id=?1`)
    .bind(c.requester.accountId)
    .run()
  expect((await write(`/${id}/release`, false)).status).toBe(403)
  expect((await write(`/${id}/release`)).status).toBe(200)
  expect((await write(`/${id}/release`)).status).toBe(200)
  expect(await (await read()).json()).toMatchObject({ freeze: { id, revision: 2 } })
  expect((await write()).status).toBe(200)
  expect(await (await read()).json()).toMatchObject({ freeze: { id, revision: 2 } })
  await c.database
    .prepare("UPDATE system_accounts SET token_version=1 WHERE id=?1")
    .bind(c.requester.accountId)
    .run()
  expect((await read()).status).toBe(401)
  expect((await write(`/${id}/release`)).status).toBe(401)
  expect(
    await c.database
      .prepare(
        "SELECT count(*) AS n FROM system_audit_events WHERE target_type='system:record-source-freeze'",
      )
      .first<number>("n"),
  ).toBe(2)
})
