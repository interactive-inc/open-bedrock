import type { SystemClockContext, SystemD1Context } from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"

/** 原記録の取得には、検証済みBearerと現在のDB権限を使用する。 */
export type AttendanceRecordSourceContext = SystemD1Context &
  SystemClockContext &
  Readonly<{ var: Readonly<{ bearerReadAuthentication?: SystemReadAuthentication }> }>
