import { zAccountId } from "@system/domain/auth/account-id"
import { createSystemSessionApplications } from "@system/infrastructure/auth/create-system-session-applications"
import { SystemSessionTestContext } from "@system/infrastructure/auth/system-session-test-context.test-support"
import { systemFactory } from "@system/interface/http/system-factory"
import { DELETE } from "@system/interface/routes/system.v1.accounts.$accountId.role-bindings.$bindingId"
import { GET, POST } from "@system/interface/routes/system.v1.accounts.$accountId.role-bindings"
import { describe, expect, test } from "bun:test"
import { hc } from "hono/client"

const now = new Date("2026-01-01T00:00:00.000Z")
const rootAccountId = zAccountId.parse("system-binding-root")
const targetAccountId = zAccountId.parse("system-binding-target")

describe("System Role Binding HTTP", () => {
  test("付与・一覧・失効・自己付与拒否・last-rootをSystemだけで完結する", async () => {
    const fixture = new SystemSessionTestContext()
    fixture.sqlite
      .query(
        `INSERT INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?3, ?3), (?2, 'active', 0, ?3, ?3)`,
      )
      .run(rootAccountId, targetAccountId, now.getTime())
    fixture.sqlite
      .query(
        `INSERT INTO system_identity_bindings
           (id, account_id, provider, subject, created_at, activated_at, revoked_at)
         VALUES ('root-identity', ?1, 'password', 'root@example.com', ?2, ?2, NULL)`,
      )
      .run(rootAccountId, now.getTime())
    fixture.sqlite
      .query(
        `INSERT INTO system_iam_roles
           (id, key, kind, name, description, created_at, updated_at)
         VALUES ('root-role', 'system:root', 'managed', 'System root', NULL, ?1, ?1),
                ('reader-role', 'company:reader', 'custom', 'Company reader', NULL, ?1, ?1)`,
      )
      .run(now.getTime())
    fixture.sqlite
      .query(
        `INSERT INTO system_iam_role_permissions (role_id, permission_key)
         VALUES ('root-role', 'iam:read'),
                ('root-role', 'iam:write'),
                ('root-role', 'system:admin'),
                ('reader-role', 'company:read')`,
      )
      .run()
    fixture.sqlite
      .query(
        `INSERT INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
         VALUES ('root-binding', ?1, 'root-role', NULL, NULL, ?2, NULL)`,
      )
      .run(rootAccountId, now.getTime())

    const applications = createSystemSessionApplications({
      context: fixture.context,
      sessionTtlMilliseconds: 604_800_000,
    })
    expect(applications).not.toBeInstanceOf(Error)
    if (applications instanceof Error) return
    const issuance = await applications.issue.execute({
      accountId: rootAccountId,
      tokenVersion: 0,
      now,
      auditContext: { authorizationJson: null, metadataJson: null },
    })
    expect(issuance).not.toBeInstanceOf(Error)
    if (issuance instanceof Error || issuance.kind === "rejected") return

    const app = systemFactory
      .createApp()
      .use("*", async (context, next) => {
        context.set("now", () => now)
        await next()
      })
      .get("/system/v1/accounts/:accountId/role-bindings", ...GET)
      .post("/system/v1/accounts/:accountId/role-bindings", ...POST)
      .delete("/system/v1/accounts/:accountId/role-bindings/:bindingId", ...DELETE)
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) => app.request(input, init, { DB: fixture.context.env.DB })
    const client = hc<typeof app>("http://system.test", {
      fetch: request,
      headers: { authorization: `Bearer ${issuance.rawToken}` },
    })

    const created = await client.system.v1.accounts[":accountId"]["role-bindings"].$post({
      param: { accountId: targetAccountId },
      json: { role_id: "reader-role", resource: null },
    })
    expect(created.status).toBe(201)
    const createdBody = await created.json()
    expect("id" in createdBody).toBe(true)
    if (!("id" in createdBody)) return
    expect(createdBody).toMatchObject({ account_id: targetAccountId, role_id: "reader-role" })
    expect(
      fixture.sqlite
        .query("SELECT token_version FROM system_accounts WHERE id = ?1")
        .get(targetAccountId),
    ).toEqual({ token_version: 1 })

    const listed = await client.system.v1.accounts[":accountId"]["role-bindings"].$get({
      param: { accountId: targetAccountId },
    })
    expect(listed.status).toBe(200)
    const listedBody = await listed.json()
    expect("total" in listedBody).toBe(true)
    if (!("total" in listedBody)) return
    expect(listedBody.total).toBe(1)

    const selfAssignment = await client.system.v1.accounts[":accountId"]["role-bindings"].$post({
      param: { accountId: rootAccountId },
      json: { role_id: "reader-role", resource: null },
    })
    expect(selfAssignment.status).toBe(403)

    const lastRoot = await client.system.v1.accounts[":accountId"]["role-bindings"][
      ":bindingId"
    ].$delete({
      param: { accountId: rootAccountId, bindingId: "root-binding" },
    })
    expect(lastRoot.status).toBe(409)

    const revoked = await client.system.v1.accounts[":accountId"]["role-bindings"][
      ":bindingId"
    ].$delete({
      param: { accountId: targetAccountId, bindingId: createdBody.id },
    })
    expect(revoked.status).toBe(204)
    expect(
      fixture.sqlite
        .query("SELECT token_version FROM system_accounts WHERE id = ?1")
        .get(targetAccountId),
    ).toEqual({ token_version: 2 })
    expect(
      fixture.sqlite
        .query(
          `SELECT count(*) AS total
           FROM system_audit_events
           WHERE action LIKE 'system.iam.role_binding.%'`,
        )
        .get(),
    ).toEqual({ total: 2 })
  })
})
