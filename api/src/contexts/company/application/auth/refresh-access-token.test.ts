import { describe, expect, test } from "bun:test"
import type { AccessTokenView } from "@system/application/auth/access-token-view"
import { RefreshAccessToken } from "@/application/auth/refresh-access-token"
import type { AccountStatus } from "@/contexts/system/domain/auth/account-status"
import type { Context } from "@/env"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { hashAuditIdentifier } from "@/lib/audit/hash-audit-identifier"
import { refreshTokenHash } from "@/lib/auth/refresh-token-hash"
import { UnavailableError } from "@/lib/errors"

const jwtSecret = "refresh-access-token-test-secret"
const now = new Date("2026-01-01T00:00:00.000Z")
const nowEpoch = 1_767_225_600
const familyId = "test-family"

type SetupOptions = {
  expiresAt?: number
  revokedAt?: number | null
  accountStatus?: AccountStatus
  accountTokenVersion?: number
  tokenVersion?: number
  employeeStatus?: "active" | "leave" | "retired"
  includeAccount?: boolean
  includeEmployee?: boolean
  includeToken?: boolean
}

async function setupRefreshToken(rawToken: string, options: SetupOptions = {}) {
  const { context, db } = createTestContext()

  if (options.includeEmployee !== false) {
    await db
      .prepare(
        `INSERT INTO employees (id, code, name, status)
         VALUES (1, 'E001', 'Test Worker', ?1)`,
      )
      .bind(options.employeeStatus ?? "active")
      .run()
  }
  if (options.includeAccount !== false) {
    await db
      .prepare(
        `INSERT INTO accounts
           (id, status, token_version, created_at, updated_at)
         VALUES (1, ?1, ?2, ?3, ?3)`,
      )
      .bind(options.accountStatus ?? "active", options.accountTokenVersion ?? 0, nowEpoch - 100)
      .run()
  }
  if (options.includeAccount !== false && options.includeEmployee !== false) {
    await db
      .prepare("INSERT INTO account_employee_links (account_id, employee_id) VALUES (1, 1)")
      .run()
  }
  if (options.includeToken !== false) {
    await insertRefreshToken(db, {
      id: 1,
      rawToken,
      expiresAt: options.expiresAt ?? nowEpoch + 3_600,
      revokedAt: options.revokedAt ?? null,
      tokenVersion: options.tokenVersion ?? 0,
    })
  }

  return { context, db }
}

async function insertRefreshToken(
  db: D1Database,
  props: {
    id: number
    rawToken: string
    expiresAt?: number
    revokedAt?: number | null
    tokenVersion?: number
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO refresh_tokens
         (id, account_id, token_hash, family_id, token_version, expires_at,
          revoked_at, user_agent, created_at)
       VALUES (?1, 1, ?2, ?3, ?4, ?5, ?6, 'fixture-agent', ?7)`,
    )
    .bind(
      props.id,
      await refreshTokenHash(props.rawToken),
      familyId,
      props.tokenVersion ?? 0,
      props.expiresAt ?? nowEpoch + 3_600,
      props.revokedAt ?? null,
      nowEpoch - 100,
    )
    .run()
}

function command(refreshToken: string, userAgent = "test-agent") {
  return { refreshToken, jwtSecret, userAgent, now }
}

function isIssued(
  result: Awaited<ReturnType<RefreshAccessToken["run"]>>,
): result is AccessTokenView {
  return !(result instanceof Error) && !("reason" in result)
}

function mutateBeforeNextBatch(context: Context, mutation: () => Promise<unknown>): () => number {
  const source = context.env.DB
  let pending = true
  let batchCalls = 0
  context.env.DB = new Proxy(source, {
    get(target, property, receiver) {
      if (property === "batch") {
        return async (statements: Array<D1PreparedStatement>) => {
          batchCalls += 1
          if (pending) {
            pending = false
            await mutation()
          }
          return target.batch(statements)
        }
      }

      return Reflect.get(target, property, receiver)
    },
  })

  return () => batchCalls
}

async function activeFamilyCount(db: D1Database): Promise<number | null> {
  return db
    .prepare(
      "SELECT COUNT(*) AS count FROM refresh_tokens WHERE family_id = ?1 AND revoked_at IS NULL",
    )
    .bind(familyId)
    .first<number>("count")
}

async function markerCount(db: D1Database): Promise<number | null> {
  return db.prepare("SELECT COUNT(*) AS count FROM audit_batch_decisions").first<number>("count")
}

async function auditRows(db: D1Database) {
  return (
    await db
      .prepare(
        `SELECT actor_account_id, actor_employee_id, action, target_type, target_id,
                outcome, reason_code, metadata_json, client_ip, client_name,
                request_id, created_at
         FROM company_audit_events ORDER BY id`,
      )
      .all<{
        actor_account_id: number | null
        actor_employee_id: number | null
        action: string
        target_type: string
        target_id: string | null
        outcome: string
        reason_code: string | null
        metadata_json: string | null
        client_ip: string | null
        client_name: string
        request_id: string
        created_at: number
      }>()
  ).results
}

describe("RefreshAccessToken", () => {
  test("fails closed before every denial branch when the audit HMAC secret is absent or blank", async () => {
    const scenarios: Array<{
      name: string
      options: SetupOptions
      addActiveDescendant?: boolean
    }> = [
      { name: "missing", options: { includeToken: false } },
      { name: "expired", options: { expiresAt: nowEpoch } },
      {
        name: "revoked",
        options: { revokedAt: nowEpoch - 10 },
        addActiveDescendant: true,
      },
      { name: "account-state", options: { accountStatus: "suspended" } },
    ]
    const secretStates = [
      { name: "absent", value: undefined },
      { name: "blank", value: "   " },
    ] as const
    const results: Array<{
      scenario: string
      secret: string
      error: { name: string; message: string; code: string } | null
    }> = []

    for (const scenario of scenarios) {
      for (const secret of secretStates) {
        const rawToken = `${scenario.name}-${secret.name}-hmac-token`
        const { context, db } = await setupRefreshToken(rawToken, scenario.options)
        if (scenario.addActiveDescendant) {
          await insertRefreshToken(db, {
            id: 2,
            rawToken: `${rawToken}-active-descendant`,
          })
        }
        const activeBefore = await activeFamilyCount(db)
        if (secret.value === undefined) {
          delete (context.env as Partial<Context["env"]>).AUDIT_HMAC_SECRET
        } else {
          context.env.AUDIT_HMAC_SECRET = secret.value
        }

        const result = await new RefreshAccessToken(context).run(command(rawToken))

        results.push({
          scenario: scenario.name,
          secret: secret.name,
          error:
            result instanceof UnavailableError
              ? { name: result.name, message: result.message, code: result.code }
              : null,
        })
        expect(result).not.toHaveProperty("accessToken")
        expect(result).not.toHaveProperty("refreshToken")
        expect(await auditRows(db)).toEqual([])
        expect(await activeFamilyCount(db)).toBe(activeBefore)
      }
    }

    expect(results).toEqual(
      scenarios.flatMap((scenario) =>
        secretStates.map((secret) => ({
          scenario: scenario.name,
          secret: secret.name,
          error: {
            name: "UnavailableError",
            message: "invalid or expired refresh token",
            code: "audit_unavailable",
          },
        })),
      ),
    )
  })

  test("records a successful refresh and a later reuse with the same family HMAC", async () => {
    const rawToken = "old-refresh-token"
    const { context, db } = await setupRefreshToken(rawToken)
    context.var.auditContext = {
      requestId: "00000000-0000-4000-8000-000000000041",
      clientName: "cli",
      clientIp: "198.51.100.41",
      externalRequestId: null,
    }
    const service = new RefreshAccessToken(context)

    const first = await service.run(command(rawToken, "first-client"))
    if (!isIssued(first) || first.refreshToken === null) {
      throw new Error("expected the first rotation to succeed")
    }
    expect(first.refreshToken).toMatch(/^[0-9a-f]{64}$/)
    const reused = await service.run(command(rawToken, "second-client"))

    expect(reused).toEqual({ reason: "invalid_token" })
    expect(await activeFamilyCount(db)).toBe(0)
    expect(await markerCount(db)).toBe(0)
    const expectedFamilyHash = await hashAuditIdentifier(
      `refresh-family:${familyId}`,
      context.env.AUDIT_HMAC_SECRET,
    )
    expect(await auditRows(db)).toEqual([
      {
        actor_account_id: 1,
        actor_employee_id: 1,
        action: "auth.session.refreshed",
        target_type: "account",
        target_id: "1",
        outcome: "succeeded",
        reason_code: null,
        metadata_json: `{"family_id_hash":"${expectedFamilyHash}"}`,
        client_ip: "198.51.100.41",
        client_name: "cli",
        request_id: "00000000-0000-4000-8000-000000000041",
        created_at: nowEpoch,
      },
      {
        actor_account_id: null,
        actor_employee_id: null,
        action: "auth.session.reuse_detected",
        target_type: "account",
        target_id: "1",
        outcome: "denied",
        reason_code: "refresh_token_reuse",
        metadata_json: `{"family_id_hash":"${expectedFamilyHash}"}`,
        client_ip: "198.51.100.41",
        client_name: "cli",
        request_id: "00000000-0000-4000-8000-000000000041",
        created_at: nowEpoch,
      },
    ])

    const persisted = JSON.stringify(await db.prepare("SELECT * FROM audit_events").all())
    expect(persisted).not.toContain(rawToken)
    expect(persisted).not.toContain(await refreshTokenHash(rawToken))
    expect(persisted).not.toContain(familyId)
    expect(persisted).not.toContain(first.accessToken)
    expect(persisted).not.toContain(first.refreshToken)
    expect(persisted).not.toContain("first-client")
    expect(persisted).not.toContain("second-client")
  })

  test("issues exactly one descendant and records one success and one reuse concurrently", async () => {
    const rawToken = "concurrent-refresh-token"
    const { context, db } = await setupRefreshToken(rawToken)
    const service = new RefreshAccessToken(context)

    const results = await Promise.all([
      service.run(command(rawToken, "client-a")),
      service.run(command(rawToken, "client-b")),
    ])

    expect(results.filter(isIssued)).toHaveLength(1)
    expect(results.filter((result) => !isIssued(result))).toEqual([{ reason: "invalid_token" }])
    expect(await activeFamilyCount(db)).toBe(0)
    expect((await auditRows(db)).map(({ action, outcome }) => ({ action, outcome }))).toEqual([
      { action: "auth.session.refreshed", outcome: "succeeded" },
      { action: "auth.session.reuse_detected", outcome: "denied" },
    ])
    expect(await markerCount(db)).toBe(0)
  })

  test("records a missing token as a session-targeted invalid denial", async () => {
    const { context, db } = await setupRefreshToken("not-in-database", { includeToken: false })

    const result = await new RefreshAccessToken(context).run(command("missing-refresh-token"))

    expect(result).toEqual({ reason: "invalid_token" })
    expect(await auditRows(db)).toMatchObject([
      {
        actor_account_id: null,
        actor_employee_id: null,
        action: "auth.session.refreshed",
        target_type: "session",
        target_id: null,
        outcome: "denied",
        reason_code: "invalid_token",
        metadata_json: null,
      },
    ])
  })

  test("records an expired token as an account-targeted invalid denial", async () => {
    const rawToken = "expired-refresh-token"
    const { context, db } = await setupRefreshToken(rawToken, { expiresAt: nowEpoch })

    const result = await new RefreshAccessToken(context).run(command(rawToken))

    expect(result).toEqual({ reason: "invalid_token" })
    expect(await auditRows(db)).toMatchObject([
      {
        actor_account_id: null,
        actor_employee_id: null,
        action: "auth.session.refreshed",
        target_type: "account",
        target_id: "1",
        outcome: "denied",
        reason_code: "invalid_token",
      },
    ])
  })

  test.each([
    ["suspended account", { accountStatus: "suspended" as const }],
    ["locked account", { accountStatus: "locked" as const }],
    ["token version mismatch", { accountTokenVersion: 1 }],
    ["missing employee", { includeEmployee: false }],
    ["retired employee", { employeeStatus: "retired" as const }],
  ])("revokes and records invalid_token for a %s", async (_, options) => {
    const rawToken = `invalid-${String(_).replaceAll(" ", "-")}`
    const { context, db } = await setupRefreshToken(rawToken, options)

    const result = await new RefreshAccessToken(context).run(command(rawToken))

    expect(result).toEqual({ reason: "invalid_token" })
    expect(await activeFamilyCount(db)).toBe(0)
    expect(
      (await auditRows(db)).map(({ action, outcome, reason_code }) => ({
        action,
        outcome,
        reason_code,
      })),
    ).toEqual([
      { action: "auth.session.refreshed", outcome: "denied", reason_code: "invalid_token" },
    ])
  })

  test.each([
    ["missing", "DELETE FROM system_accounts WHERE id = '1'"],
    [
      "suspended",
      "UPDATE system_accounts SET status = 'suspended', token_version = 1 WHERE id = '1'",
    ],
    ["locked", "UPDATE system_accounts SET status = 'locked', token_version = 1 WHERE id = '1'"],
    ["token version drift", "UPDATE system_accounts SET token_version = 1 WHERE id = '1'"],
  ])("revokes the family when the canonical account is %s", async (_, sql) => {
    const rawToken = `canonical-${String(_).replaceAll(" ", "-")}`
    const { context, db } = await setupRefreshToken(rawToken)
    await db.exec(sql)

    const result = await new RefreshAccessToken(context).run(command(rawToken))

    expect(result).toEqual({ reason: "invalid_token" })
    expect(await activeFamilyCount(db)).toBe(0)
    expect(
      (await auditRows(db)).map(({ action, outcome, reason_code }) => ({
        action,
        outcome,
        reason_code,
      })),
    ).toEqual([
      { action: "auth.session.refreshed", outcome: "denied", reason_code: "invalid_token" },
    ])
  })

  test("fails closed without rotating when the canonical account cannot be read", async () => {
    const rawToken = "canonical-read-error"
    const { context, db } = await setupRefreshToken(rawToken)
    await db.exec("DROP TABLE system_accounts")

    const result = await new RefreshAccessToken(context).run(command(rawToken))

    expect(result).toBeInstanceOf(Error)
    expect(result).toMatchObject({ code: "unexpected" })
    expect(await activeFamilyCount(db)).toBe(1)
    expect(await auditRows(db)).toEqual([])
  })

  test("revokes and records reuse when the token was already revoked", async () => {
    const rawToken = "revoked-refresh-token"
    const { context, db } = await setupRefreshToken(rawToken, { revokedAt: nowEpoch - 10 })
    await insertRefreshToken(db, { id: 2, rawToken: "active-descendant" })

    const result = await new RefreshAccessToken(context).run(command(rawToken))

    expect(result).toEqual({ reason: "invalid_token" })
    expect(await activeFamilyCount(db)).toBe(0)
    expect(
      (await auditRows(db)).map(({ action, outcome, reason_code }) => ({
        action,
        outcome,
        reason_code,
      })),
    ).toEqual([
      {
        action: "auth.session.reuse_detected",
        outcome: "denied",
        reason_code: "refresh_token_reuse",
      },
    ])
  })

  test.each([
    [
      "account suspension",
      `UPDATE accounts
       SET status = 'suspended', token_version = token_version + 1, updated_at = updated_at + 1
       WHERE id = 1`,
    ],
    ["token version bump", "UPDATE accounts SET token_version = token_version + 1 WHERE id = 1"],
    ["employee retirement", "UPDATE employees SET status = 'retired' WHERE id = 1"],
    [
      "canonical account suspension",
      "UPDATE system_accounts SET status = 'suspended', token_version = 1 WHERE id = '1'",
    ],
    [
      "canonical token version bump",
      "UPDATE system_accounts SET token_version = token_version + 1 WHERE id = '1'",
    ],
  ])("records invalid and returns no token after a live %s race", async (_, mutationSql) => {
    const rawToken = `race-${String(_).replaceAll(" ", "-")}`
    const { context, db } = await setupRefreshToken(rawToken)
    const batchCalls = mutateBeforeNextBatch(context, () => db.prepare(mutationSql).run())

    const result = await new RefreshAccessToken(context).run(command(rawToken))

    expect(result).toEqual({ reason: "invalid_token" })
    expect(batchCalls()).toBe(1)
    expect(await activeFamilyCount(db)).toBe(0)
    expect(
      (await auditRows(db)).map(({ action, outcome, reason_code }) => ({
        action,
        outcome,
        reason_code,
      })),
    ).toEqual([
      { action: "auth.session.refreshed", outcome: "denied", reason_code: "invalid_token" },
    ])
    expect(await markerCount(db)).toBe(0)
  })

  test("fails closed when the old token row disappears after the initial read", async () => {
    const rawToken = "deleted-after-read"
    const { context, db } = await setupRefreshToken(rawToken)
    mutateBeforeNextBatch(context, () =>
      db.prepare("DELETE FROM refresh_tokens WHERE id = 1").run(),
    )

    const result = await new RefreshAccessToken(context).run(command(rawToken))

    expect(result).toBeInstanceOf(UnavailableError)
    expect((result as UnavailableError).code).toBe("audit_unavailable")
    expect((result as UnavailableError).message).toBe("invalid or expired refresh token")
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM audit_events").first<number>("count"),
    ).toBe(0)
    expect(await markerCount(db)).toBe(0)
  })

  test("rolls rotation back and returns audit_unavailable when audit insert fails", async () => {
    const rawToken = "rotation-audit-failure"
    const { context, db } = await setupRefreshToken(rawToken)
    await db.exec(`
      CREATE TRIGGER reject_test_audit_insert
      BEFORE INSERT ON audit_events
      BEGIN
        SELECT RAISE(ABORT, 'forced audit insert failure');
      END;
    `)

    const result = await new RefreshAccessToken(context).run(command(rawToken))

    expect(result).toBeInstanceOf(UnavailableError)
    expect((result as UnavailableError).code).toBe("audit_unavailable")
    expect(await activeFamilyCount(db)).toBe(1)
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM refresh_tokens").first<number>("count"),
    ).toBe(1)
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM audit_events").first<number>("count"),
    ).toBe(0)
    expect(await markerCount(db)).toBe(0)
  })

  test("rolls reuse revocation back on audit failure and succeeds after the trigger is removed", async () => {
    const rawToken = "reuse-audit-failure"
    const { context, db } = await setupRefreshToken(rawToken, { revokedAt: nowEpoch - 10 })
    await insertRefreshToken(db, { id: 2, rawToken: "reuse-active-descendant" })
    await db.exec(`
      CREATE TRIGGER reject_test_audit_insert
      BEFORE INSERT ON audit_events
      BEGIN
        SELECT RAISE(ABORT, 'forced audit insert failure');
      END;
    `)

    const failed = await new RefreshAccessToken(context).run(command(rawToken))

    expect(failed).toBeInstanceOf(UnavailableError)
    expect(await activeFamilyCount(db)).toBe(1)
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM audit_events").first<number>("count"),
    ).toBe(0)

    await db.exec("DROP TRIGGER reject_test_audit_insert")
    const retried = await new RefreshAccessToken(context).run(command(rawToken))

    expect(retried).toEqual({ reason: "invalid_token" })
    expect(await activeFamilyCount(db)).toBe(0)
    expect((await auditRows(db)).map(({ action }) => action)).toEqual([
      "auth.session.reuse_detected",
    ])
    expect(await markerCount(db)).toBe(0)
  })
})
