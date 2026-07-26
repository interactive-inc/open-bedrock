import type { Context } from "@/env"

export type BrowserLoginCodeAccount = {
  accountId: number
  employeeId: number
}

/**
 * ブラウザへのログイン受け渡しの one-time code を扱う。
 * POST /auth/browser/code が認証済みの呼び出し元に払い出し、
 * POST /auth/browser/token が 1 回だけ消費してセッションを発行する。
 * access/refresh トークンは持たない（平文で保存領域に置かないため）。
 * 呼び出し元の account/employee の id のみを保持し、code 自体は保存せずハッシュ（code_hash）のみを主キーにする。
 */
export class BrowserLoginCodeRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  /** code のハッシュをキーに呼び出し元アカウントを記録する。 */
  async create(
    codeHash: string,
    account: BrowserLoginCodeAccount,
    expiresAt: number,
  ): Promise<null | Error> {
    try {
      await this.c.env.DB.prepare(
        `INSERT INTO browser_login_codes (code_hash, account_id, employee_id, expires_at)
         VALUES (?1, ?2, ?3, ?4)`,
      )
        .bind(codeHash, account.accountId, account.employeeId, expiresAt)
        .run()

      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to create browser login code")
    }
  }

  /**
   * code のハッシュを 1 回だけ引いて消費する（DELETE ... RETURNING で原子的に取得と削除を行う）。
   * 未失効（expires_at > nowEpoch）の行のみ返す。既に消費済み・失効済み・未知のハッシュは null。
   */
  async consume(
    codeHash: string,
    nowEpoch: number,
  ): Promise<BrowserLoginCodeAccount | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `DELETE FROM browser_login_codes
         WHERE code_hash = ?1 AND expires_at > ?2
         RETURNING account_id, employee_id`,
      )
        .bind(codeHash, nowEpoch)
        .first<{ account_id: number; employee_id: number }>()

      if (row === null) {
        return null
      }

      return { accountId: row.account_id, employeeId: row.employee_id }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to consume browser login code")
    }
  }
}
