import type { Context, AuthenticatedAccountContext } from "@/env"
import type {
  SystemAuthorizationContext,
  SystemClockContext,
  SystemD1Context,
} from "@system/configuration/system-context"

/** 休暇4台帳の保全が利用する認証主体、会社時刻、保存先。 */
export type LeaveContext = AuthenticatedAccountContext &
  Context &
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
