import { ResolveItIncident } from "@/application/it-incident/resolve-it-incident"
import { factory } from "@/lib/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppItIncident } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"

// POST /it-incidents/:id/resolve — インシデントを解消済みに倒す（it_incident:manage）
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const updated = await new ResolveItIncident(c).run({
    session,
    id: validateIntParam(c.req.param("id"), "it_incident"),
    resolvedAt: c.env.NOW ?? new Date().toISOString(),
  })

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
