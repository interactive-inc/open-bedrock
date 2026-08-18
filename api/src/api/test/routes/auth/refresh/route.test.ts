import { app } from "@/api/app"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import type { Bindings } from "@/env"
import { SystemSessionMaterialService } from "@system/infrastructure/auth/system-session-material.service"
import { describe, expect, test } from "bun:test"
import { z } from "zod"

const jwtSecret = "auth-refresh-route-test-secret"
const now = new Date("2026-01-01T00:00:00.000Z")
const familyId = "route-refresh-family"

const refreshResponseSchema = z.strictObject({
  access_token: z.string(),
  refresh_token: z.string().length(64),
})

type Scenario =
  | "active"
  | "missing"
  | "expired"
  | "revoked"
  | "inactive_account"
  | "version_mismatch"
  | "missing_employee"
  | "retired_employee"

async function createScenario(scenario: Scenario) {
  const db = createD1TestDatabase(loadSchema())
  const refreshToken = scenario.padEnd(64, "0")
  if (scenario !== "missing_employee") {
    await db
      .prepare("INSERT INTO employees (id, code, name, status) VALUES (1, 'E001', 'Test', ?1)")
      .bind(scenario === "retired_employee" ? "retired" : "active")
      .run()
  }
  await db
    .prepare(
      `INSERT INTO accounts (id, status, token_version, created_at, updated_at)
       VALUES (1, ?1, ?2, ?3, ?3)`,
    )
    .bind(
      scenario === "inactive_account" ? "suspended" : "active",
      scenario === "version_mismatch" ? 1 : 0,
      now.getTime() - 1_000,
    )
    .run()
  if (scenario !== "missing_employee") {
    await db
      .prepare("INSERT INTO account_employee_links (account_id, employee_id) VALUES (1, 1)")
      .run()
  }

  if (scenario !== "missing") {
    const tokenHash = await new SystemSessionMaterialService().hashRawToken(refreshToken)
    if (tokenHash instanceof Error) throw tokenHash
    await db
      .prepare(
        `INSERT INTO system_sessions
           (id, account_id, family_id, token_hash, token_version, created_at, expires_at,
            rotated_at, revoked_at)
         VALUES ('route-session', '1', ?1, ?2, 0, ?3, ?4, NULL, ?5)`,
      )
      .bind(
        familyId,
        tokenHash,
        now.getTime() - 1_000,
        scenario === "expired" ? now.getTime() : now.getTime() + 86_400_000,
        scenario === "revoked" ? now.getTime() - 500 : null,
      )
      .run()
  }
  if (scenario === "revoked") {
    const descendantHash = await new SystemSessionMaterialService().hashRawToken("d".repeat(64))
    if (descendantHash instanceof Error) throw descendantHash
    await db
      .prepare(
        `INSERT INTO system_sessions
           (id, account_id, family_id, token_hash, token_version, created_at, expires_at,
            rotated_at, revoked_at)
         VALUES ('route-descendant', '1', ?1, ?2, 0, ?3, ?4, NULL, NULL)`,
      )
      .bind(familyId, descendantHash, now.getTime() - 400, now.getTime() + 86_400_000)
      .run()
  }

  return { db, refreshToken }
}

function postRefresh(
  db: D1Database,
  refreshToken: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path: "/auth/refresh",
    token: null,
    method: "POST",
    body: { refresh_token: refreshToken },
    headers,
  })
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

async function systemAuditCount(db: D1Database): Promise<number | null> {
  return db.prepare("SELECT COUNT(*) AS count FROM system_audit_events").first<number>("count")
}

describe("POST /auth/refresh", () => {
  test("canonical System Sessionを更新し公開tokenだけを返す", async () => {
    const { db, refreshToken } = await createScenario("active")
    const response = await postRefresh(db, refreshToken, {
      "CF-Connecting-IP": "198.51.100.42",
      "X-Open-Karte-Client": "web",
      "User-Agent": "refresh-route-agent",
    })

    expect(response.status).toBe(200)
    const body = refreshResponseSchema.parse(await response.json())
    expect(Object.keys(body).sort()).toEqual(["access_token", "refresh_token"])
    expect(body.refresh_token).not.toBe(refreshToken)
    expect(await activeFamilyCount(db)).toBe(1)
    expect(
      await db
        .prepare(
          `SELECT actor_account_id, action, target_type, outcome, reason_code, metadata_json
           FROM system_audit_events`,
        )
        .first<Record<string, unknown>>(),
    ).toMatchObject({
      actor_account_id: "1",
      action: "auth.session.rotate",
      target_type: "session",
      outcome: "succeeded",
      reason_code: null,
    })

    const persisted = JSON.stringify(
      await db.prepare("SELECT * FROM system_sessions").all<Record<string, unknown>>(),
    )
    expect(persisted).not.toContain(refreshToken)
    expect(persisted).not.toContain(body.refresh_token)
    expect(persisted).not.toContain(body.access_token)
  })

  test("全拒否理由を同じ401へ畳み内部ではSystem監査を残す", async () => {
    const scenarios: Scenario[] = [
      "missing",
      "expired",
      "revoked",
      "inactive_account",
      "version_mismatch",
      "missing_employee",
      "retired_employee",
    ]

    for (const scenario of scenarios) {
      const { db, refreshToken } = await createScenario(scenario)
      const response = await postRefresh(db, refreshToken)

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: "invalid or expired refresh token" })
      expect(await systemAuditCount(db)).toBe(1)
      expect(
        await db.prepare("SELECT action FROM system_audit_events").first<string>("action"),
      ).toBe(
        scenario === "missing_employee" || scenario === "retired_employee"
          ? "auth.session.revoke"
          : "auth.session.rotate",
      )
    }
  })

  test("旧AUDIT_HMAC_SECRETなしでもSystem監査とrotationが機能する", async () => {
    const { db, refreshToken } = await createScenario("active")
    const response = await app.request(
      "/auth/refresh",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
      {
        DB: db,
        JWT_SECRET: jwtSecret,
        NOW: now.toISOString(),
      } as Bindings,
    )

    expect(response.status).toBe(200)
    expect(await systemAuditCount(db)).toBe(1)
  })

  test("System監査insert失敗時はrotationをrollbackして503にする", async () => {
    const { db, refreshToken } = await createScenario("active")
    await db.exec(`
      CREATE TRIGGER reject_system_session_audit
      BEFORE INSERT ON system_audit_events
      BEGIN
        SELECT RAISE(ABORT, 'forced System audit failure');
      END;
    `)

    const response = await postRefresh(db, refreshToken)
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toEqual({
      error: "invalid or expired refresh token",
      code: "audit_unavailable",
    })
    expect(await activeFamilyCount(db)).toBe(1)
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM system_sessions").first<number>("count"),
    ).toBe(1)
    expect(await systemAuditCount(db)).toBe(0)
  })

  test("validator失敗はSystem Sessionへ到達しない", async () => {
    const { db } = await createScenario("active")
    for (const body of [{}, { refresh_token: "x".repeat(201) }]) {
      const response = await requestWithContext({
        db,
        jwtSecret,
        path: "/auth/refresh",
        token: null,
        method: "POST",
        body,
      })
      expect(response.status).toBe(400)
    }
    expect(await systemAuditCount(db)).toBe(0)
  })
})
