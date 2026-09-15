import type {
  SystemAuthorizationContext,
  SystemClockContext,
  SystemD1Context,
} from "@system/configuration/system-context"
import type { Context } from "@/env"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
/** knowledge記録の保全が利用する認証主体、会社時刻、保存先。 */
export type KnowledgeContext = Context &
  SystemD1Context &
  SystemClockContext &
  SystemAuthorizationContext &
  Readonly<{
    env: {
      COMPANY_TIME_ZONE?: string
      NOW?: string
      RECORD_SOURCE_NAMESPACE?: string
    }
    var: { userId: string; bearerReadAuthentication?: SystemReadAuthentication }
  }>
