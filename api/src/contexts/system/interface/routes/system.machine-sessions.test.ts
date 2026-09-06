import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemMachineCredentialRepository } from "@system/infrastructure/repositories/iam/system-machine-credential.repository"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { POST } from "@system/interface/routes/system.machine-sessions"
import { GET } from "@system/interface/routes/system.principals"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { afterEach, describe, expect, test } from "bun:test"
import { decodeJwt } from "jose"
import { z } from "zod"

const secret = "machine-session-test-signing-secret"
const rawCredential = "1".repeat(64)
const fixtures: Array<SystemSessionTestContext> = []

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.sqlite.close()
})

async function createFixture(kind: "agent" | "service" | "connector" = "service") {
  const fixture = new SystemSessionTestContext()
  fixtures.push(fixture)
  const clock = { at: new Date() }
  const createdAt = clock.at.getTime() - 1_000
  const expiresAt = clock.at.getTime() + 60_000
  const hash = await new SystemPrincipalSecretService().hashRawSecret(rawCredential)
  if (hash instanceof Error) throw hash
  fixture.sqlite
    .query(
      `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES ('machine-account', 'active', 0, ?1, ?1)`,
    )
    .run(createdAt)
  if (kind === "connector") {
    fixture.sqlite
      .query(
        `INSERT INTO system_connectors
         (id, key, name, direction, transport, status, revision, created_at, updated_at)
         VALUES ('connector-1', 'inbound-test', 'Inbound', 'inbound', 'api', 'active', 1, ?1, ?1)`,
      )
      .run(createdAt)
  }
  fixture.sqlite
    .query(
      `INSERT INTO system_principals
       (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
       VALUES ('machine-principal', 'machine-account', ?1, 'Automation', ?2, 1, ?3, ?3)`,
    )
    .run(kind, kind === "connector" ? "connector-1" : null, createdAt)
  fixture.sqlite
    .query(
      `INSERT INTO system_machine_credentials
       (id, principal_id, name, secret_hash, status, created_at, updated_at, expires_at)
       VALUES ('credential-1', 'machine-principal', 'Primary', ?1, 'active', ?2, ?2, ?3)`,
    )
    .run(hash, createdAt, expiresAt)
  fixture.sqlite.exec(`
    INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at)
    VALUES ('reader-role', 'system:reader', 'custom', 'Reader', 1, 1);
    INSERT INTO system_iam_role_permissions (role_id, permission_key)
    VALUES ('reader-role', 'iam:read');
    INSERT INTO system_role_bindings
    (id, account_id, role_id, created_at, revoked_at)
    VALUES ('reader-binding', 'machine-account', 'reader-role', 1, NULL);
  `)
  const app = systemFactory.createApp()
  app.use("*", async (context, next) => {
    context.set("now", () => clock.at)
    await next()
  })
  const routes = app.post("/system/machine-sessions", ...POST).get("/system/principals", ...GET)
  const request = (path: string, init?: RequestInit) =>
    routes.request(path, init, {
      DB: fixture.context.env.DB,
      JWT_SECRET: secret,
      NOW: clock.at.toISOString(),
    })
  const issue = (credentialId = "credential-1", credentialSecret = rawCredential) =>
    request("/system/machine-sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential_id: credentialId, secret: credentialSecret }),
    })
  const read = (token: string) =>
    request("/system/principals", { headers: { authorization: `Bearer ${token}` } })
  return { fixture, clock, hash, issue, read }
}

async function issuedToken(response: Response): Promise<string> {
  expect(response.status).toBe(201)
  return z.object({ access_token: z.string() }).parse(await response.json()).access_token
}

describe("System machine access token", () => {
  test("一つのcredentialの失効で同じAccountの別credentialまで失効させない", async () => {
    const context = await createFixture()
    const firstToken = await issuedToken(await context.issue())
    const secondSecret = "2".repeat(64)
    const secondHash = await new SystemPrincipalSecretService().hashRawSecret(secondSecret)
    if (secondHash instanceof Error) throw secondHash
    context.fixture.sqlite
      .query(`INSERT INTO system_machine_credentials
      (id, principal_id, name, secret_hash, status, created_at, updated_at)
      VALUES ('credential-2', 'machine-principal', 'Secondary', ?1, 'active', ?2, ?2)`)
      .run(secondHash, context.clock.at.getTime())
    const secondToken = await issuedToken(await context.issue("credential-2", secondSecret))
    expect((await context.read(firstToken)).status).toBe(200)
    expect((await context.read(secondToken)).status).toBe(200)
    expect(
      await new SystemMachineCredentialRepository(context.fixture.context).revoke(
        "machine-principal",
        "credential-1",
        context.clock.at,
        [],
      ),
    ).toBe("revoked")
    expect((await context.read(firstToken)).status).toBe(401)
    expect((await context.read(secondToken)).status).toBe(200)
  })

  test.each(["agent", "service", "connector"] satisfies Array<"agent" | "service" | "connector">)(
    "%sの発行元credentialをtokenへ保持し、失効後は発行済みtokenも拒否する",
    async (kind) => {
      const context = await createFixture(kind)
      const token = await issuedToken(await context.issue())
      expect(decodeJwt(token).machineCredentialId).toBe("credential-1")
      expect((await context.read(token)).status).toBe(200)
      expect(
        await new SystemMachineCredentialRepository(context.fixture.context).revoke(
          "machine-principal",
          "credential-1",
          context.clock.at,
          [],
        ),
      ).toBe("revoked")
      expect((await context.read(token)).status).toBe(401)
      expect((await context.issue()).status).toBe(401)
    },
  )

  test("credentialの期限到達でJWTの期限内でも利用できなくなる", async () => {
    const context = await createFixture()
    const token = await issuedToken(await context.issue())
    context.clock.at = new Date(context.clock.at.getTime() + 59_999)
    expect((await context.read(token)).status).toBe(200)
    context.clock.at = new Date(context.clock.at.getTime() + 1)
    expect((await context.read(token)).status).toBe(401)
  })

  test.each(["suspend", "version", "connector"])(
    "%sの変更を発行済みtokenと次のtoken発行の両方へ反映する",
    async (change) => {
      const context = await createFixture("connector")
      const token = await issuedToken(await context.issue())
      expect((await context.read(token)).status).toBe(200)
      if (change === "suspend") {
        context.fixture.sqlite.exec("UPDATE system_accounts SET status = 'suspended'")
      } else if (change === "version") {
        context.fixture.sqlite.exec("UPDATE system_accounts SET token_version = token_version + 1")
      } else {
        context.fixture.sqlite.exec(
          "UPDATE system_connectors SET status = 'disabled', revision = revision + 1",
        )
      }
      expect((await context.read(token)).status).toBe(401)
      expect((await context.issue()).status).toBe(change === "version" ? 201 : 401)
    },
  )

  test("発行元のない旧機械tokenと別credentialを指定したtokenを拒否する", async () => {
    const context = await createFixture()
    await issuedToken(await context.issue())
    for (const machineCredentialId of [undefined, "unknown-credential"]) {
      const token = await new SystemAccessTokenIssuer(secret).issue({
        accountId: zAccountId.parse("machine-account"),
        tokenVersion: 0,
        machineCredentialId,
        now: context.clock.at,
      })
      expect(token).not.toBeInstanceOf(Error)
      if (token instanceof Error) throw token
      expect((await context.read(token)).status).toBe(401)
    }
  })

  test("機械tokenでも権限が失効した後は操作を許可しない", async () => {
    const context = await createFixture()
    const token = await issuedToken(await context.issue())
    expect((await context.read(token)).status).toBe(200)
    context.fixture.sqlite.exec("DELETE FROM system_iam_role_permissions")
    expect((await context.read(token)).status).toBe(403)
  })

  test.each(["suspend", "version", "connector"])(
    "認証読取と確定の間の%s変更で使用記録と監査を確定しない",
    async (change) => {
      const context = await createFixture("connector")
      const result = await new SystemMachineCredentialRepository(
        context.fixture.context,
      ).authenticate("credential-1", context.hash, context.clock.at, () => {
        if (change === "suspend") {
          context.fixture.sqlite.exec("UPDATE system_accounts SET status = 'suspended'")
        } else if (change === "version") {
          context.fixture.sqlite.exec(
            "UPDATE system_accounts SET token_version = token_version + 1",
          )
        } else {
          context.fixture.sqlite.exec(
            "UPDATE system_connectors SET status = 'disabled', revision = revision + 1",
          )
        }
        return [
          context.fixture.context.env.DB.prepare(
            `INSERT INTO system_audit_events
             (event_id, action, target_type, outcome, occurred_at)
             VALUES ('must-not-commit', 'auth.machine_token.issued', 'credential', 'succeeded', 1)`,
          ),
        ]
      })
      expect(result).toEqual({ kind: "rejected" })
      expect(
        context.fixture.sqlite.query("SELECT last_used_at FROM system_machine_credentials").get(),
      ).toEqual({ last_used_at: null })
      expect(
        context.fixture.sqlite.query("SELECT count(*) AS total FROM system_audit_events").get(),
      ).toEqual({ total: 0 })
    },
  )
})
