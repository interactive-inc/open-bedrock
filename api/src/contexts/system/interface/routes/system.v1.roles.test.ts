import { zAccountId } from "@system/domain/auth/account-id"
import { createSystemSessionApplications } from "@system/interface/runtime/create-system-session-applications"
import { SystemSessionTestContext } from "@system/infrastructure/auth/system-session-test-context.test-support"
import { systemFactory } from "@system/interface/http/system-factory"
import { DELETE, GET as GET_ONE, PATCH } from "@system/interface/routes/system.v1.roles.$roleId"
import { GET as GET_MANY, POST } from "@system/interface/routes/system.v1.roles"
import { describe, expect, test } from "bun:test"
import { hc } from "hono/client"

const now = new Date("2026-01-01T00:00:00.000Z")
const rootAccountId = zAccountId.parse("system-role-root")

describe("System Role HTTP", () => {
  test("custom Roleの作成・一覧・詳細・変更・削除をSystemだけで完結する", async () => {
    const fixture = new SystemSessionTestContext()
    fixture.sqlite
      .query(
        `INSERT INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?2, ?2)`,
      )
      .run(rootAccountId, now.getTime())
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
         VALUES ('root-role', 'system:root', 'managed', 'System root', NULL, ?1, ?1)`,
      )
      .run(now.getTime())
    fixture.sqlite
      .query(
        `INSERT INTO system_iam_role_permissions (role_id, permission_key)
         VALUES ('root-role', 'iam:read'),
                ('root-role', 'iam:write'),
                ('root-role', 'system:admin')`,
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
      jwtSecret: "system-session-test-jwt-secret",
      sessionTtlMilliseconds: 604_800_000,
    })
    expect(applications).not.toBeInstanceOf(Error)
    if (applications instanceof Error) return
    const issuance = await applications.issue.execute({
      accountId: rootAccountId,
      tokenVersion: 0,
      now: new Date(),
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
      .get("/system/v1/roles", ...GET_MANY)
      .post("/system/v1/roles", ...POST)
      .get("/system/v1/roles/:roleId", ...GET_ONE)
      .patch("/system/v1/roles/:roleId", ...PATCH)
      .delete("/system/v1/roles/:roleId", ...DELETE)
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        JWT_SECRET: "system-session-test-jwt-secret",
      })
    const client = hc<typeof app>("http://system.test", {
      fetch: request,
      headers: { authorization: `Bearer ${issuance.accessToken}` },
    })

    const created = await client.system.v1.roles.$post({
      json: {
        key: "company:reader",
        name: "Company reader",
        description: "Reads Company records",
        permission_keys: ["company:read"],
      },
    })
    expect(created.status).toBe(201)
    const createdBody = await created.json()
    expect("id" in createdBody).toBe(true)
    if (!("id" in createdBody)) return
    expect(createdBody).toMatchObject({ key: "company:reader", kind: "custom" })

    const listed = await client.system.v1.roles.$get()
    expect(listed.status).toBe(200)
    const listedBody = await listed.json()
    expect("total" in listedBody).toBe(true)
    if (!("total" in listedBody)) return
    expect(listedBody.total).toBe(2)

    const detailed = await client.system.v1.roles[":roleId"].$get({
      param: { roleId: createdBody.id },
    })
    expect(detailed.status).toBe(200)
    expect(await detailed.json()).toMatchObject({ permission_keys: ["company:read"] })

    const updated = await client.system.v1.roles[":roleId"].$patch({
      param: { roleId: createdBody.id },
      json: {
        name: "Company editor",
        description: "Reads and writes Company records",
        permission_keys: ["company:write", "company:read"],
      },
    })
    expect(updated.status).toBe(200)
    expect(await updated.json()).toMatchObject({
      name: "Company editor",
      permission_keys: ["company:read", "company:write"],
    })

    const managedDeletion = await client.system.v1.roles[":roleId"].$delete({
      param: { roleId: "root-role" },
    })
    expect(Number(managedDeletion.status)).toBe(409)

    const deleted = await client.system.v1.roles[":roleId"].$delete({
      param: { roleId: createdBody.id },
    })
    expect(deleted.status).toBe(204)
    expect(
      fixture.sqlite
        .query(
          `SELECT count(*) AS total
           FROM system_audit_events
           WHERE action LIKE 'system.iam.role.%'`,
        )
        .get(),
    ).toEqual({ total: 3 })
  })
})
