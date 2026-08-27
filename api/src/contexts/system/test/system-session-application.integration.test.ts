import { IssueSystemSession } from "@system/application/auth/issue-system-session"
import type {
  SystemAccessTokenIssuer,
  SystemSessionMaterial,
} from "@system/domain/definitions/auth/system-session-issuance.definition"
import { RevokeSystemSession } from "@system/application/auth/revoke-system-session"
import { RotateSystemSession } from "@system/application/auth/rotate-system-session"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { zSessionFamilyId } from "@system/domain/schemas/auth/session-family-id.schema"
import { zSessionId } from "@system/domain/schemas/auth/session-id.schema"
import { zSessionTokenHash } from "@system/domain/schemas/auth/session-token-hash.schema"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemAccountRepository } from "@system/infrastructure/repositories/auth/system-account.repository"
import { SystemSessionMaterialService } from "@system/lib/auth/system-session-material-service"
import { SystemSessionRepository } from "@system/infrastructure/repositories/auth/system-session.repository"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { describe, expect, test } from "bun:test"

const accountId = zAccountId.parse("account-1")
const now = new Date("2026-01-01T00:00:00.000Z")
const rotateAt = new Date("2026-01-02T00:00:00.000Z")
const sessionTtlMilliseconds = 7 * 24 * 60 * 60 * 1_000
const firstRawToken = "raw-token-1"
const secondRawToken = "raw-token-2"
const thirdRawToken = "raw-token-3"
const firstTokenHash = "a".repeat(64)
const secondTokenHash = "b".repeat(64)
const thirdTokenHash = "c".repeat(64)
const auditContext = Object.freeze({
  authorizationJson: '{"permission":"auth:session"}',
  metadataJson: '{"client":"test"}',
})
const accessTokenIssuer: SystemAccessTokenIssuer = Object.freeze({
  issue: async (input) => `access-token-${input.tokenVersion}-${input.now.toISOString()}`,
})

type MaterialProps = Readonly<{
  rawTokens: ReadonlyArray<string>
  tokenHashes: Readonly<Record<string, string>>
}>

function createMaterialService(props: MaterialProps): SystemSessionMaterial {
  let sessionSequence = 0
  let familySequence = 0
  let rawTokenSequence = 0

  return {
    generateSessionId: () => zSessionId.parse(`session-${++sessionSequence}`),
    generateFamilyId: () => zSessionFamilyId.parse(`family-${++familySequence}`),
    generateRawToken: () =>
      props.rawTokens.at(rawTokenSequence++) ?? new Error("raw token exhausted"),
    hashRawToken: async (rawToken) => {
      const tokenHash = props.tokenHashes[rawToken]

      return tokenHash === undefined
        ? new Error("unknown raw token")
        : zSessionTokenHash.parse(tokenHash)
    },
  }
}

function insertAccount(
  fixture: SystemSessionTestContext,
  status: "active" | "suspended" | "locked" = "active",
  tokenVersion = 0,
): void {
  fixture.sqlite
    .query(
      `INSERT INTO system_accounts
         (id, status, token_version, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?4)`,
    )
    .run(accountId, status, tokenVersion, now.getTime())
}

function createIssueSystemSession(
  fixture: SystemSessionTestContext,
  materialService: SystemSessionMaterial,
  ttlMilliseconds = sessionTtlMilliseconds,
): IssueSystemSession {
  return new IssueSystemSession({
    accountRepository: new SystemAccountRepository({ database: fixture.context.env.DB }),
    sessionRepository: new SystemSessionRepository({ context: fixture.context }),
    materialService,
    accessTokenIssuer,
    sessionTtlMilliseconds: ttlMilliseconds,
  })
}

function createRotateSystemSession(
  fixture: SystemSessionTestContext,
  materialService: SystemSessionMaterial,
  ttlMilliseconds = sessionTtlMilliseconds,
): RotateSystemSession {
  return new RotateSystemSession({
    accountRepository: new SystemAccountRepository({ database: fixture.context.env.DB }),
    sessionRepository: new SystemSessionRepository({ context: fixture.context }),
    auditAppender: new SystemAuditEventRepository(fixture.context),
    materialService,
    accessTokenIssuer,
    sessionTtlMilliseconds: ttlMilliseconds,
  })
}

function createAuthenticateSystemSession(
  fixture: SystemSessionTestContext,
  materialService: SystemSessionMaterial,
) {
  const repository = new SystemSessionRepository({ context: fixture.context })
  return {
    execute: (command: Parameters<typeof repository.authenticate>[0]) =>
      repository.authenticate(command, materialService),
  }
}

function createRevokeSystemSession(
  fixture: SystemSessionTestContext,
  materialService: SystemSessionMaterial,
): RevokeSystemSession {
  return new RevokeSystemSession({
    sessionRepository: new SystemSessionRepository({ context: fixture.context }),
    materialService,
  })
}

async function issueInitialSession(
  fixture: SystemSessionTestContext,
  materialService: SystemSessionMaterial,
  ttlMilliseconds = sessionTtlMilliseconds,
): Promise<void> {
  const result = await createIssueSystemSession(fixture, materialService, ttlMilliseconds).execute({
    accountId,
    tokenVersion: 0,
    now,
    auditContext,
  })

  if (result instanceof Error || result.kind !== "issued") {
    throw new Error("initial System Session was not issued")
  }
}

function sessionRows(fixture: SystemSessionTestContext): ReadonlyArray<Record<string, unknown>> {
  return fixture.sqlite
    .query<Record<string, unknown>, []>(
      `SELECT id, account_id, family_id, token_hash, token_version,
              created_at, expires_at, rotated_at, revoked_at
       FROM system_sessions ORDER BY created_at, id`,
    )
    .all()
}

function auditRows(fixture: SystemSessionTestContext): ReadonlyArray<Record<string, unknown>> {
  return fixture.sqlite
    .query<Record<string, unknown>, []>(
      `SELECT actor_account_id, action, target_type, target_id, outcome, reason_code,
              authorization_json, metadata_json, occurred_at
       FROM system_audit_events ORDER BY occurred_at, rowid`,
    )
    .all()
}

/** SystemのApplication API compositionと永続化adapterを共通fixtureで横断検証する。 */
describe("IssueSystemSession", () => {
  test("active Accountのcanonical versionでraw tokenを保存せずSessionと監査を発行する", async () => {
    const fixture = new SystemSessionTestContext()
    insertAccount(fixture)
    const materialService = createMaterialService({
      rawTokens: [firstRawToken],
      tokenHashes: { [firstRawToken]: firstTokenHash },
    })

    const result = await createIssueSystemSession(fixture, materialService).execute({
      accountId,
      tokenVersion: 0,
      now,
      auditContext,
    })

    expect(result).toEqual({
      kind: "issued",
      accountId,
      tokenVersion: 0,
      accessToken: "access-token-0-2026-01-01T00:00:00.000Z",
      rawToken: firstRawToken,
      sessionId: zSessionId.parse("session-1"),
      expiresAt: new Date(now.getTime() + sessionTtlMilliseconds),
    })
    expect(sessionRows(fixture)).toEqual([
      {
        id: "session-1",
        account_id: accountId,
        family_id: "family-1",
        token_hash: firstTokenHash,
        token_version: 0,
        created_at: now.getTime(),
        expires_at: now.getTime() + sessionTtlMilliseconds,
        rotated_at: null,
        revoked_at: null,
      },
    ])
    expect(JSON.stringify([...sessionRows(fixture), ...auditRows(fixture)])).not.toContain(
      firstRawToken,
    )
    expect(auditRows(fixture)).toEqual([
      {
        actor_account_id: accountId,
        action: "auth.session.create",
        target_type: "session",
        target_id: "session-1",
        outcome: "succeeded",
        reason_code: null,
        authorization_json: auditContext.authorizationJson,
        metadata_json: auditContext.metadataJson,
        occurred_at: now.getTime(),
      },
    ])
  })

  test.each([
    ["suspended", 0, 0, "account_inactive"],
    ["locked", 0, 0, "account_inactive"],
    ["active", 1, 0, "token_version_mismatch"],
  ] as const)(
    "Account状態またはversion driftをfail closedにしてtokenを生成しない",
    async (status, accountTokenVersion, requestedTokenVersion, reason) => {
      const fixture = new SystemSessionTestContext()
      insertAccount(fixture, status, accountTokenVersion)
      const materialService = createMaterialService({ rawTokens: [], tokenHashes: {} })

      expect(
        await createIssueSystemSession(fixture, materialService).execute({
          accountId,
          tokenVersion: requestedTokenVersion,
          now,
          auditContext,
        }),
      ).toEqual({ kind: "rejected", reason })
      expect(sessionRows(fixture)).toEqual([])
      expect(auditRows(fixture)).toEqual([])
    },
  )
})

describe("RotateSystemSession", () => {
  test("active Sessionをrotationし、使用済みtokenの再利用でfamily全体を失効する", async () => {
    const fixture = new SystemSessionTestContext()
    insertAccount(fixture)
    const materialService = createMaterialService({
      rawTokens: [firstRawToken, secondRawToken],
      tokenHashes: {
        [firstRawToken]: firstTokenHash,
        [secondRawToken]: secondTokenHash,
      },
    })
    await issueInitialSession(fixture, materialService)
    const rotate = createRotateSystemSession(fixture, materialService)

    expect(await rotate.execute({ rawToken: firstRawToken, now: rotateAt, auditContext })).toEqual({
      kind: "rotated",
      accountId,
      tokenVersion: 0,
      accessToken: "access-token-0-2026-01-02T00:00:00.000Z",
      rawToken: secondRawToken,
      sessionId: zSessionId.parse("session-2"),
      expiresAt: new Date(rotateAt.getTime() + sessionTtlMilliseconds),
    })
    expect(
      await rotate.execute({
        rawToken: firstRawToken,
        now: new Date(rotateAt.getTime() + 1),
        auditContext,
      }),
    ).toEqual({ kind: "rejected", reason: "reused" })

    expect(sessionRows(fixture)).toEqual([
      expect.objectContaining({
        id: "session-1",
        rotated_at: rotateAt.getTime(),
        revoked_at: rotateAt.getTime() + 1,
      }),
      expect.objectContaining({
        id: "session-2",
        token_hash: secondTokenHash,
        rotated_at: null,
        revoked_at: rotateAt.getTime() + 1,
      }),
    ])
    expect(auditRows(fixture).map((row) => [row.outcome, row.reason_code])).toEqual([
      ["succeeded", null],
      ["succeeded", null],
      ["denied", "refresh_token_reused"],
    ])
  })

  test("同じactive tokenの並行rotationは一方だけ成功し、後発をreuseとしてfamily失効する", async () => {
    const fixture = new SystemSessionTestContext()
    insertAccount(fixture)
    const materialService = createMaterialService({
      rawTokens: [firstRawToken, secondRawToken, thirdRawToken],
      tokenHashes: {
        [firstRawToken]: firstTokenHash,
        [secondRawToken]: secondTokenHash,
        [thirdRawToken]: thirdTokenHash,
      },
    })
    await issueInitialSession(fixture, materialService)
    const rotate = createRotateSystemSession(fixture, materialService)
    const results = await Promise.all([
      rotate.execute({ rawToken: firstRawToken, now: rotateAt, auditContext }),
      rotate.execute({ rawToken: firstRawToken, now: rotateAt, auditContext }),
    ])

    expect(
      results.map((result) => (result instanceof Error ? result.name : result.kind)).sort(),
    ).toEqual(["rejected", "rotated"])
    expect(
      results.find((result) => !(result instanceof Error) && result.kind === "rejected"),
    ).toEqual({ kind: "rejected", reason: "reused" })
    expect(sessionRows(fixture).every((row) => row.revoked_at === rotateAt.getTime())).toBe(true)
  })

  test("期限切れとAccount停止をinvalidとしてfamily失効しsuccessorを返さない", async () => {
    for (const scenario of ["expired", "locked"] as const) {
      const fixture = new SystemSessionTestContext()
      insertAccount(fixture)
      const materialService = createMaterialService({
        rawTokens: [firstRawToken],
        tokenHashes: { [firstRawToken]: firstTokenHash },
      })
      await issueInitialSession(
        fixture,
        materialService,
        scenario === "expired" ? 1 : sessionTtlMilliseconds,
      )

      if (scenario === "locked") {
        fixture.sqlite.run(
          `UPDATE system_accounts
           SET status = 'locked', token_version = 1, updated_at = ?1
           WHERE id = ?2`,
          [rotateAt.getTime(), accountId],
        )
      }

      expect(
        await createRotateSystemSession(fixture, materialService).execute({
          rawToken: firstRawToken,
          now: rotateAt,
          auditContext,
        }),
      ).toEqual({ kind: "rejected", reason: "invalid" })
      expect(sessionRows(fixture)).toHaveLength(1)
      expect(sessionRows(fixture)[0]?.revoked_at).toBe(rotateAt.getTime())
      expect(auditRows(fixture).at(-1)).toEqual(
        expect.objectContaining({ outcome: "denied", reason_code: "session_invalid" }),
      )
    }
  })

  test("未知tokenは主体・対象を推測せず拒否監査をappendする", async () => {
    const fixture = new SystemSessionTestContext()
    const materialService = createMaterialService({
      rawTokens: [],
      tokenHashes: { unknown: firstTokenHash },
    })

    expect(
      await createRotateSystemSession(fixture, materialService).execute({
        rawToken: "unknown",
        now: rotateAt,
        auditContext,
      }),
    ).toEqual({ kind: "rejected", reason: "invalid" })
    expect(auditRows(fixture)).toEqual([
      {
        actor_account_id: null,
        action: "auth.session.rotate",
        target_type: "session",
        target_id: null,
        outcome: "denied",
        reason_code: "session_invalid",
        authorization_json: auditContext.authorizationJson,
        metadata_json: auditContext.metadataJson,
        occurred_at: rotateAt.getTime(),
      },
    ])
  })

  test("未知tokenの拒否監査を保存できない場合は認証拒否成功に丸めない", async () => {
    const fixture = new SystemSessionTestContext()
    fixture.sqlite.exec(`
      CREATE TRIGGER ignore_system_session_application_audit
      BEFORE INSERT ON system_audit_events
      BEGIN
        SELECT RAISE(IGNORE);
      END;
    `)
    const materialService = createMaterialService({
      rawTokens: [],
      tokenHashes: { unknown: firstTokenHash },
    })

    expect(
      await createRotateSystemSession(fixture, materialService).execute({
        rawToken: "unknown",
        now: rotateAt,
        auditContext,
      }),
    ).toBeInstanceOf(Error)
    expect(auditRows(fixture)).toEqual([])
  })
})

describe("AuthenticateSystemSession", () => {
  test("active Sessionをcanonical Accountと同じidentity・versionで認証する", async () => {
    const fixture = new SystemSessionTestContext()
    insertAccount(fixture)
    const materialService = createMaterialService({
      rawTokens: [firstRawToken],
      tokenHashes: { [firstRawToken]: firstTokenHash },
    })
    await issueInitialSession(fixture, materialService)

    expect(
      await createAuthenticateSystemSession(fixture, materialService).execute({
        rawToken: firstRawToken,
        now,
      }),
    ).toEqual({
      kind: "authenticated",
      accountId,
      tokenVersion: 0,
      sessionId: zSessionId.parse("session-1"),
      expiresAt: new Date(now.getTime() + sessionTtlMilliseconds),
    })
  })

  test("未知・期限切れ・rotation済みtokenを同じinvalidへ畳む", async () => {
    const fixture = new SystemSessionTestContext()
    insertAccount(fixture)
    const materialService = createMaterialService({
      rawTokens: [firstRawToken, secondRawToken],
      tokenHashes: {
        [firstRawToken]: firstTokenHash,
        [secondRawToken]: secondTokenHash,
        unknown: thirdTokenHash,
      },
    })
    await issueInitialSession(fixture, materialService)
    const authenticate = createAuthenticateSystemSession(fixture, materialService)

    expect(await authenticate.execute({ rawToken: "unknown", now })).toEqual({
      kind: "rejected",
      reason: "invalid",
    })
    expect(
      await authenticate.execute({
        rawToken: firstRawToken,
        now: new Date(now.getTime() + sessionTtlMilliseconds),
      }),
    ).toEqual({ kind: "rejected", reason: "invalid" })

    expect(
      await createRotateSystemSession(fixture, materialService).execute({
        rawToken: firstRawToken,
        now: rotateAt,
        auditContext,
      }),
    ).toEqual(
      expect.objectContaining({
        kind: "rotated",
        rawToken: secondRawToken,
      }),
    )
    expect(await authenticate.execute({ rawToken: firstRawToken, now: rotateAt })).toEqual({
      kind: "rejected",
      reason: "invalid",
    })
    expect(await authenticate.execute({ rawToken: secondRawToken, now: rotateAt })).toEqual(
      expect.objectContaining({ kind: "authenticated", accountId, tokenVersion: 0 }),
    )
  })

  test("canonical Account停止とversion driftを同じinvalidへ畳む", async () => {
    for (const scenario of ["locked", "version_drift"] as const) {
      const fixture = new SystemSessionTestContext()
      insertAccount(fixture)
      const materialService = createMaterialService({
        rawTokens: [firstRawToken],
        tokenHashes: { [firstRawToken]: firstTokenHash },
      })
      await issueInitialSession(fixture, materialService)
      fixture.sqlite.run(
        `UPDATE system_accounts
         SET status = ?1, token_version = ?2, updated_at = ?3
         WHERE id = ?4`,
        [scenario === "locked" ? "locked" : "active", 1, rotateAt.getTime(), accountId],
      )

      expect(
        await createAuthenticateSystemSession(fixture, materialService).execute({
          rawToken: firstRawToken,
          now: rotateAt,
        }),
      ).toEqual({ kind: "rejected", reason: "invalid" })
    }
  })
})

describe("RevokeSystemSession", () => {
  test("既知tokenのfamilyを監査と同時に冪等失効する", async () => {
    const fixture = new SystemSessionTestContext()
    insertAccount(fixture)
    const materialService = createMaterialService({
      rawTokens: [firstRawToken, secondRawToken],
      tokenHashes: {
        [firstRawToken]: firstTokenHash,
        [secondRawToken]: secondTokenHash,
      },
    })
    await issueInitialSession(fixture, materialService)
    await createRotateSystemSession(fixture, materialService).execute({
      rawToken: firstRawToken,
      now: rotateAt,
      auditContext,
    })
    const revoke = createRevokeSystemSession(fixture, materialService)
    const revokedAt = new Date(rotateAt.getTime() + 1)

    expect(
      await revoke.execute({ rawToken: secondRawToken, now: revokedAt, auditContext }),
    ).toEqual({ kind: "completed" })
    expect(sessionRows(fixture).every((row) => row.revoked_at === revokedAt.getTime())).toBe(true)
    expect(auditRows(fixture).at(-1)).toEqual(
      expect.objectContaining({
        action: "auth.session.revoke",
        outcome: "succeeded",
        target_id: "session-2",
      }),
    )
    const auditCount = auditRows(fixture).length

    expect(
      await revoke.execute({ rawToken: secondRawToken, now: revokedAt, auditContext }),
    ).toEqual({ kind: "completed" })
    expect(auditRows(fixture)).toHaveLength(auditCount)
    expect(
      await createAuthenticateSystemSession(fixture, materialService).execute({
        rawToken: secondRawToken,
        now: revokedAt,
      }),
    ).toEqual({ kind: "rejected", reason: "invalid" })
  })

  test("未知tokenを実在するtokenと区別できない完了へ畳む", async () => {
    const fixture = new SystemSessionTestContext()
    const materialService = createMaterialService({
      rawTokens: [],
      tokenHashes: { unknown: thirdTokenHash },
    })

    expect(
      await createRevokeSystemSession(fixture, materialService).execute({
        rawToken: "unknown",
        now,
        auditContext,
      }),
    ).toEqual({ kind: "completed" })
    expect(auditRows(fixture)).toEqual([])
  })

  test("失効監査を保存できない場合はfamily mutationもrollbackする", async () => {
    const fixture = new SystemSessionTestContext()
    insertAccount(fixture)
    const materialService = createMaterialService({
      rawTokens: [firstRawToken],
      tokenHashes: { [firstRawToken]: firstTokenHash },
    })
    await issueInitialSession(fixture, materialService)
    fixture.sqlite.exec(`
      CREATE TRIGGER ignore_system_session_revocation_audit
      BEFORE INSERT ON system_audit_events
      WHEN NEW.action = 'auth.session.revoke'
      BEGIN
        SELECT RAISE(IGNORE);
      END;
    `)

    expect(
      await createRevokeSystemSession(fixture, materialService).execute({
        rawToken: firstRawToken,
        now: rotateAt,
        auditContext,
      }),
    ).toBeInstanceOf(Error)
    expect(sessionRows(fixture)[0]?.revoked_at).toBeNull()
    expect(auditRows(fixture).map((row) => row.action)).toEqual(["auth.session.create"])
  })
})

describe("SystemSessionMaterialService", () => {
  test("256-bit raw token・opaque ID・SHA-256 hashだけを生成する", async () => {
    const service = new SystemSessionMaterialService()
    const rawToken = service.generateRawToken()

    expect(typeof rawToken).toBe("string")
    if (rawToken instanceof Error) throw rawToken
    expect(rawToken).toMatch(/^[a-f0-9]{64}$/)
    expect(service.generateSessionId()).not.toBeInstanceOf(Error)
    expect(service.generateFamilyId()).not.toBeInstanceOf(Error)
    expect(await service.hashRawToken("abc")).toBe(
      zSessionTokenHash.parse("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"),
    )
  })
})
