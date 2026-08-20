import { zAccountId } from "@system/domain/auth/account-id"
import { createSystemSessionApplications } from "@system/interface/runtime/create-system-session-applications"
import { SystemSessionTestContext } from "@system/infrastructure/auth/system-session-test-context.test-support"
import { systemFactory } from "@system/interface/http/system-factory"
import {
  DELETE,
  GET as GET_ONE,
} from "@system/interface/routes/system.v1.accounts.$accountId.identities.$identityId"
import {
  GET as GET_MANY,
  POST,
} from "@system/interface/routes/system.v1.accounts.$accountId.identities"
import { PATCH as RESET_PASSWORD } from "@system/interface/routes/system.v1.accounts.$accountId.password-credentials"
import { describe, expect, test } from "bun:test"
import { hc } from "hono/client"

const now = new Date("2026-01-01T00:00:00.000Z")
const rootAccountId = zAccountId.parse("system-identity-root")
const targetAccountId = zAccountId.parse("system-identity-target")

describe("System Identity HTTP", () => {
  test("外部・password Identityの作成・参照・失効とlast-activeをSystemだけで完結する", async () => {
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
      .get("/system/v1/accounts/:accountId/identities", ...GET_MANY)
      .post("/system/v1/accounts/:accountId/identities", ...POST)
      .get("/system/v1/accounts/:accountId/identities/:identityId", ...GET_ONE)
      .delete("/system/v1/accounts/:accountId/identities/:identityId", ...DELETE)
      .patch("/system/v1/accounts/:accountId/password-credentials", ...RESET_PASSWORD)
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        JWT_SECRET: "system-session-test-jwt-secret",
        PEPPER_SECRET: "system-identity-test-pepper",
      })
    const client = hc<typeof app>("http://system.test", {
      fetch: request,
      headers: { authorization: `Bearer ${issuance.accessToken}` },
    })

    const external = await client.system.v1.accounts[":accountId"].identities.$post({
      param: { accountId: targetAccountId },
      json: {
        provider: "oidc",
        subject: "external-subject-1",
        email: "external@example.com",
        email_verified: true,
      },
    })
    expect(external.status).toBe(201)
    const externalBody = await external.json()
    expect("id" in externalBody).toBe(true)
    if (!("id" in externalBody)) return

    const password = await client.system.v1.accounts[":accountId"].identities.$post({
      param: { accountId: targetAccountId },
      json: {
        provider: "password",
        email: "target@example.com",
        password: "correct horse battery staple",
      },
    })
    expect(password.status).toBe(201)
    const passwordBody = await password.json()
    expect("id" in passwordBody).toBe(true)
    if (!("id" in passwordBody)) return
    expect(
      fixture.sqlite.query("SELECT count(*) AS total FROM system_password_credentials").get(),
    ).toEqual({ total: 1 })
    const passwordHashBefore = fixture.sqlite
      .query("SELECT password_hash FROM system_password_credentials WHERE identity_id = ?1")
      .get(passwordBody.id)
    const passwordReset = await client.system.v1.accounts[":accountId"][
      "password-credentials"
    ].$patch({
      param: { accountId: targetAccountId },
      json: { password: "another correct horse battery staple" },
    })
    expect(passwordReset.status).toBe(204)
    expect(
      fixture.sqlite
        .query("SELECT password_hash FROM system_password_credentials WHERE identity_id = ?1")
        .get(passwordBody.id),
    ).not.toEqual(passwordHashBefore)

    const listed = await client.system.v1.accounts[":accountId"].identities.$get({
      param: { accountId: targetAccountId },
    })
    expect(listed.status).toBe(200)
    const listedBody = await listed.json()
    expect("total" in listedBody).toBe(true)
    if (!("total" in listedBody)) return
    expect(listedBody.total).toBe(2)

    const detailed = await client.system.v1.accounts[":accountId"].identities[":identityId"].$get({
      param: { accountId: targetAccountId, identityId: passwordBody.id },
    })
    expect(detailed.status).toBe(200)
    expect(await detailed.json()).toMatchObject({ provider: "password", state: "active" })

    const revoked = await client.system.v1.accounts[":accountId"].identities[":identityId"].$delete(
      {
        param: { accountId: targetAccountId, identityId: externalBody.id },
      },
    )
    expect(revoked.status).toBe(204)

    const lastActive = await client.system.v1.accounts[":accountId"].identities[
      ":identityId"
    ].$delete({
      param: { accountId: targetAccountId, identityId: passwordBody.id },
    })
    expect(Number(lastActive.status)).toBe(409)
    expect(
      fixture.sqlite
        .query("SELECT token_version FROM system_accounts WHERE id = ?1")
        .get(targetAccountId),
    ).toEqual({ token_version: 4 })
    expect(
      fixture.sqlite
        .query(
          `SELECT count(*) AS total
           FROM system_audit_events
           WHERE action LIKE 'system.identity.%'`,
        )
        .get(),
    ).toEqual({ total: 3 })
    expect(
      fixture.sqlite
        .query(
          `SELECT count(*) AS total
           FROM system_audit_events
           WHERE action = 'system.password_credential.reset'`,
        )
        .get(),
    ).toEqual({ total: 1 })
  })
})
