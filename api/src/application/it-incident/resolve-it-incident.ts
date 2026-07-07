import type { ItIncident } from "@/domain/it-incident/it-incident.entity"
import { canManageItIncidents } from "@/lib/it-incident/can-manage-it-incidents"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import { ItIncidentRepository } from "@/infrastructure/it-incident/it-incident-repository"

export type Command = {
  session: SessionPayload
  id: number
  resolvedAt: string
}

/**
 * 権限と存在を確認し、インシデントを解消済みに倒す。既に解消済みなら 409。
 */
export class ResolveItIncident {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ItIncident | ApplicationError> {
    const repository = new ItIncidentRepository(this.c)

    if (canManageItIncidents(command.session) === false) {
      return new ForbiddenError("cannot manage it incidents", "forbidden")
    }

    const incident = await repository.findById(command.id)

    if (incident instanceof Error) {
      return new UnexpectedError("failed to find it incident", { cause: incident })
    }

    if (incident === null) {
      return new NotFoundError("it incident not found", "it_incident_not_found")
    }

    if (incident.status === "resolved") {
      return new ConflictError("it incident already resolved", "it_incident_already_resolved")
    }

    const updated = await repository.update(incident.resolve(command.resolvedAt))

    if (updated instanceof Error) {
      return new UnexpectedError("failed to resolve it incident", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("it incident not found", "it_incident_not_found")
    }

    return updated
  }
}
