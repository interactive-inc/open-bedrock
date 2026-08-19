import type { SystemAccessTokenAuthentication } from "@system/interface/runtime/system-access-token-authenticator"
import { SystemAccessTokenAuthenticator } from "@system/interface/runtime/system-access-token-authenticator"

/** 製品HTTP adapterから渡されたBearer credentialをSystem境界内で検証する。 */
export function authenticateSystemAccessTokenRequest(
  input: Readonly<{
    database: D1Database
    authorizationHeader: string | undefined
    jwtSecret: string
    now: Date
  }>,
): Promise<SystemAccessTokenAuthentication> {
  return new SystemAccessTokenAuthenticator({ database: input.database }).authenticate(
    input.authorizationHeader,
    input.jwtSecret,
    input.now,
  )
}
