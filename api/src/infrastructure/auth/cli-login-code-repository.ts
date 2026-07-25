import type { Context } from "@/env"

export type CliLoginCodeTokens = {
  accessToken: string
  refreshToken: string
}

/**
 * CLI（ネイティブアプリ）ログインの one-time code を扱う。
 * GET /auth/cli/callback がセッション発行後に払い出し、POST /auth/cli/token が 1 回だけ引き換える。
 * code 自体は保存せずハッシュ（code_hash）のみを主キーにする。
 */
export class CliLoginCodeRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  /** code のハッシュをキーにトークン対を記録する。 */
  async create(
    codeHash: string,
    tokens: CliLoginCodeTokens,
    expiresAt: number,
  ): Promise<null | Error> {
    try {
      await this.c.env.DB.prepare(
        `INSERT INTO cli_login_codes (code_hash, access_token, refresh_token, expires_at)
         VALUES (?1, ?2, ?3, ?4)`,
      )
        .bind(codeHash, tokens.accessToken, tokens.refreshToken, expiresAt)
        .run()

      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to create cli login code")
    }
  }

  /**
   * code のハッシュを 1 回だけ引いて消費する（DELETE ... RETURNING で原子的に取得と削除を行う）。
   * 未失効（expires_at > nowEpoch）の行のみ返す。既に消費済み・失効済み・未知のハッシュは null。
   */
  async consume(codeHash: string, nowEpoch: number): Promise<CliLoginCodeTokens | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `DELETE FROM cli_login_codes
         WHERE code_hash = ?1 AND expires_at > ?2
         RETURNING access_token, refresh_token`,
      )
        .bind(codeHash, nowEpoch)
        .first<{ access_token: string; refresh_token: string }>()

      if (row === null) {
        return null
      }

      return { accessToken: row.access_token, refreshToken: row.refresh_token }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to consume cli login code")
    }
  }
}
