import { ListLifecycleEvents } from "@/application/employee-lifecycle/list-lifecycle-events"
import { GetEmployee } from "@/application/employee/get-employee"
import {
  appendLifecycleDeniedAudit,
  appendLifecycleReadAudit,
  lifecycleNoStore,
  resolveLifecycleReadAuthorization,
} from "@/interface/employee/lifecycle-route-contract"
import { InternalError, NotFoundError, UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { validateCodeParam } from "@/interface/shared/validate-code-param"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/lib/factory"
import { fingerprintLifecycleFilter } from "@/lib/pagination/lifecycle-cursor"
import { isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const limit = z
  .string()
  .regex(/^(?:[1-9]|[1-9][0-9]|100)$/u)
  .optional()

export const GET = factory.createHandlers(
  lifecycleNoStore,
  verifyBearer,
  zValidator(
    "query",
    z
      .object({
        from: isoDate.optional(),
        to: isoDate.optional(),
        limit,
        cursor: z.string().max(256).optional(),
      })
      .strict(),
  ),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    const employee = await new GetEmployee(c).run({
      code: validateCodeParam(c.req.param("code"), "employee"),
    })
    if (employee instanceof ApplicationError) throw new NotFoundError("employee not found")
    const authorization = await resolveLifecycleReadAuthorization(c, session, employee.id)
    if (authorization instanceof Error) throw new InternalError("failed to resolve lifecycle scope")
    if (authorization === null) {
      await appendLifecycleDeniedAudit({
        c,
        session,
        targetEmployeeId: employee.id,
        permission: "employee:read",
        reasonCode: "lifecycle_scope_denied",
      })
      throw new NotFoundError("employee not found")
    }
    const query = c.req.valid("query")
    const result = await new ListLifecycleEvents(c).run({
      employeeId: employee.id,
      from: query.from ?? null,
      to: query.to ?? null,
      limit: query.limit === undefined ? null : Number(query.limit),
      cursor: query.cursor ?? null,
    })
    if (result instanceof ApplicationError) throw toHttpException(result)
    const filterFingerprint = await fingerprintLifecycleFilter([
      employee.id,
      query.from ?? null,
      query.to ?? null,
    ])
    await appendLifecycleReadAudit({
      c,
      session,
      action: authorization.auditAction,
      targetEmployeeId: employee.id,
      scope: authorization.scope,
      resultCount: result.data.length,
      filterFingerprint,
    })
    return c.json(
      {
        data: result.data.map((event) => ({
          id: event.id,
          kind: event.kind,
          event_on: event.eventOn,
          recorded_at: new Date(event.recordedAt * 1_000).toISOString(),
          source_type: event.sourceType,
          source_application_id: event.sourceApplicationId,
          corrects_action_id: event.correctsActionId,
          display_status: event.displayStatus,
          summary: event.summary,
        })),
        next_cursor: result.nextCursor,
      },
      200,
    )
  },
)
