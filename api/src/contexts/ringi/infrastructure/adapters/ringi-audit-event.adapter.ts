import type { SystemD1Context } from "@system/configuration/system-context"
import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { prepareSystemAuditEventAppend } from "@system/interface/operations/prepare-system-audit-event-append"

type Context = SystemD1Context

/** 稟議の変更と同じD1 batchへ追加するSystem監査イベントのappend文を返す。 */
export class RingiAuditEventAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepareAppend(event: SystemAuditEventEntity) {
    return prepareSystemAuditEventAppend({ database: this.c.env.DB, event })
  }
}
