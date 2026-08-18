import { ListLifecycleEvents } from "@/contexts/company-compatibility/application/employee-lifecycle/list-lifecycle-events"
import { GetEmployee } from "@/contexts/company-compatibility/application/employee/get-employee"
import { LifecycleAccess } from "@/contexts/company-compatibility/interface/utils/lifecycle-access"
import { lifecycleNoStore } from "@/contexts/company-compatibility/interface/middlewares/lifecycle-no-store"
import {
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/contexts/company-compatibility/interface/lib/errors"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { validateCodeParam } from "@/contexts/company-compatibility/interface/utils/validate-code-param"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { fingerprintLifecycleFilter } from "@/lib/pagination/fingerprint-lifecycle-filter"
import { isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const limit = z
  .string()
  .regex(/^(?:[1-9]|[1-9][0-9]|100)$/u)
  .optional()

// @authorization service - session を application service に渡して判定する
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
    const authorization = await new LifecycleAccess({ c, session }).resolveReadAuthorization(
      employee.id,
    )
    if (authorization instanceof Error) throw new InternalError("failed to resolve lifecycle scope")
    if (authorization === null) {
      await new LifecycleAccess({ c, session }).appendDeniedAudit({
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
    await new LifecycleAccess({ c, session }).appendReadAudit({
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
