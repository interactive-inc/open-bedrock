import type { SessionFamilyId } from "@system/domain/auth/session-family-id"
import type { SessionId } from "@system/domain/auth/session-id"
import type { SessionTokenHash } from "@system/domain/auth/session-token-hash"

/** raw tokenとopaque IDの生成・hash化をruntimeから注入するApplication port。 */
export type SystemSessionMaterialService = Readonly<{
  generateSessionId: () => SessionId | Error
  generateFamilyId: () => SessionFamilyId | Error
  generateRawToken: () => string | Error
  hashRawToken: (rawToken: string) => Promise<SessionTokenHash | Error>
}>
