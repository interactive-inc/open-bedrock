import type { SystemD1Context } from "@system/infrastructure/configuration/system-context"

export type CliLoginState = {
  port: number
  cliState: string
  codeVerifier: string
}

/**
 * CLI（ネイティブアプリ）ログインの one-time state を扱う。
 * GET /auth/cli/login がブローカーへ渡す state をキーに、ループバック先のポートと
 * CLI 側 state を保存する。GET /auth/cli/callback は 1 回だけ引いて即座に削除する（再利用不可）。
 */
export class CliLoginStateRepository {
  constructor(private readonly c: SystemD1Context) {
    Object.freeze(this)
  }

  /** state を新規記録する。state はランダム生成の一意値のため、通常は衝突しない。 */
  async create(state: string, input: CliLoginState, expiresAt: number): Promise<null | Error> {
    try {
      await this.c.env.DB.prepare(
        `INSERT INTO cli_login_states (state, port, cli_state, code_verifier, expires_at)
         VALUES (?1, ?2, ?3, ?4, ?5)`,
      )
        .bind(state, input.port, input.cliState, input.codeVerifier, expiresAt)
        .run()

      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to create cli login state")
    }
  }

  /**
   * state を 1 回だけ引いて消費する（DELETE ... RETURNING で原子的に取得と削除を行う）。
   * 未失効（expires_at > nowEpoch）の行のみ返す。既に消費済み・失効済み・未知の state は null。
   */
  async consume(state: string, nowEpoch: number): Promise<CliLoginState | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `DELETE FROM cli_login_states
         WHERE state = ?1 AND expires_at > ?2
         RETURNING port, cli_state, code_verifier`,
      )
        .bind(state, nowEpoch)
        .first<{ port: number; cli_state: string; code_verifier: string }>()

      if (row === null) {
        return null
      }

      return { port: row.port, cliState: row.cli_state, codeVerifier: row.code_verifier }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to consume cli login state")
    }
  }
}
