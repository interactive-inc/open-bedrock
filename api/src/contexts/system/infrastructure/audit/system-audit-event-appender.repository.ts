import type { SystemAuditEvent } from "@system/domain/audit/system-audit-event"

/** mutationを伴わない拒否監査をappend-onlyで保存するApplication port。 */
export type SystemAuditEventAppender = Readonly<{
  append: (event: SystemAuditEvent) => Promise<void | Error>
}>
