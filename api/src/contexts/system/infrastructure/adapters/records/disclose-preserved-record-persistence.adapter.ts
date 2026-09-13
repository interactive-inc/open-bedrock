import type { SystemD1Context } from "@system/configuration/system-context"
import type { PreservedRecordDisclosurePolicyEntity } from "@system/domain/entities/preserved-record-disclosure-policy.entity"
import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import type { SystemAttachmentRow } from "@system/infrastructure/schema/system-attachment"
import { PreservedRecordRepository } from "@system/infrastructure/repositories/records/preserved-record.repository"
import { PreservedRecordDisclosurePolicyRepository } from "@system/infrastructure/repositories/records/preserved-record-disclosure-policy.repository"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { PrepareAttachmentContentReadGuardAdapter } from "@system/infrastructure/adapters/attachments/prepare-attachment-content-read-guard.adapter"

type Context = SystemD1Context &
  Readonly<{ assertions: readonly [D1PreparedStatement, ...D1PreparedStatement[]] }>

/** 現在の開示資格と本文を固定し、開示監査を保存する。 */
export class DisclosePreservedRecordPersistenceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async findRecord(id: string) {
    if (this.c.assertions.length === 0) return new Error("record authorization is required")
    return new PreservedRecordRepository(this.c).find(id)
  }
  findPolicy(id: string) {
    return new PreservedRecordDisclosurePolicyRepository(this.c).findCurrent(id)
  }
  async write(
    input: Readonly<{
      policy: PreservedRecordDisclosurePolicyEntity
      request: unknown
      attachment: SystemAttachmentRow
      audit: SystemAuditEventEntity
      at: Date
    }>,
  ) {
    const guards = new PreservedRecordDisclosurePolicyRepository(this.c).prepareDisclosureGuard(
      input.policy,
      input.request,
    )
    if (guards instanceof Error) return guards
    return new SystemAuditEventRepository(this.c).append(input.audit, [
      ...guards,
      new PrepareAttachmentContentReadGuardAdapter(this.c).prepare(input.attachment, input.at),
    ])
  }
}
