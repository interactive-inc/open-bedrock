import { ApplyPersonnelAction } from "@/application/employee-lifecycle/apply-personnel-action"
import { GetEmployee } from "@/application/employee/get-employee"
import { LifecycleAccess } from "@/interface/utils/lifecycle-access"
import { lifecycleNoStore } from "@/interface/middlewares/lifecycle-no-store"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { resolvePersonnelActionPosition } from "@/interface/utils/resolve-personnel-action-position"
import { nonCorrectionWirePersonnelActionInputSchema } from "@/interface/utils/wire-personnel-action-input"
import type { PersonnelActionRecord } from "@/infrastructure/employee-lifecycle/personnel-action-repository"
import { ApplicationError, ValidationError } from "@/lib/errors"
import { factory } from "@/interface/utils/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const personnelActionResponse = (action: PersonnelActionRecord) => ({
  id: action.id,
  kind: action.kind,
  event_on: action.eventOn,
  recorded_at: new Date(action.recordedAt * 1_000).toISOString(),
  source_type: action.sourceType,
  source_application_id: action.sourceApplicationId,
  corrects_action_id: action.correctsActionId,
  summary: action.summary,
})

const requestSchema = z
  .object({
    action: nonCorrectionWirePersonnelActionInputSchema,
    expected_employee_revision: z.number().int().nonnegative(),
    expected_organization_revision: z.number().int().nonnegative().nullable(),
  })
  .strict()

export const POST = factory.createHandlers(
  lifecycleNoStore,
  verifyBearer,
  zValidator("json", requestSchema),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    const body = c.req.valid("json")
    const employee = await new GetEmployee(c).run({ code: body.action.employeeCode })
    if (employee instanceof ApplicationError) throw new NotFoundError("employee not found")
    if (!session.hasPermission("employee:lifecycle:apply")) {
      await new LifecycleAccess({ c, session }).appendDeniedAudit({
        targetEmployeeId: employee.id,
        permission: "employee:lifecycle:apply",
        reasonCode: "permission_denied",
      })
      throw new ForbiddenError()
    }
    const scope = await new LifecycleAccess({ c, session }).resolveApplyScope(employee.id)
    if (scope instanceof Error) throw new InternalError("failed to resolve lifecycle scope")
    if (scope === null) {
      await new LifecycleAccess({ c, session }).appendDeniedAudit({
        targetEmployeeId: employee.id,
        permission: "employee:lifecycle:apply",
        reasonCode: "lifecycle_scope_denied",
      })
      throw new NotFoundError("employee not found")
    }
    const idempotencyKey = c.req.header("Idempotency-Key")
    if (idempotencyKey === undefined) {
      throw toHttpException(
        new ValidationError("Idempotency-Key が必要です", "personnel_action_stale"),
      )
    }
    const input = await resolvePersonnelActionPosition(c, body.action)
    if (input instanceof ApplicationError) throw toHttpException(input)
    const result = await new ApplyPersonnelAction(c).run({
      session,
      employeeId: employee.id,
      input,
      idempotencyKey,
      expectedEmployeeRevision: body.expected_employee_revision,
      expectedOrganizationRevision: body.expected_organization_revision,
    })
    if (result instanceof ApplicationError) throw toHttpException(result)
    return c.json(
      { ...personnelActionResponse(result.action), replayed: result.replayed },
      result.replayed ? 200 : 201,
    )
  },
)
