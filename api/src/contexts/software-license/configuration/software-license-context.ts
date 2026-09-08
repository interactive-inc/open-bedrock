import type {
  SystemAuthorizationContext,
  SystemClockContext,
  SystemD1Context,
} from "@system/configuration/system-context"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"

/** 台帳が利用する認証主体、会社営業日、保存先。 */
export type SoftwareLicenseContext = SystemD1Context &
  SystemClockContext &
  SystemAuthorizationContext &
  Readonly<{
    env: { COMPANY_TIME_ZONE?: string; NOW?: string; SOFTWARE_LICENSE_ENABLED?: string }
    var: { licenseSession: CompanySessionValue | null }
  }>
