import type { SessionRotationAuditEvents } from "@system/domain/definitions/auth/session-rotation-audit-events.definition"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SessionRotationValue } from "@system/domain/values/auth/session-rotation.value"
import { SessionEntity } from "@system/domain/entities/session.entity"
import { SystemSessionRepository } from "@system/infrastructure/auth/system-session.repository"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { describe, expect, test } from "bun:test"

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const rotatedAt = new Date("2026-01-02T00:00:00.000Z")
const expiresAt = new Date("2026-01-08T00:00:00.000Z")
const successorExpiresAt = new Date("2026-01-09T00:00:00.000Z")
const accountId = "account-1"
const familyId = "family-1"
const tokenHash = "a".repeat(64)
const successorTokenHash = "b".repeat(64)

function createSession(props: {
  id: string
  tokenHash: string
  createdAt: Date
  expiresAt: Date
}): SessionEntity {
  const session = SessionEntity.create({
    id: props.id,
    accountId,
    familyId,
    tokenHash: props.tokenHash,
    tokenVersion: 0,
    createdAt: props.createdAt,
    expiresAt: props.expiresAt,
    rotatedAt: null,
    revokedAt: null,
  })

  if (session instanceof Error) throw session

  return session
}

function createAudit(props: {
  action: string
  targetId: string
  outcome: "succeeded" | "denied"
  reasonCode: string | null
  occurredAt: Date
}): SystemAuditEventEntity {
  const audit = SystemAuditEventEntity.create({
    actorAccountId: accountId,
    action: props.action,
    targetType: "session",
    targetId: props.targetId,
    outcome: props.outcome,
    reasonCode: props.reasonCode,
    authorizationJson: null,
    beforeJson: null,
    afterJson: null,
    metadataJson: null,
    occurredAt: props.occurredAt,
  })

  if (audit instanceof Error) throw audit

  return audit
}

function createRotation(): SessionRotationValue {
  const previous = createSession({
    id: "session-1",
    tokenHash,
    createdAt,
    expiresAt,
  })
  const successor = createSession({
    id: "session-2",
    tokenHash: successorTokenHash,
    createdAt: rotatedAt,
    expiresAt: successorExpiresAt,
  })
  const rotation = SessionRotationValue.create(previous, successor, rotatedAt)

  if (rotation instanceof Error) throw rotation

  return rotation
}

function createRotationAudits(rotation: SessionRotationValue): SessionRotationAuditEvents {
  const occurredAt = rotation.previous.rotatedAt

  if (occurredAt === null) throw new Error("rotation time is missing")

  return {
    rotated: createAudit({
      action: "auth.session.rotate",
      targetId: rotation.previous.id,
      outcome: "succeeded",
      reasonCode: null,
      occurredAt,
    }),
    reused: createAudit({
      action: "auth.session.rotate",
      targetId: rotation.previous.id,
      outcome: "denied",
      reasonCode: "refresh_token_reused",
      occurredAt,
    }),
    invalid: createAudit({
      action: "auth.session.rotate",
      targetId: rotation.previous.id,
      outcome: "denied",
      reasonCode: "session_invalid",
      occurredAt,
    }),
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
    .run(accountId, status, tokenVersion, createdAt.getTime())
}

function insertSession(fixture: SystemSessionTestContext, session: SessionEntity): void {
  fixture.sqlite
    .query(
      `INSERT INTO system_sessions
         (id, account_id, family_id, token_hash, token_version,
          created_at, expires_at, rotated_at, revoked_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    )
    .run(
      session.id,
      session.accountId,
      session.familyId,
      session.tokenHash,
      session.tokenVersion,
      session.createdAt.getTime(),
      session.expiresAt.getTime(),
      session.rotatedAt?.getTime() ?? null,
      session.revokedAt?.getTime() ?? null,
    )
}

function getCount(fixture: SystemSessionTestContext, table: string): number {
  const row = fixture.sqlite
    .query<{ count: number }, []>(`SELECT COUNT(*) AS count FROM ${table}`)
    .get()

  return row?.count ?? 0
}

describe("SystemSessionRepository", () => {
  test("active AccountEntityへhashだけのSessionEntityと監査を同じtransactionで発行する", async () => {
    const fixture = new SystemSessionTestContext()
    insertAccount(fixture)
    const repository = new SystemSessionRepository({ context: fixture.context })
    const session = createSession({ id: "session-1", tokenHash, createdAt, expiresAt })
    const audit = createAudit({
      action: "auth.session.create",
      targetId: session.id,
      outcome: "succeeded",
      reasonCode: null,
      occurredAt: createdAt,
    })

    expect(await repository.createWithAudit(session, audit)).toBeUndefined()

    const stored = await repository.findByTokenHash(session.tokenHash)
    expect(stored).toBeInstanceOf(SessionEntity)
    expect(stored instanceof SessionEntity ? stored.id : null).toBe(session.id)
    expect(stored instanceof SessionEntity ? stored.tokenHash : null).toBe(session.tokenHash)
    expect(getCount(fixture, "system_sessions")).toBe(1)
    expect(getCount(fixture, "system_audit_events")).toBe(1)
  })

  test.each([
    ["suspended", 0],
    ["locked", 0],
    ["active", 1],
  ] as const)(
    "AccountEntity security stateが一致しない発行を監査ごとrollbackする",
    async (status, version) => {
      const fixture = new SystemSessionTestContext()
      insertAccount(fixture, status, version)
      const repository = new SystemSessionRepository({ context: fixture.context })
      const session = createSession({ id: "session-1", tokenHash, createdAt, expiresAt })
      const audit = createAudit({
        action: "auth.session.create",
        targetId: session.id,
        outcome: "succeeded",
        reasonCode: null,
        occurredAt: createdAt,
      })

      expect(await repository.createWithAudit(session, audit)).toBeInstanceOf(Error)
      expect(getCount(fixture, "system_sessions")).toBe(0)
      expect(getCount(fixture, "system_audit_events")).toBe(0)
    },
  )

  test("監査insertが黙殺された発行をSessionEntityごとrollbackする", async () => {
    const fixture = new SystemSessionTestContext()
    insertAccount(fixture)
    fixture.sqlite.exec(`
      CREATE TRIGGER ignore_system_audit_insert
      BEFORE INSERT ON system_audit_events
      BEGIN
        SELECT RAISE(IGNORE);
      END;
    `)
    const repository = new SystemSessionRepository({ context: fixture.context })
    const session = createSession({ id: "session-1", tokenHash, createdAt, expiresAt })
    const audit = createAudit({
      action: "auth.session.create",
      targetId: session.id,
      outcome: "succeeded",
      reasonCode: null,
      occurredAt: createdAt,
    })

    expect(await repository.createWithAudit(session, audit)).toBeInstanceOf(Error)
    expect(getCount(fixture, "system_sessions")).toBe(0)
    expect(getCount(fixture, "system_audit_events")).toBe(0)
  })

  test("一度だけ旧SessionEntityを消費し後継SessionEntityと成功監査を原子的に作る", async () => {
    const fixture = new SystemSessionTestContext()
    insertAccount(fixture)
    const rotation = createRotation()
    insertSession(fixture, createSession({ id: "session-1", tokenHash, createdAt, expiresAt }))
    const audits = createRotationAudits(rotation)
    const repository = new SystemSessionRepository({ context: fixture.context })

    expect(await repository.rotateWithAudit(rotation, audits)).toBe("rotated")

    const rows = fixture.sqlite
      .query<{ id: string; rotated_at: number | null; revoked_at: number | null }, []>(
        "SELECT id, rotated_at, revoked_at FROM system_sessions ORDER BY id",
      )
      .all()
    expect(rows).toEqual([
      { id: "session-1", rotated_at: rotatedAt.getTime(), revoked_at: null },
      { id: "session-2", rotated_at: null, revoked_at: null },
    ])
    expect(
      fixture.sqlite
        .query<{ event_id: string }, []>("SELECT event_id FROM system_audit_events")
        .get()?.event_id,
    ).toBe(audits.rotated.eventId)
  })

  test("同じ旧SessionEntityの並行後発をreuseとしてfamily全体とともに失効する", async () => {
    const fixture = new SystemSessionTestContext()
    insertAccount(fixture)
    const rotation = createRotation()
    insertSession(fixture, createSession({ id: "session-1", tokenHash, createdAt, expiresAt }))
    const repository = new SystemSessionRepository({ context: fixture.context })

    expect(await repository.rotateWithAudit(rotation, createRotationAudits(rotation))).toBe(
      "rotated",
    )
    const reuseAudits = createRotationAudits(rotation)
    expect(await repository.rotateWithAudit(rotation, reuseAudits)).toBe("reused")

    const activeCount = fixture.sqlite
      .query<{ count: number }, [string]>(
        "SELECT COUNT(*) AS count FROM system_sessions WHERE family_id = ?1 AND revoked_at IS NULL",
      )
      .get(familyId)?.count
    expect(activeCount).toBe(0)
    expect(
      fixture.sqlite
        .query<{ reason_code: string | null }, [string]>(
          "SELECT reason_code FROM system_audit_events WHERE event_id = ?1",
        )
        .get(reuseAudits.reused.eventId)?.reason_code,
    ).toBe("refresh_token_reused")
  })

  test("AccountEntity token version変更後のrotationをinvalidとしてfamily全体ごと失効する", async () => {
    const fixture = new SystemSessionTestContext()
    insertAccount(fixture)
    const rotation = createRotation()
    insertSession(fixture, createSession({ id: "session-1", tokenHash, createdAt, expiresAt }))
    fixture.sqlite
      .query("UPDATE system_accounts SET token_version = 1, updated_at = ?1 WHERE id = ?2")
      .run(rotatedAt.getTime(), accountId)
    const audits = createRotationAudits(rotation)
    const repository = new SystemSessionRepository({ context: fixture.context })

    expect(await repository.rotateWithAudit(rotation, audits)).toBe("invalid")
    expect(
      fixture.sqlite
        .query<{ revoked_at: number | null }, []>(
          "SELECT revoked_at FROM system_sessions WHERE id = 'session-1'",
        )
        .get()?.revoked_at,
    ).toBe(rotatedAt.getTime())
    expect(
      fixture.sqlite
        .query<{ reason_code: string | null }, [string]>(
          "SELECT reason_code FROM system_audit_events WHERE event_id = ?1",
        )
        .get(audits.invalid.eventId)?.reason_code,
    ).toBe("session_invalid")
  })

  test("複数の未消費SessionEntityがある壊れたfamilyをinvalidとしてfail closedに失効する", async () => {
    const fixture = new SystemSessionTestContext()
    insertAccount(fixture)
    const rotation = createRotation()
    insertSession(fixture, createSession({ id: "session-1", tokenHash, createdAt, expiresAt }))
    insertSession(
      fixture,
      createSession({ id: "unexpected-sibling", tokenHash: "c".repeat(64), createdAt, expiresAt }),
    )
    const repository = new SystemSessionRepository({ context: fixture.context })

    expect(await repository.rotateWithAudit(rotation, createRotationAudits(rotation))).toBe(
      "invalid",
    )
    expect(
      fixture.sqlite
        .query<{ count: number }, [string]>(
          "SELECT COUNT(*) AS count FROM system_sessions WHERE family_id = ?1 AND revoked_at IS NULL",
        )
        .get(familyId)?.count,
    ).toBe(0)
  })

  test("rotation監査insertが黙殺された場合はSessionEntity mutationも残さない", async () => {
    const fixture = new SystemSessionTestContext()
    insertAccount(fixture)
    const rotation = createRotation()
    insertSession(fixture, createSession({ id: "session-1", tokenHash, createdAt, expiresAt }))
    const audits = createRotationAudits(rotation)
    fixture.sqlite.exec(`
      CREATE TRIGGER ignore_rotation_audit_insert
      BEFORE INSERT ON system_audit_events
      WHEN NEW.event_id = '${audits.rotated.eventId}'
      BEGIN
        SELECT RAISE(IGNORE);
      END;
    `)
    const repository = new SystemSessionRepository({ context: fixture.context })

    expect(await repository.rotateWithAudit(rotation, audits)).toBeInstanceOf(Error)
    expect(
      fixture.sqlite
        .query<{ rotated_at: number | null; revoked_at: number | null }, []>(
          "SELECT rotated_at, revoked_at FROM system_sessions WHERE id = 'session-1'",
        )
        .get(),
    ).toEqual({ rotated_at: null, revoked_at: null })
    expect(getCount(fixture, "system_audit_events")).toBe(0)
  })

  test("family revokeと監査を同じtransactionで確定する", async () => {
    const fixture = new SystemSessionTestContext()
    insertAccount(fixture)
    const session = createSession({ id: "session-1", tokenHash, createdAt, expiresAt })
    insertSession(fixture, session)
    const audit = createAudit({
      action: "auth.session.logout",
      targetId: session.id,
      outcome: "succeeded",
      reasonCode: null,
      occurredAt: rotatedAt,
    })
    const repository = new SystemSessionRepository({ context: fixture.context })

    expect(
      await repository.revokeFamilyWithAudit({
        familyId: session.familyId,
        revokedAt: rotatedAt,
        audit,
      }),
    ).toBeUndefined()
    expect(
      fixture.sqlite
        .query<{ revoked_at: number | null }, []>(
          "SELECT revoked_at FROM system_sessions WHERE id = 'session-1'",
        )
        .get()?.revoked_at,
    ).toBe(rotatedAt.getTime())
    expect(getCount(fixture, "system_audit_events")).toBe(1)
  })
})
