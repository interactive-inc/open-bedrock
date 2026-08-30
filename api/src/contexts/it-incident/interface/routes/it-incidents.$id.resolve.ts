import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import { ItIncidentRepository } from "@/contexts/it-incident/infrastructure/repositories/it-incident.repository"

import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppItIncident } from "@/contexts/it-incident/interface/http/response-schemas"
import { toHttpException } from "@/lib/http/to-http-exception"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { verifyBearer } from "@/api/http/verify-bearer"
import { UnauthorizedError } from "@/lib/http/errors"

// @authorization service - session を application service に渡して判定する
/** POST /it-incidents/:id/resolve — インシデントを解消済みに倒す（it_incident:manage） */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const updated = await (async () => {
    const command = {
      session,
      id: validateIntParam(c.req.param("id"), "it_incident"),
      resolvedAt: c.env.NOW ?? new Date().toISOString(),
    }

    const repository = new ItIncidentRepository(c)

    if (command.session.hasPermission("it_incident:manage") === false) {
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
  })()

  if (updated instanceof ApplicationError) {
    throw toHttpException(updated)
  }

  const responseBody = zAppItIncident.parse({
    id: updated.id,
    occurred_at: updated.occurredAt,
    title: updated.title,
    summary: updated.summary,
    severity: updated.severity,
    status: updated.status,
    resolved_at: updated.resolvedAt,
    created_at: updated.createdAt,
  })

  return c.json(responseBody, 200)
})
