import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import type { SystemAuditEvent } from "@system/domain/audit/system-audit-event"
import type { SystemAuditJsonValue } from "@system/domain/audit/system-audit-json-value"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import type { AccountId } from "@system/domain/auth/account-id"

type Props = Readonly<{
  accountId: AccountId
  action: "auth.oidc.authorization" | "auth.oidc.token_exchange"
  outcome: "succeeded" | "denied"
  reasonCode: "user_denied" | null
  authorization: SystemAuditJsonValue
  metadata: SystemAuditJsonValue
  occurredAt: Date
}>

/** OIDCの固定語彙と安全に直列化した詳細からSystem監査eventを生成する。 */
export function createSystemOidcAudit(props: Props): SystemAuditEvent | Error {
  const authorizationJson = toStableSystemAuditJson(props.authorization)
  const metadataJson = toStableSystemAuditJson(props.metadata)

  if (authorizationJson instanceof Error) return authorizationJson
  if (metadataJson instanceof Error) return metadataJson

  return createSystemAuditEvent({
    actorAccountId: props.accountId,
    action: props.action,
    targetType: "identity",
    targetId: props.accountId,
    outcome: props.outcome,
    reasonCode: props.reasonCode,
    authorizationJson,
    beforeJson: null,
    afterJson: null,
    metadataJson,
    occurredAt: props.occurredAt,
  })
}
