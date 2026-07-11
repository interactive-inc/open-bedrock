import type { Context } from "@/env"
import { refreshTokens } from "@/schema"
import { eq, and, isNull } from "drizzle-orm"

const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60

export class RefreshTokenRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async create(props: {
    accountId: number
    tokenHash: string
    familyId: string
    tokenVersion: number
    userAgent: string | null
    nowEpoch: number
  }): Promise<void | Error> {
    try {
      const db = this.c.var.database

      await db.insert(refreshTokens).values({
        accountId: props.accountId,
        tokenHash: props.tokenHash,
        familyId: props.familyId,
        tokenVersion: props.tokenVersion,
        expiresAt: props.nowEpoch + REFRESH_TOKEN_TTL_SECONDS,
        userAgent: props.userAgent,
        createdAt: props.nowEpoch,
      })
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to create refresh token")
    }
  }

  async findByHash(tokenHash: string): Promise<
    | {
        id: number
        accountId: number
        familyId: string
        tokenVersion: number
        expiresAt: number
        revokedAt: number | null
      }
    | null
    | Error
  > {
    try {
      const db = this.c.var.database

      const rows = await db
        .select({
          id: refreshTokens.id,
          accountId: refreshTokens.accountId,
          familyId: refreshTokens.familyId,
          tokenVersion: refreshTokens.tokenVersion,
          expiresAt: refreshTokens.expiresAt,
          revokedAt: refreshTokens.revokedAt,
        })
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .limit(1)

      const row = rows.at(0)

      if (row === undefined) {
        return null
      }

      return {
        id: row.id,
        accountId: row.accountId,
        familyId: row.familyId,
        tokenVersion: row.tokenVersion,
        expiresAt: row.expiresAt,
        revokedAt: row.revokedAt,
      }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find refresh token")
    }
  }

  /**
   * 未使用の旧トークンから後継を作り、旧トークンを失効する。D1 batch 内の条件付き
   * INSERT/UPDATE により、同じ旧トークンから後継が複数発行されるのを防ぐ。
   */
  async rotate(props: {
    tokenId: number
    tokenHash: string
    userAgent: string | null
    nowEpoch: number
  }): Promise<"rotated" | "reused" | Error> {
    try {
      const db = this.c.env.DB

      const results = await db.batch([
        db
          .prepare(
            `INSERT INTO refresh_tokens
              (account_id, token_hash, family_id, token_version, expires_at, revoked_at, user_agent, created_at)
             SELECT account_id, ?1, family_id, token_version, ?2, NULL, ?3, ?4
             FROM refresh_tokens
             WHERE id = ?5 AND revoked_at IS NULL
             RETURNING id`,
          )
          .bind(
            props.tokenHash,
            props.nowEpoch + REFRESH_TOKEN_TTL_SECONDS,
            props.userAgent,
            props.nowEpoch,
            props.tokenId,
          ),
        db
          .prepare(
            "UPDATE refresh_tokens SET revoked_at = ?1 WHERE id = ?2 AND revoked_at IS NULL RETURNING id",
          )
          .bind(props.nowEpoch, props.tokenId),
      ])

      return results.at(0)?.results.length === 1 ? "rotated" : "reused"
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to rotate refresh token")
    }
  }

  async revokeFamily(familyId: string, nowEpoch: number): Promise<void | Error> {
    try {
      const db = this.c.var.database

      await db
        .update(refreshTokens)
        .set({ revokedAt: nowEpoch })
        .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)))
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to revoke token family")
    }
  }
}
