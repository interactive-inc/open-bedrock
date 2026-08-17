import { describe, expect, spyOn, test } from "bun:test"
import type { AuditEventRecord } from "@/contexts/company-compatibility/application/audit/company-audit-event"
import type { Context } from "@/env"
import { AuditEventRepository } from "@/contexts/company-compatibility/infrastructure/company/audit/audit-event-repository"
import { RefreshTokenRepository } from "@/contexts/company-compatibility/infrastructure/auth/refresh-token-repository"
import { createTestContext } from "@/api/test/support/create-test-context"

const nowEpoch = 1_767_225_600
const oldTokenHash = "old-token-hash"
const familyId = "family-for-repository-test"

function auditRecord(eventId: string, overrides: Partial<AuditEventRecord> = {}): AuditEventRecord {
  return {
    eventId,
    requestId: "00000000-0000-4000-8000-000000000001",
    actorAccountId: 1,
    actorEmployeeId: 1,
    action: "auth.session.refreshed",
    targetType: "account",
    targetId: "1",
    outcome: "succeeded",
    reasonCode: null,
    authorizationJson: null,
    beforeJson: null,
    afterJson: null,
    metadataJson: '{"family_id_hash":"family-hash"}',
    clientIp: "192.0.2.1",
    clientName: "api",
    createdAt: nowEpoch,
    ...overrides,
  }
}

function rotationAudit(context: Context, ordinal: number) {
  const suffix = String(ordinal).padStart(12, "0")

  return new AuditEventRepository(context).prepareExclusiveAppend({
    decisionId: `00000000-0000-4000-8000-${suffix}`,
    cases: [
      { decision: "rotated", record: auditRecord(`rotated-${ordinal}`) },
      {
        decision: "reused",
        record: auditRecord(`reused-${ordinal}`, {
          actorAccountId: null,
          actorEmployeeId: null,
          action: "auth.session.reuse_detected",
          outcome: "denied",
          reasonCode: "refresh_token_reuse",
        }),
      },
      {
        decision: "invalid",
        record: auditRecord(`invalid-${ordinal}`, {
          actorAccountId: null,
          actorEmployeeId: null,
          outcome: "denied",
          reasonCode: "invalid_token",
        }),
      },
    ] as const,
  })
}

async function setup() {
  const { context, db } = createTestContext()
  await db.exec(`
    INSERT INTO employees (id, code, name, status)
    VALUES (1, 'E001', 'Test Worker', 'active');
    INSERT INTO accounts (id, status, token_version, created_at, updated_at)
    VALUES (1, 'active', 0, ${nowEpoch - 100}, ${nowEpoch - 100});
    INSERT INTO account_employee_links (account_id, employee_id) VALUES (1, 1);
  `)
  await insertRefreshToken(db)

  return { context, db, repository: new RefreshTokenRepository(context) }
}

async function insertRefreshToken(
  db: D1Database,
  overrides: {
    id?: number
    accountId?: number
    tokenHash?: string
    familyId?: string
    tokenVersion?: number
    expiresAt?: number
    revokedAt?: number | null
    userAgent?: string | null
    createdAt?: number
  } = {},
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO refresh_tokens
         (id, account_id, token_hash, family_id, token_version, expires_at,
          revoked_at, user_agent, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    )
    .bind(
      overrides.id ?? 1,
      overrides.accountId ?? 1,
      overrides.tokenHash ?? oldTokenHash,
      overrides.familyId ?? familyId,
      overrides.tokenVersion ?? 0,
      overrides.expiresAt ?? nowEpoch + 3_600,
      overrides.revokedAt ?? null,
      overrides.userAgent ?? "fixture-agent",
      overrides.createdAt ?? nowEpoch - 100,
    )
    .run()
}

async function insertCanonicalAccount(db: D1Database, tokenVersion: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES ('1', 'active', ?1, ?2, ?2)`,
    )
    .bind(tokenVersion, (nowEpoch - 100) * 1_000)
    .run()
}

function rotateProps(newTokenHash = "new-token-hash") {
  return {
    tokenId: 1,
    oldTokenHash,
    newTokenHash,
    accountId: 1,
    employeeId: 1,
    familyId,
    tokenVersion: 0,
    userAgent: "rotation-agent",
    nowEpoch,
  }
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

function isolateChangesPerBatchStatement(context: Context): void {
  const source = context.env.DB
  context.env.DB = new Proxy(source, {
    get(target, property, receiver) {
      if (property === "prepare") {
        return (query: string) =>
          query.includes("changes()")
            ? source.prepare("SELECT json_extract('', '$') AS ok")
            : source.prepare(query)
      }

      return Reflect.get(target, property, receiver)
    },
  })
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

async function auditActions(
  db: D1Database,
): Promise<Array<{ action: string; outcome: string; reason_code: string | null }>> {
  return (
    await db
      .prepare("SELECT action, outcome, reason_code FROM audit_events ORDER BY id")
      .all<{ action: string; outcome: string; reason_code: string | null }>()
  ).results
}

describe("RefreshTokenRepository audited writes", () => {
  test("creates a refresh token and its audit event in one batch", async () => {
    const { context, db } = createTestContext()
    await insertCanonicalAccount(db, 3)
    const repository = new RefreshTokenRepository(context)
    const audit = new AuditEventRepository(context).prepareAppend(auditRecord("login-created"))

    const result = await repository.createWithAudit(
      {
        accountId: 1,
        tokenHash: "created-token-hash",
        familyId: "created-family",
        tokenVersion: 3,
        userAgent: "creation-agent",
        nowEpoch,
      },
      audit,
    )

    expect(result).toBeUndefined()
    expect(
      await db
        .prepare(
          `SELECT account_id, token_hash, family_id, token_version, expires_at,
                  revoked_at, user_agent, created_at
           FROM refresh_tokens`,
        )
        .first<Record<string, unknown>>(),
    ).toEqual({
      account_id: 1,
      token_hash: "created-token-hash",
      family_id: "created-family",
      token_version: 3,
      expires_at: nowEpoch + 7 * 24 * 60 * 60,
      revoked_at: null,
      user_agent: "creation-agent",
      created_at: nowEpoch,
    })
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM audit_events").first<number>("count"),
    ).toBe(1)
  })

  test("verifies the persisted row without relying on changes() from a prior batch statement", async () => {
    const { context, db } = createTestContext()
    await insertCanonicalAccount(db, 0)
    isolateChangesPerBatchStatement(context)
    const repository = new RefreshTokenRepository(context)

    const result = await repository.createWithAudit(
      {
        accountId: 1,
        tokenHash: "statement-local-token-hash",
        familyId: "statement-local-family",
        tokenVersion: 0,
        userAgent: null,
        nowEpoch,
      },
      new AuditEventRepository(context).prepareAppend(auditRecord("statement-local-login")),
    )

    expect(result).toBeUndefined()
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS count FROM refresh_tokens WHERE token_hash = 'statement-local-token-hash'",
        )
        .first<number>("count"),
    ).toBe(1)
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM audit_events").first<number>("count"),
    ).toBe(1)
  })

  test("rolls a created refresh token back when its audit insert fails", async () => {
    const { context, db } = createTestContext()
    await insertCanonicalAccount(db, 0)
    const repository = new RefreshTokenRepository(context)
    const consoleError = spyOn(console, "error").mockImplementation(() => undefined)
    await db.exec(`
      CREATE TRIGGER reject_test_audit_insert
      BEFORE INSERT ON audit_events
      BEGIN
        SELECT RAISE(ABORT, 'forced audit insert failure');
      END;
    `)

    const result = await repository.createWithAudit(
      {
        accountId: 1,
        tokenHash: "rolled-back-token-hash",
        familyId: "rolled-back-family",
        tokenVersion: 0,
        userAgent: null,
        nowEpoch,
      },
      new AuditEventRepository(context).prepareAppend(auditRecord("rejected-login-audit")),
    )

    expect(result).toBeInstanceOf(Error)
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM refresh_tokens").first<number>("count"),
    ).toBe(0)
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM audit_events").first<number>("count"),
    ).toBe(0)
    expect(consoleError).toHaveBeenCalledWith(
      JSON.stringify({
        event: "auth.persistence.failed",
        operation: "refresh_token.create_with_audit",
        errorType: "SQLiteError",
        reason: "database_error",
      }),
    )
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("rolled-back-token-hash")
    consoleError.mockRestore()
  })

  test("revokes an active family and appends its audit event atomically", async () => {
    const { context, db, repository } = await setup()

    const result = await repository.revokeFamilyWithAudit({
      familyId,
      nowEpoch,
      auditStatements: new AuditEventRepository(context).prepareAppend(
        auditRecord("family-revoked"),
      ),
    })

    expect(result).toBeUndefined()
    expect(await activeFamilyCount(db)).toBe(0)
    expect(await auditActions(db)).toEqual([
      { action: "auth.session.refreshed", outcome: "succeeded", reason_code: null },
    ])
  })

  test("allows zero active family rows and still appends a repeated reuse event", async () => {
    const { context, db, repository } = await setup()
    await db
      .prepare("UPDATE refresh_tokens SET revoked_at = ?1 WHERE family_id = ?2")
      .bind(nowEpoch - 1, familyId)
      .run()

    const result = await repository.revokeFamilyWithAudit({
      familyId,
      nowEpoch,
      auditStatements: new AuditEventRepository(context).prepareAppend(
        auditRecord("repeated-reuse", {
          action: "auth.session.reuse_detected",
          outcome: "denied",
          reasonCode: "refresh_token_reuse",
        }),
      ),
    })

    expect(result).toBeUndefined()
    expect(await activeFamilyCount(db)).toBe(0)
    expect(await auditActions(db)).toEqual([
      {
        action: "auth.session.reuse_detected",
        outcome: "denied",
        reason_code: "refresh_token_reuse",
      },
    ])
  })

  test("rolls family revocation back when its audit insert fails", async () => {
    const { context, db, repository } = await setup()
    await db.exec(`
      CREATE TRIGGER reject_test_audit_insert
      BEFORE INSERT ON audit_events
      BEGIN
        SELECT RAISE(ABORT, 'forced audit insert failure');
      END;
    `)

    const result = await repository.revokeFamilyWithAudit({
      familyId,
      nowEpoch,
      auditStatements: new AuditEventRepository(context).prepareAppend(
        auditRecord("failed-revoke"),
      ),
    })

    expect(result).toBeInstanceOf(Error)
    expect(await activeFamilyCount(db)).toBe(1)
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM audit_events").first<number>("count"),
    ).toBe(0)
  })
})

describe("RefreshTokenRepository atomic rotation decision", () => {
  test("rotates an active token, leaves one descendant, and appends one success event", async () => {
    const { context, db, repository } = await setup()

    const result = await repository.rotateWithAudit(rotateProps(), rotationAudit(context, 1))

    expect(result).toBe("rotated")
    expect(
      await db
        .prepare(
          "SELECT token_hash, revoked_at FROM refresh_tokens WHERE family_id = ?1 ORDER BY id",
        )
        .bind(familyId)
        .all(),
    ).toMatchObject({
      results: [
        { token_hash: oldTokenHash, revoked_at: nowEpoch },
        { token_hash: "new-token-hash", revoked_at: null },
      ],
    })
    expect(await activeFamilyCount(db)).toBe(1)
    expect(await auditActions(db)).toEqual([
      { action: "auth.session.refreshed", outcome: "succeeded", reason_code: null },
    ])
    expect(await markerCount(db)).toBe(0)
  })

  test("chooses reuse and revokes the family in the same single batch after a revoke race", async () => {
    const { context, db, repository } = await setup()
    const batchCalls = mutateBeforeNextBatch(context, () =>
      db
        .prepare("UPDATE refresh_tokens SET revoked_at = ?1 WHERE id = 1")
        .bind(nowEpoch - 1)
        .run(),
    )

    const result = await repository.rotateWithAudit(rotateProps(), rotationAudit(context, 2))

    expect(result).toBe("reused")
    expect(batchCalls()).toBe(1)
    expect(await activeFamilyCount(db)).toBe(0)
    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM refresh_tokens WHERE token_hash = 'new-token-hash'")
        .first<number>("count"),
    ).toBe(0)
    expect(await auditActions(db)).toEqual([
      {
        action: "auth.session.reuse_detected",
        outcome: "denied",
        reason_code: "refresh_token_reuse",
      },
    ])
    expect(await markerCount(db)).toBe(0)
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
  ])("chooses invalid after a live %s race", async (_, mutationSql) => {
    const { context, db, repository } = await setup()
    mutateBeforeNextBatch(context, () => db.prepare(mutationSql).run())

    const result = await repository.rotateWithAudit(rotateProps(), rotationAudit(context, 3))

    expect(result).toBe("invalid")
    expect(await activeFamilyCount(db)).toBe(0)
    expect(await auditActions(db)).toEqual([
      { action: "auth.session.refreshed", outcome: "denied", reason_code: "invalid_token" },
    ])
    expect(await markerCount(db)).toBe(0)
  })

  test("serializes concurrent rotations to one success and one reuse event", async () => {
    const { context, db, repository } = await setup()

    const results = await Promise.all([
      repository.rotateWithAudit(rotateProps("new-token-a"), rotationAudit(context, 4)),
      repository.rotateWithAudit(rotateProps("new-token-b"), rotationAudit(context, 5)),
    ])

    expect(new Set(results)).toEqual(new Set(["reused", "rotated"]))
    expect(await activeFamilyCount(db)).toBe(0)
    expect(await auditActions(db)).toEqual([
      { action: "auth.session.refreshed", outcome: "succeeded", reason_code: null },
      {
        action: "auth.session.reuse_detected",
        outcome: "denied",
        reason_code: "refresh_token_reuse",
      },
    ])
    expect(await markerCount(db)).toBe(0)
  })

  test("rolls a successful rotation back when the selected audit insert fails", async () => {
    const { context, db, repository } = await setup()
    await db.exec(`
      CREATE TRIGGER reject_test_audit_insert
      BEFORE INSERT ON audit_events
      BEGIN
        SELECT RAISE(ABORT, 'forced audit insert failure');
      END;
    `)

    const result = await repository.rotateWithAudit(rotateProps(), rotationAudit(context, 6))

    expect(result).toBeInstanceOf(Error)
    expect(await activeFamilyCount(db)).toBe(1)
    expect(
      await db
        .prepare("SELECT revoked_at FROM refresh_tokens WHERE id = 1")
        .first<number | null>("revoked_at"),
    ).toBeNull()
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM refresh_tokens").first<number>("count"),
    ).toBe(1)
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM audit_events").first<number>("count"),
    ).toBe(0)
    expect(await markerCount(db)).toBe(0)
  })

  test("rolls reuse revocation back on audit failure and succeeds on retry", async () => {
    const { context, db, repository } = await setup()
    await db
      .prepare("UPDATE refresh_tokens SET revoked_at = ?1 WHERE id = 1")
      .bind(nowEpoch - 2)
      .run()
    await insertRefreshToken(db, {
      id: 2,
      tokenHash: "active-descendant",
      revokedAt: null,
      createdAt: nowEpoch - 1,
    })
    await db.exec(`
      CREATE TRIGGER reject_test_audit_insert
      BEFORE INSERT ON audit_events
      BEGIN
        SELECT RAISE(ABORT, 'forced audit insert failure');
      END;
    `)

    const failed = await repository.rotateWithAudit(rotateProps(), rotationAudit(context, 7))

    expect(failed).toBeInstanceOf(Error)
    expect(await activeFamilyCount(db)).toBe(1)
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM audit_events").first<number>("count"),
    ).toBe(0)
    expect(await markerCount(db)).toBe(0)

    await db.exec("DROP TRIGGER reject_test_audit_insert")
    const retried = await repository.rotateWithAudit(rotateProps(), rotationAudit(context, 8))

    expect(retried).toBe("reused")
    expect(await activeFamilyCount(db)).toBe(0)
    expect(await auditActions(db)).toEqual([
      {
        action: "auth.session.reuse_detected",
        outcome: "denied",
        reason_code: "refresh_token_reuse",
      },
    ])
    expect(await markerCount(db)).toBe(0)
  })

  test("records every repeated reuse even when the family already has no active rows", async () => {
    const { context, db, repository } = await setup()
    await db
      .prepare("UPDATE refresh_tokens SET revoked_at = ?1 WHERE family_id = ?2")
      .bind(nowEpoch - 1, familyId)
      .run()

    expect(await repository.rotateWithAudit(rotateProps(), rotationAudit(context, 9))).toBe(
      "reused",
    )
    expect(await repository.rotateWithAudit(rotateProps(), rotationAudit(context, 10))).toBe(
      "reused",
    )
    expect(await auditActions(db)).toEqual([
      {
        action: "auth.session.reuse_detected",
        outcome: "denied",
        reason_code: "refresh_token_reuse",
      },
      {
        action: "auth.session.reuse_detected",
        outcome: "denied",
        reason_code: "refresh_token_reuse",
      },
    ])
    expect(await markerCount(db)).toBe(0)
  })

  test("fails closed when the old token disappears after the caller read it", async () => {
    const { context, db, repository } = await setup()
    mutateBeforeNextBatch(context, () =>
      db.prepare("DELETE FROM refresh_tokens WHERE id = 1").run(),
    )

    const result = await repository.rotateWithAudit(rotateProps(), rotationAudit(context, 11))

    expect(result).toBeInstanceOf(Error)
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM refresh_tokens").first<number>("count"),
    ).toBe(0)
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM audit_events").first<number>("count"),
    ).toBe(0)
    expect(await markerCount(db)).toBe(0)
  })

  test("treats descendant uniqueness, state invariant, and marker cleanup failures as errors", async () => {
    const scenarios = ["unique", "state", "cleanup"] as const

    for (const [index, scenario] of scenarios.entries()) {
      const { context, db, repository } = await setup()
      if (scenario === "unique") {
        await insertRefreshToken(db, {
          id: 2,
          tokenHash: "new-token-hash",
          familyId: "other-family",
          revokedAt: nowEpoch - 1,
        })
      } else if (scenario === "state") {
        await insertRefreshToken(db, {
          id: 2,
          tokenHash: "unexpected-active-sibling",
          revokedAt: null,
        })
      } else {
        await db.exec(`
          CREATE TRIGGER reject_marker_cleanup
          BEFORE DELETE ON audit_batch_decisions
          BEGIN
            SELECT RAISE(ABORT, 'forced marker cleanup failure');
          END;
        `)
      }

      const result = await repository.rotateWithAudit(
        rotateProps(),
        rotationAudit(context, 20 + index),
      )

      expect(result).toBeInstanceOf(Error)
      expect(
        await db
          .prepare("SELECT revoked_at FROM refresh_tokens WHERE id = 1")
          .first<number | null>("revoked_at"),
      ).toBeNull()
      expect(
        await db.prepare("SELECT COUNT(*) AS count FROM audit_events").first<number>("count"),
      ).toBe(0)
      expect(await markerCount(db)).toBe(0)
    }
  })

  test("rejects an audit fragment whose decision vocabulary is not exact", async () => {
    const { context, db, repository } = await setup()
    const audit = rotationAudit(context, 30)

    const result = await repository.rotateWithAudit(rotateProps(), {
      ...audit,
      decisions: ["rotated", "reused", "unexpected"],
    } as never)

    expect(result).toBeInstanceOf(Error)
    expect(await activeFamilyCount(db)).toBe(1)
    expect(await markerCount(db)).toBe(0)
  })
})
