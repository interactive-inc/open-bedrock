import type { Context } from "@/env"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import type { SystemClockContext } from "@system/configuration/system-context"

/** 知識の改訂が再検査する認証主体と時計。 */
export type KnowledgeContext = Context &
  SystemClockContext &
  Readonly<{
    var: { userId: string; bearerReadAuthentication?: SystemReadAuthentication }
  }>
