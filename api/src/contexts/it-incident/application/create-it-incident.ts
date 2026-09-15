import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { ItIncident } from "@/contexts/it-incident/domain/entities/it-incident.entity"
import { ConflictError, ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { ItIncidentRepository } from "@/contexts/it-incident/infrastructure/repositories/it-incident.repository"
import { isItIncidentRecordSourceFrozenError } from "@/contexts/it-incident/infrastructure/repositories/lib/is-it-incident-record-source-frozen-error"

export type Command = {
  session: CompanySessionValue
  incident: {
    occurredAt: string
    title: string
    summary: string
    severity: string | null
  }
  createdAt: string
}

/**
 * 権限を確認し、インシデント記録を新規登録する。status は open で始まる。
 */
export class CreateItIncident {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<ItIncident | ApplicationError> {
    if (command.session.hasPermission("it_incident:manage") === false) {
      return new ForbiddenError("cannot manage it incidents", "forbidden")
    }

    const incident = ItIncident.create({
      occurredAt: command.incident.occurredAt,
      title: command.incident.title,
      summary: command.incident.summary,
      severity: command.incident.severity,
      createdAt: command.createdAt,
    })

    const created = await new ItIncidentRepository(this.c).create(incident)

    if (created instanceof Error) {
      if (isItIncidentRecordSourceFrozenError(created)) {
        return new ConflictError("IT incident writes are frozen", "record_source_frozen", {
          cause: created,
        })
      }
      return new UnexpectedError("failed to create it incident", { cause: created })
    }

    return created
  }
}
