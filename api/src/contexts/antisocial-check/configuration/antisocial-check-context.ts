import type {
  SystemAuthorizationContext,
  SystemClockContext,
  SystemD1Context,
} from "@system/configuration/system-context"
import type { AuthenticatedAccountContext } from "@/env"

/** antisocial check記録の保全が利用する認証主体、会社時刻、保存先。 */
export type AntisocialCheckContext = AuthenticatedAccountContext &
  SystemD1Context &
  SystemClockContext &
  SystemAuthorizationContext &
  Readonly<{
    env: {
      COMPANY_TIME_ZONE?: string
      NOW?: string
      RECORD_SOURCE_NAMESPACE?: string
    }
  }>
