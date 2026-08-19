import { RefreshAccessToken } from "@/contexts/company/application/auth/refresh-access-token"
import { createTestContext } from "@/api/test/support/create-test-context"
import type { Context } from "@/env"
import { UnavailableError } from "@/lib/errors"
import { SystemSessionMaterialService } from "@system/infrastructure/auth/system-session-material.service"
import { describe, expect, test } from "bun:test"

const jwtSecret = "refresh-access-token-test-secret"
const now = new Date("2026-01-01T00:00:00.000Z")
const familyId = "canonical-test-family"

type SetupOptions = Readonly<{
  accountStatus?: "active" | "suspended" | "locked"
  accountTokenVersion?: number
  employeeStatus?: "active" | "leave" | "retired"
  includeEmployee?: boolean
  includeSession?: boolean
  revokedAt?: Date | null
  tokenVersion?: number
}>

async function setupSystemSession(rawToken: string, options: SetupOptions = {}) {
  const { context, db } = createTestContext()

  if (options.includeEmployee !== false) {
    await db
      .prepare("INSERT INTO employees (id, code, name, status) VALUES (1, 'E001', 'Test', ?1)")
      .bind(options.employeeStatus ?? "active")
      .run()
  }
  await db
    .prepare(
      `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES (1, ?1, ?2, ?3, ?3)`,
    )
    .bind(
      options.accountStatus ?? "active",
      options.accountTokenVersion ?? 0,
      now.getTime() - 1_000,
    )
    .run()
  if (options.includeEmployee !== false) {
    await db
      .prepare("INSERT INTO account_employee_links (account_id, employee_id) VALUES (1, 1)")
      .run()
  }

  if (options.includeSession !== false) {
    const tokenHash = await new SystemSessionMaterialService().hashRawToken(rawToken)
    if (tokenHash instanceof Error) throw tokenHash
    await db
      .prepare(
        `INSERT INTO system_sessions
           (id, account_id, family_id, token_hash, token_version, created_at, expires_at,
            rotated_at, revoked_at)
         VALUES (?1, '1', ?2, ?3, ?4, ?5, ?6, NULL, ?7)`,
      )
      .bind(
        crypto.randomUUID(),
        familyId,
        tokenHash,
        options.tokenVersion ?? 0,
        now.getTime() - 1_000,
        now.getTime() + 86_400_000,
        options.revokedAt?.getTime() ?? null,
      )
      .run()
  }

  return { context, db }
}

function command(refreshToken: string, userAgent = "test-agent") {
  return { refreshToken, jwtSecret, userAgent, now }
}

async function activeFamilyCount(db: D1Database): Promise<number | null> {
  return db
    .prepare(
      `SELECT COUNT(*) AS count FROM system_sessions
       WHERE family_id = ?1 AND rotated_at IS NULL AND revoked_at IS NULL`,
    )
    .bind(familyId)
    .first<number>("count")
}

async function systemAudits(db: D1Database) {
  return (
    await db
      .prepare(
        `SELECT actor_account_id, action, target_type, outcome, reason_code, metadata_json
         FROM system_audit_events ORDER BY occurred_at, rowid`,
      )
      .all<{
        actor_account_id: string | null
        action: string
        target_type: string
        outcome: string
        reason_code: string | null
        metadata_json: string | null
      }>()
  ).results
}

function mutateBeforeNextBatch(context: Context, mutation: () => Promise<unknown>): void {
  const database = context.env.DB
  let pending = true
  context.env.DB = new Proxy(database, {
    get(target, property, receiver) {
      if (property !== "batch") return Reflect.get(target, property, receiver)
      return async (statements: Array<D1PreparedStatement>) => {
        if (pending) {
          pending = false
          await mutation()
        }
        return target.batch(statements)
      }
    },
  })
}

describe("RefreshAccessToken", () => {
  test("canonical Sessionをrotationし、再利用時はfamily全体を失効する", async () => {
    const rawToken = "a".repeat(64)
    const { context, db } = await setupSystemSession(rawToken)
    const service = new RefreshAccessToken(context)

    const rotated = await service.run(command(rawToken, "first-client"))
    if (rotated instanceof Error || "reason" in rotated) throw new Error("rotation failed")
    expect(rotated.refreshToken).toMatch(/^[0-9a-f]{64}$/)
    expect(rotated.refreshToken).not.toBe(rawToken)

    expect(await service.run(command(rawToken, "reuse-client"))).toEqual({
      reason: "invalid_token",
    })
    expect(await activeFamilyCount(db)).toBe(0)
    expect(
      (await systemAudits(db)).map(({ action, outcome, reason_code }) => ({
        action,
        outcome,
        reason_code,
      })),
    ).toEqual([
      { action: "auth.session.rotate", outcome: "succeeded", reason_code: null },
      { action: "auth.session.rotate", outcome: "denied", reason_code: "refresh_token_reused" },
    ])

    const persisted = JSON.stringify(
      await db.prepare("SELECT * FROM system_sessions").all<Record<string, unknown>>(),
    )
    expect(persisted).not.toContain(rawToken)
    expect(persisted).not.toContain(rotated.refreshToken)
    expect(persisted).not.toContain(rotated.accessToken)
  })

  test("同じtokenの同時rotationで子を一つだけ作りreuseを検出する", async () => {
    const rawToken = "b".repeat(64)
    const { context, db } = await setupSystemSession(rawToken)
    const service = new RefreshAccessToken(context)

    const results = await Promise.all([
      service.run(command(rawToken, "client-a")),
      service.run(command(rawToken, "client-b")),
    ])

    expect(
      results.filter((result) => !(result instanceof Error) && !("reason" in result)),
    ).toHaveLength(1)
    expect(results.filter((result) => !(result instanceof Error) && "reason" in result)).toEqual([
      { reason: "invalid_token" },
    ])
    expect(await activeFamilyCount(db)).toBe(0)
  })

  test("未知tokenを列挙耐性のある拒否へ畳みSystem監査へ残す", async () => {
    const { context, db } = await setupSystemSession("c".repeat(64), { includeSession: false })

    expect(await new RefreshAccessToken(context).run(command("d".repeat(64)))).toEqual({
      reason: "invalid_token",
    })
    expect(await systemAudits(db)).toMatchObject([
      {
        actor_account_id: null,
        action: "auth.session.rotate",
        target_type: "session",
        outcome: "denied",
        reason_code: "session_invalid",
      },
    ])
  })

  test.each([
    ["suspended account", { accountStatus: "suspended" as const }],
    ["locked account", { accountStatus: "locked" as const }],
    ["token version drift", { accountTokenVersion: 1 }],
    ["missing employee", { includeEmployee: false }],
    ["retired employee", { employeeStatus: "retired" as const }],
  ])("%sではtokenを返さずfamilyを失効する", async (_, options) => {
    const rawToken = "e".repeat(64)
    const { context, db } = await setupSystemSession(rawToken, options)

    expect(await new RefreshAccessToken(context).run(command(rawToken))).toEqual({
      reason: "invalid_token",
    })
    expect(await activeFamilyCount(db)).toBe(0)
  })

  test("認証後のAccount停止raceをrotation transactionでfail closedにする", async () => {
    const rawToken = "f".repeat(64)
    const { context, db } = await setupSystemSession(rawToken)
    mutateBeforeNextBatch(context, () =>
      db
        .prepare(
          "UPDATE system_accounts SET status = 'suspended', token_version = 1, updated_at = ?1 WHERE id = '1'",
        )
        .bind(now.getTime())
        .run(),
    )

    expect(await new RefreshAccessToken(context).run(command(rawToken))).toEqual({
      reason: "invalid_token",
    })
    expect(await activeFamilyCount(db)).toBe(0)
  })

  test("System監査insert失敗時はrotationをrollbackしてtokenを返さない", async () => {
    const rawToken = "1".repeat(64)
    const { context, db } = await setupSystemSession(rawToken)
    await db.exec(`
      CREATE TRIGGER reject_system_session_audit
      BEFORE INSERT ON system_audit_events
      BEGIN
        SELECT RAISE(ABORT, 'forced System audit failure');
      END;
    `)

    const result = await new RefreshAccessToken(context).run(command(rawToken))

    expect(result).toBeInstanceOf(UnavailableError)
    expect(await activeFamilyCount(db)).toBe(1)
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM system_sessions").first<number>("count"),
    ).toBe(1)
    expect(await systemAudits(db)).toEqual([])
  })

  test("AUDIT_HMAC_SECRETに依存せずcanonical System監査で安全に更新する", async () => {
    const rawToken = "2".repeat(64)
    const { context } = await setupSystemSession(rawToken)
    delete (context.env as Partial<Context["env"]>).AUDIT_HMAC_SECRET

    const result = await new RefreshAccessToken(context).run(command(rawToken))

    expect(result).not.toBeInstanceOf(Error)
    expect(result).not.toHaveProperty("reason")
  })
})
