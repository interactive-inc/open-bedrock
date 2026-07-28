import type { Context } from "@/env"

export type MarkJtiResult = "recorded" | "replayed"

/**
 * 外部 identity トークンの使用済み jti を記録し、再利用(replay)を検知する。
 * jti は主キーのため、同一 jti の 2 回目の挿入は一意制約違反になる。これを "replayed" として扱う。
 */
export class IdentityLoginJtiRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  /**
   * jti を使用済みとして記録する。初回は "recorded"、既に記録済み(=二重使用)なら "replayed" を返す。
   * INSERT ... ON CONFLICT DO NOTHING で原子的に判定する（changes() が 0 なら衝突＝replay）。
   */
  async markUsed(jti: string, expiresAt: number, usedAt: number): Promise<MarkJtiResult | Error> {
    try {
      const result = await this.c.env.DB.prepare(
        `INSERT INTO identity_login_jti (jti, expires_at, used_at)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(jti) DO NOTHING`,
      )
        .bind(jti, expiresAt, usedAt)
        .run()

      return result.meta.changes > 0 ? "recorded" : "replayed"
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to record identity login jti")
    }
  }
}
