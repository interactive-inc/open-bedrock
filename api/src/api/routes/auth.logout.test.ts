import { app } from "@/api/app"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import type { Bindings } from "@/env"
import { SystemSessionMaterialService } from "@system/infrastructure/auth/system-session-material.service"
import { describe, expect, test } from "bun:test"

const now = new Date("2026-01-01T00:00:00.000Z")

describe("POST /auth/logout", () => {
  test("canonical System Session familyを監査と同じ境界で失効する", async () => {
    const db = createD1TestDatabase(loadSchema())
    const refreshToken = "a".repeat(64)
    const tokenHash = await new SystemSessionMaterialService().hashRawToken(refreshToken)
    if (tokenHash instanceof Error) throw tokenHash
    await db
      .prepare(
        `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
         VALUES ('account-1', 'active', 0, ?1, ?1)`,
      )
      .bind(now.getTime() - 1_000)
      .run()
    await db
      .prepare(
        `INSERT INTO system_sessions
           (id, account_id, family_id, token_hash, token_version, created_at, expires_at,
            rotated_at, revoked_at)
         VALUES ('session-1', 'account-1', 'family-1', ?1, 0, ?2, ?3, NULL, NULL)`,
      )
      .bind(tokenHash, now.getTime() - 1_000, now.getTime() + 86_400_000)
      .run()

    const response = await app.request(
      "/auth/logout",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
      {
        DB: db,
        JWT_SECRET: "logout-test-secret",
        NOW: now.toISOString(),
      } as Bindings,
    )

    expect(response.status).toBe(204)
    expect(
      await db
        .prepare("SELECT revoked_at FROM system_sessions WHERE id = 'session-1'")
        .first<number>("revoked_at"),
    ).toBe(now.getTime())
    expect(await db.prepare("SELECT action FROM system_audit_events").first<string>("action")).toBe(
      "auth.session.revoke",
    )
  })

  test("未知tokenでも実在を漏らさず冪等に204を返す", async () => {
    const db = createD1TestDatabase(loadSchema())
    const response = await app.request(
      "/auth/logout",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh_token: "b".repeat(64) }),
      },
      {
        DB: db,
        JWT_SECRET: "logout-test-secret",
        NOW: now.toISOString(),
      } as Bindings,
    )

    expect(response.status).toBe(204)
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM system_audit_events").first<number>("count"),
    ).toBe(0)
  })
})
