import type { SystemD1Context } from "@system/infrastructure/configuration/system-context"

export type CliLoginCodeAccount = {
  accountId: number
}

/**
 * CLI（ネイティブアプリ）ログインの one-time code を扱う。
 * GET /auth/cli/callback が identity 検証・プロビジョニング成功後に払い出し、
 * POST /auth/cli/token が 1 回だけ消費してセッションを発行する。
 * access/refresh トークンは持たない（平文で保存領域に置かないため）。
 * 解決済みの account id のみを保持し、code 自体は保存せずハッシュ（code_hash）のみを主キーにする。
 */
export class CliLoginCodeRepository {
  constructor(private readonly c: SystemD1Context) {
    Object.freeze(this)
  }

  /** code のハッシュをキーに解決済みアカウントを記録する。 */
  async create(
    codeHash: string,
    account: CliLoginCodeAccount,
    expiresAt: number,
  ): Promise<null | Error> {
    try {
      await this.c.env.DB.prepare(
        `INSERT INTO cli_login_codes (code_hash, account_id, expires_at)
         VALUES (?1, ?2, ?3)`,
      )
        .bind(codeHash, account.accountId, expiresAt)
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
  async consume(codeHash: string, nowEpoch: number): Promise<CliLoginCodeAccount | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `DELETE FROM cli_login_codes
         WHERE code_hash = ?1 AND expires_at > ?2
         RETURNING account_id`,
      )
        .bind(codeHash, nowEpoch)
        .first<{ account_id: number }>()

      if (row === null) {
        return null
      }

      return { accountId: row.account_id }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to consume cli login code")
    }
  }
}
