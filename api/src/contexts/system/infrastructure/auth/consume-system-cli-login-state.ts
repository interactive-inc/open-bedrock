import type { SystemD1Context } from "@system/infrastructure/configuration/system-context"

/** 未失効のCLI login stateをDELETE RETURNINGで一度だけ消費する。 */
export async function consumeSystemCliLoginState(
  context: SystemD1Context,
  state: string,
  now: Date,
): Promise<Readonly<{ port: number; cliState: string; codeVerifier: string }> | null | Error> {
  try {
    const row = await context.env.DB.prepare(
      `DELETE FROM system_cli_login_states
       WHERE state = ?1 AND expires_at > ?2
       RETURNING port, cli_state, code_verifier`,
    )
      .bind(state, now.getTime())
      .first<{ port: number; cli_state: string; code_verifier: string }>()
    return row === null
      ? null
      : { port: row.port, cliState: row.cli_state, codeVerifier: row.code_verifier }
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("failed to consume System CLI login state")
  }
}
