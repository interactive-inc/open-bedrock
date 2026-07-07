import { canReadAuditLogs } from "@/lib/iam/can-read-audit-logs"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import type { AuditLogPage } from "@/infrastructure/iam/audit-log-repository"
import { AuditLogRepository } from "@/infrastructure/iam/audit-log-repository"

export type Command = {
  session: SessionPayload
  actorAccountId: number | null
  action: string | null
  targetType: string | null
  from: number | null
  to: number | null
  limit: number
  offset: number
}

/**
 * 監査ログを新しい順に一覧する。audit_log:read 権限が必要。
 */
export class ListAuditLogs {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<AuditLogPage | ApplicationError> {
    if (canReadAuditLogs(command.session) === false) {
      return new ForbiddenError("cannot read audit logs", "forbidden")
    }

    const auditLogRepository = new AuditLogRepository(this.c)

    const found = await auditLogRepository.search({
      actorAccountId: command.actorAccountId,
      action: command.action,
      targetType: command.targetType,
      from: command.from,
      to: command.to,
      limit: command.limit,
      offset: command.offset,
    })

    if (found instanceof Error) {
      return new UnexpectedError("failed to list audit logs", { cause: found })
    }

    return found
  }
}
