import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { wrapSystemD1TestDatabase } from "@system/test/wrap-system-d1-test-database.test-support"
import { zAccessTokenClaims } from "@system/domain/schemas/auth/access-token-claims.schema"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { SystemWorkAuthorizationAdapter } from "@system/infrastructure/adapters/work/system-work-authorization.adapter"
import { SystemWorkItemRepository } from "@system/infrastructure/repositories/work/system-work-item.repository"

/** 他のcontextと製品migrationを使わず、作業の権限・監査・証拠を検証する。 */
export async function createSystemWorkTestFixture() {
  const sqlite = new Database(":memory:")
  sqlite.exec("PRAGMA foreign_keys=ON")
  for (const file of [
    "system-core",
    "system-integration",
    "system-principal",
    "system-attachment",
    "system-work-item",
  ])
    sqlite.exec(
      readFileSync(new URL(`../infrastructure/schema/${file}.sql`, import.meta.url), "utf8"),
    )
  const db = wrapSystemD1TestDatabase(sqlite)
  const clock = { now: new Date() }
  const issuedAt = clock.now.getTime() - 1000
  const stepUpToken =
    crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "")
  const stepUpTokens = new Map<string, string>()
  for (const account of ["owner", "worker", "recipient", "other", "admin"]) {
    sqlite
      .query(
        "INSERT INTO system_accounts (id,status,token_version,created_at,updated_at) VALUES (?1,'active',0,100,100)",
      )
      .run(account)
    sqlite
      .query(
        "INSERT INTO system_principals (id,account_id,kind,name,revision,created_at,updated_at) VALUES (?1,?2,?3,'Test operator',1,100,100)",
      )
      .run(`principal:${account}`, account, account === "worker" ? "agent" : "human")
    sqlite
      .query(
        "INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at) VALUES (?1,?1,'custom','Test role',100,100)",
      )
      .run(`role:${account}`)
    for (const permission of account === "admin"
      ? ["system:admin"]
      : [
          "system:work:read",
          "system:work:create",
          "system:work:perform",
          "system:work:review",
          "system:work:manage",
        ])
      sqlite
        .query("INSERT INTO system_iam_role_permissions VALUES (?1,?2)")
        .run(`role:${account}`, permission)
    sqlite
      .query(
        "INSERT INTO system_role_bindings (id,account_id,role_id,created_at) VALUES (?1,?2,?3,100)",
      )
      .run(`binding:${account}`, account, `role:${account}`)
    if (account !== "worker") {
      const raw = await new SystemPrincipalSecretService().hashRawSecret(`${stepUpToken}${account}`)
      if (raw instanceof Error) throw raw
      stepUpTokens.set(account, raw)
      const hash = await new SystemPrincipalSecretService().hashRawSecret(raw)
      if (hash instanceof Error) throw hash
      sqlite
        .query(`INSERT INTO system_step_up_grants (id,account_id,token_hash,method,issued_at,expires_at,last_used_at)
        VALUES (?1,?2,?3,'password',?4,?5,?4)`)
        .run(`stepup:${account}`, account, hash, issuedAt, issuedAt + 300000)
    }
  }
  sqlite
    .query(`INSERT INTO system_machine_credentials (id,principal_id,name,secret_hash,status,created_at,updated_at,last_used_at)
    VALUES ('credential:worker','principal:worker','Test credential',?1,'active',100,?2,?2)`)
    .run("a".repeat(64), issuedAt)
  function claims(account: string) {
    return zAccessTokenClaims.parse({
      sub: account,
      ver: 0,
      purpose: "api-session",
      iss: "test",
      aud: "test",
      jti: crypto.randomUUID(),
      iat: Math.floor(issuedAt / 1000),
      issuedAtMs: issuedAt,
      exp: Math.floor(issuedAt / 1000) + 3600,
      ...(account === "worker" ? { machineCredentialId: "credential:worker" } : {}),
    })
  }
  function adapter(account: string, identityBindingId: string | null = null) {
    return new SystemWorkAuthorizationAdapter({
      env: { DB: db },
      var: { now: () => clock.now },
      authentication: {
        accountId: claims(account).sub,
        tokenVersion: claims(account).ver,
        issuedAtMs: claims(account).issuedAtMs,
        expiresAtMs: claims(account).exp * 1000,
        machineCredentialId: claims(account).machineCredentialId ?? null,
        identityBindingId,
      },
    })
  }
  async function authorized(
    account: string,
    permission = "system:work:read",
    protectedOperation = false,
  ) {
    const authorization = await adapter(account).prepare({
      permission,
      stepUpToken: protectedOperation ? (stepUpTokens.get(account) ?? "") : null,
    })
    if (authorization instanceof Error) throw authorization
    return {
      authorization,
      repository: new SystemWorkItemRepository({ env: { DB: db }, authorization }),
    }
  }
  return { sqlite, db, clock, claims, adapter, authorized, stepUpTokens }
}
