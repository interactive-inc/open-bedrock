import { describe, expect, test } from "bun:test"
import type { AccessTokenView } from "@/application/auth/access-token-view"
import { RefreshAccessToken } from "@/application/auth/refresh-access-token"
import { RefreshTokenRepository } from "@/infrastructure/auth/refresh-token-repository"
import { refreshTokenHash } from "@/lib/auth/refresh-token-hash"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"

const jwtSecret = "refresh-access-token-test-secret"

async function setupRefreshToken(rawToken: string) {
  const { context, db } = createTestContext()

  await seedD1(db, "employees", [
    {
      id: 1,
      code: "E001",
      name: "Test Worker",
      dept_id: null,
      dept_name: null,
      position: null,
      status: "active",
    },
  ])

  await seedIamForEmployees(db, [
    { id: 1, email: "you@example.com", passwordHash: "hash", role: "member" },
  ])

  const repository = new RefreshTokenRepository(context)

  await repository.create({
    accountId: 1,
    tokenHash: await refreshTokenHash(rawToken),
    familyId: "test-family",
    tokenVersion: 0,
    userAgent: "test-agent",
    nowEpoch: Math.floor(Date.now() / 1000),
  })

  return { context, db }
}

function isIssued(
  result: Awaited<ReturnType<RefreshAccessToken["run"]>>,
): result is AccessTokenView {
  return !(result instanceof Error) && !("reason" in result)
}

describe("RefreshAccessToken", () => {
  test("revokes the rotated descendant when an old refresh token is reused", async () => {
    const rawToken = "old-refresh-token"

    const { context, db } = await setupRefreshToken(rawToken)

    const service = new RefreshAccessToken(context)

    const first = await service.run({
      refreshToken: rawToken,
      jwtSecret,
      userAgent: "first-client",
    })

    if (!isIssued(first) || first.refreshToken === null) {
      throw new Error("expected the first rotation to succeed")
    }

    const reused = await service.run({
      refreshToken: rawToken,
      jwtSecret,
      userAgent: "attacker",
    })

    expect(reused).toEqual({ reason: "invalid_token" })

    const descendant = await service.run({
      refreshToken: first.refreshToken,
      jwtSecret,
      userAgent: "first-client",
    })

    expect(descendant).toEqual({ reason: "invalid_token" })

    const active = await db
      .prepare(
        "SELECT COUNT(*) AS total FROM refresh_tokens WHERE family_id = ?1 AND revoked_at IS NULL",
      )
      .bind("test-family")
      .first<{ total: number }>()

    expect(active?.total).toBe(0)
  })

  test("issues at most one descendant for concurrent rotations and revokes the family", async () => {
    const rawToken = "concurrent-refresh-token"

    const { context, db } = await setupRefreshToken(rawToken)

    const service = new RefreshAccessToken(context)

    const results = await Promise.all([
      service.run({ refreshToken: rawToken, jwtSecret, userAgent: "client-a" }),
      service.run({ refreshToken: rawToken, jwtSecret, userAgent: "client-b" }),
    ])

    expect(results.filter(isIssued).length).toBeLessThanOrEqual(1)

    const active = await db
      .prepare(
        "SELECT COUNT(*) AS total FROM refresh_tokens WHERE family_id = ?1 AND revoked_at IS NULL",
      )
      .bind("test-family")
      .first<{ total: number }>()

    expect(active?.total).toBe(0)
  })

  test("rejects and revokes a refresh family after account tokenVersion changes", async () => {
    const rawToken = "versioned-refresh-token"

    const { context, db } = await setupRefreshToken(rawToken)

    await db.prepare("UPDATE accounts SET token_version = token_version + 1 WHERE id = 1").run()

    const result = await new RefreshAccessToken(context).run({
      refreshToken: rawToken,
      jwtSecret,
      userAgent: "stale-client",
    })

    expect(result).toEqual({ reason: "invalid_token" })

    const active = await db
      .prepare(
        "SELECT COUNT(*) AS total FROM refresh_tokens WHERE family_id = ?1 AND revoked_at IS NULL",
      )
      .bind("test-family")
      .first<{ total: number }>()

    expect(active?.total).toBe(0)
  })

  test("rejects and revokes refresh tokens for a retired employee", async () => {
    const rawToken = "retired-refresh-token"

    const { context, db } = await setupRefreshToken(rawToken)

    await db.prepare("UPDATE employees SET status = 'retired' WHERE id = 1").run()

    const result = await new RefreshAccessToken(context).run({
      refreshToken: rawToken,
      jwtSecret,
      userAgent: "retired-client",
    })

    expect(result).toEqual({ reason: "invalid_token" })

    const active = await db
      .prepare(
        "SELECT COUNT(*) AS total FROM refresh_tokens WHERE family_id = ?1 AND revoked_at IS NULL",
      )
      .bind("test-family")
      .first<{ total: number }>()

    expect(active?.total).toBe(0)
  })
})
