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
    userAgent: string | null
    nowEpoch: number
  }): Promise<void | Error> {
    try {
      const db = this.c.var.database

      await db.insert(refreshTokens).values({
        accountId: props.accountId,
        tokenHash: props.tokenHash,
        familyId: props.familyId,
        expiresAt: props.nowEpoch + REFRESH_TOKEN_TTL_SECONDS,
        userAgent: props.userAgent,
        createdAt: props.nowEpoch,
      })
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to create refresh token")
    }
  }

  async findValidByHash(
    tokenHash: string,
    nowEpoch: number,
  ): Promise<
    | {
        id: number
        accountId: number
        familyId: string
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
          expiresAt: refreshTokens.expiresAt,
        })
        .from(refreshTokens)
        .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)))
        .limit(1)

      const row = rows.at(0)

      if (row === undefined) {
        return null
      }

      if (row.expiresAt <= nowEpoch) {
        return null
      }

      return { id: row.id, accountId: row.accountId, familyId: row.familyId }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find refresh token")
    }
  }

  async revoke(tokenId: number, nowEpoch: number): Promise<void | Error> {
    try {
      const db = this.c.var.database

      await db
        .update(refreshTokens)
        .set({ revokedAt: nowEpoch })
        .where(eq(refreshTokens.id, tokenId))
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to revoke refresh token")
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
