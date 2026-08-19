import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import type { SystemD1Context } from "@system/infrastructure/configuration/system-context"

/** 外部Identity login拒否をSystem監査へfail-closedで記録する。 */
export class SystemIdentityLoginAuditRecorder {
  constructor(private readonly context: SystemD1Context) {
    Object.freeze(this)
  }

  async recordDenied(reasonCode: string, occurredAt: Date): Promise<null | Error> {
    const event = createSystemAuditEvent({
      actorAccountId: null,
      action: "auth.session.identity_login_denied",
      targetType: "session",
      targetId: null,
      outcome: "denied",
      reasonCode,
      authorizationJson: null,
      beforeJson: null,
      afterJson: null,
      metadataJson: null,
      occurredAt,
    })
    if (event instanceof Error) return event

    const appended = await new SystemAuditEventRepository(this.context).append(event)

    return appended instanceof Error ? appended : null
  }
}
