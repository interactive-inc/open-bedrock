import type { SystemD1Context } from "@system/infrastructure/configuration/system-context.repository"

/** CLI loginのbroker stateをhash不要のsingle-use値として短期間だけ保存する。 */
export async function createSystemCliLoginState(
  context: SystemD1Context,
  input: Readonly<{
    state: string
    port: number
    cliState: string
    codeVerifier: string
    createdAt: Date
    expiresAt: Date
  }>,
): Promise<null | Error> {
  try {
    await context.env.DB.prepare(
      `INSERT INTO system_cli_login_states
         (state, port, cli_state, code_verifier, created_at, expires_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
      .bind(
        input.state,
        input.port,
        input.cliState,
        input.codeVerifier,
        input.createdAt.getTime(),
        input.expiresAt.getTime(),
      )
      .run()
    return null
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("failed to create System CLI login state")
  }
}
