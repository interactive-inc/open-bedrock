import { ItIncident } from "@/domain/it-incident/it-incident.entity"
import { canManageItIncidents } from "@/lib/it-incident/can-manage-it-incidents"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import { ItIncidentRepository } from "@/infrastructure/it-incident/it-incident-repository"

export type Command = {
  session: SessionPayload
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
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ItIncident | ApplicationError> {
    if (canManageItIncidents(command.session) === false) {
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
      return new UnexpectedError("failed to create it incident", { cause: created })
    }

    return created
  }
}
