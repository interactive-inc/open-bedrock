import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { seedSystemStepUpGrant } from "@system/test/seed-system-step-up-grant.test-support"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { GET as GET_ONE, PATCH } from "@system/interface/routes/system.accounts.$accountId"
import { GET as GET_MANY, POST } from "@system/interface/routes/system.accounts"
import { describe, expect, test } from "bun:test"
import { hc } from "hono/client"

const now = new Date("2026-01-01T00:00:00.000Z")
const rootAccountId = zAccountId.parse("system-root-account")
const delegatedAdministratorAccountId = zAccountId.parse("delegated-administrator-account")
const scopedPrivilegedAccountId = zAccountId.parse("scoped-privileged-account")

describe("System AccountEntity HTTP", () => {
  test("AccountEntity作成・一覧・詳細・失効と自己停止拒否をSystemだけで完結する", async () => {
    const fixture = new SystemSessionTestContext()
    fixture.sqlite
      .query(
        `INSERT INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?2, ?2)`,
      )
      .run(rootAccountId, now.getTime())
    const rootStepUpToken = await seedSystemStepUpGrant(fixture, rootAccountId, now)
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
           (id, key, kind, name, created_at, updated_at)
         VALUES ('af285551-000d-4320-8ea0-bbfbc6c96a81', 'system:root', 'managed', 'System root', ?1, ?1)`,
      )
      .run(now.getTime())
    fixture.sqlite
      .query(
        `INSERT INTO system_iam_role_permissions (role_id, permission_key)
         VALUES ('af285551-000d-4320-8ea0-bbfbc6c96a81', 'iam:read'),
                ('af285551-000d-4320-8ea0-bbfbc6c96a81', 'iam:write'),
                ('af285551-000d-4320-8ea0-bbfbc6c96a81', 'system:admin')`,
      )
      .run()
    fixture.sqlite
      .query(
        `INSERT INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
         VALUES ('f16b950f-c6db-4760-8994-95cc8065169d', ?1, 'af285551-000d-4320-8ea0-bbfbc6c96a81', NULL, NULL, ?2, NULL)`,
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
      .get("/system/accounts", ...GET_MANY)
      .post("/system/accounts", ...POST)
      .get("/system/accounts/:accountId", ...GET_ONE)
      .patch("/system/accounts/:accountId", ...PATCH)
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
      headers: {
        authorization: `Bearer ${issuance.accessToken}`,
        "x-system-step-up": rootStepUpToken,
      },
    })
    const unsteppedClient = hc<typeof app>("http://system.test", {
      fetch: request,
      headers: { authorization: `Bearer ${issuance.accessToken}` },
    })
    expect(Number((await unsteppedClient.system.accounts.$post()).status)).toBe(403)

    const created = await client.system.accounts.$post()
    expect(created.status).toBe(201)
    const createdBody = await created.json()
    expect("id" in createdBody).toBe(true)
    if (!("id" in createdBody)) return
    expect(createdBody.status).toBe("active")
    expect(createdBody.role_keys).toEqual([])

    const listed = await client.system.accounts.$get()
    expect(listed.status).toBe(200)
    const listedBody = await listed.json()
    expect("total" in listedBody).toBe(true)
    if (!("total" in listedBody)) return
    expect(listedBody.total).toBe(2)

    const detailed = await client.system.accounts[":accountId"].$get({
      param: { accountId: createdBody.id },
    })
    expect(detailed.status).toBe(200)
    expect(await detailed.json()).toMatchObject({ id: createdBody.id, token_version: 0 })

    const suspended = await client.system.accounts[":accountId"].$patch({
      param: { accountId: createdBody.id },
      json: { status: "suspended" },
    })
    expect(suspended.status).toBe(200)
    expect(await suspended.json()).toMatchObject({ status: "suspended", token_version: 1 })

    const selfSuspension = await client.system.accounts[":accountId"].$patch({
      param: { accountId: rootAccountId },
      json: { status: "suspended" },
    })
    expect(Number(selfSuspension.status)).toBe(403)
    expect(
      fixture.sqlite
        .query(
          `SELECT count(*) AS total
           FROM system_audit_events
           WHERE action IN ('system.account.created', 'system.account.status_updated')`,
        )
        .get(),
    ).toEqual({ total: 2 })

    fixture.sqlite
      .query(
        `INSERT INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?3, ?3),
                (?2, 'active', 0, ?3, ?3)`,
      )
      .run(delegatedAdministratorAccountId, scopedPrivilegedAccountId, now.getTime())
    const delegatedStepUpToken = await seedSystemStepUpGrant(
      fixture,
      delegatedAdministratorAccountId,
      now,
    )
    fixture.sqlite
      .query(
        `INSERT INTO system_iam_roles
           (id, key, kind, name, created_at, updated_at)
         VALUES ('adbf4688-13c3-46e8-8262-1ed64af62d89', 'system:delegated-administrator', 'custom',
                 'Delegated administrator', ?1, ?1),
                ('92d93d3c-f92a-4336-86b6-65d1d1556667', 'example:privileged', 'custom',
                 'Scoped privileged role', ?1, ?1)`,
      )
      .run(now.getTime())
    fixture.sqlite
      .query(
        `INSERT INTO system_iam_role_permissions (role_id, permission_key)
         VALUES ('adbf4688-13c3-46e8-8262-1ed64af62d89', 'iam:write'),
                ('92d93d3c-f92a-4336-86b6-65d1d1556667', 'example:privileged')`,
      )
      .run()
    fixture.sqlite
      .query(
        `INSERT INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
         VALUES ('d47efb56-f8b4-4b94-8844-caf7c69588bf', ?1, 'adbf4688-13c3-46e8-8262-1ed64af62d89',
                 NULL, NULL, ?3, NULL),
                ('730ad3cb-8822-4e20-8e2e-868e04df129e', ?2, '92d93d3c-f92a-4336-86b6-65d1d1556667',
                 'example:organization', 'organization-1', ?3, NULL)`,
      )
      .run(delegatedAdministratorAccountId, scopedPrivilegedAccountId, now.getTime())
    const delegatedAdministratorIssuance = await applications.issue.execute({
      accountId: delegatedAdministratorAccountId,
      tokenVersion: 0,
      now: new Date(),
      auditContext: { authorizationJson: null, metadataJson: null },
    })
    expect(delegatedAdministratorIssuance).not.toBeInstanceOf(Error)
    if (
      delegatedAdministratorIssuance instanceof Error ||
      delegatedAdministratorIssuance.kind === "rejected"
    ) {
      return
    }
    const delegatedAdministratorClient = hc<typeof app>("http://system.test", {
      fetch: request,
      headers: {
        authorization: `Bearer ${delegatedAdministratorIssuance.accessToken}`,
        "x-system-step-up": delegatedStepUpToken,
      },
    })

    const scopedPrivilegeDenial = await delegatedAdministratorClient.system.accounts[
      ":accountId"
    ].$patch({
      param: { accountId: scopedPrivilegedAccountId },
      json: { status: "suspended" },
    })
    expect(Number(scopedPrivilegeDenial.status)).toBe(403)
    expect(
      fixture.sqlite
        .query("SELECT status, token_version FROM system_accounts WHERE id = ?1")
        .get(scopedPrivilegedAccountId),
    ).toEqual({ status: "active", token_version: 0 })
  })
})
