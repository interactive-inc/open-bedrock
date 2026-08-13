import type { SystemSessionAuditContext } from "@system/application/auth/system-session-audit-context"
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import type { SystemAuditEvent } from "@system/domain/audit/system-audit-event"
import type { AccountId } from "@system/domain/auth/account-id"
import type { SessionId } from "@system/domain/auth/session-id"

type Props = Readonly<{
  actorAccountId: AccountId | null
  action: "auth.session.create" | "auth.session.rotate"
  targetId: SessionId | null
  outcome: "succeeded" | "denied"
  reasonCode: "refresh_token_reused" | "session_invalid" | null
  occurredAt: Date
  context: SystemSessionAuditContext
}>

/** canonical Session lifecycleの固定語彙からSystem監査イベントを生成する。 */
export function createSystemSessionAudit(props: Props): SystemAuditEvent | Error {
  return createSystemAuditEvent({
    actorAccountId: props.actorAccountId,
    action: props.action,
    targetType: "session",
    targetId: props.targetId,
    outcome: props.outcome,
    reasonCode: props.reasonCode,
    authorizationJson: props.context.authorizationJson,
    beforeJson: null,
    afterJson: null,
    metadataJson: props.context.metadataJson,
    occurredAt: props.occurredAt,
  })
}
