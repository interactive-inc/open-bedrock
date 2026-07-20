import { ApplyPersonnelAction } from "@/application/employee-lifecycle/apply-personnel-action"
import { resolvePersonnelActionPosition } from "@/interface/utils/resolve-personnel-action-position"
import { nonCorrectionWirePersonnelActionInputSchema } from "@/interface/utils/wire-personnel-action-input"
import { PersonnelActionRepository } from "@/infrastructure/employee-lifecycle/personnel-action-repository"
import {
  appendLifecycleDeniedAudit,
  lifecycleNoStore,
  resolveLifecycleApplyScope,
} from "@/interface/utils/lifecycle-route-contract"
import { personnelActionResponse } from "@/interface/routes/personnel-actions/route"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { hasPermission } from "@/lib/auth/has-permission"
import { ApplicationError, ValidationError } from "@/lib/errors"
import { factory } from "@/lib/factory"
import { isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const requestSchema = z
  .object({
    event_on: isoDate,
    reason: z.string().trim().min(1).max(2000),
    replacement_action: nonCorrectionWirePersonnelActionInputSchema,
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
    const actionId = c.req.param("id") ?? ""
    if (!z.string().uuid().safeParse(actionId).success) throw new NotFoundError("action not found")
    const original = await new PersonnelActionRepository(c).findById(actionId)
    if (original instanceof ApplicationError) throw toHttpException(original)
    if (original === null) throw new NotFoundError("action not found")
    if (!hasPermission(session, "employee:lifecycle:apply")) {
      await appendLifecycleDeniedAudit({
        c,
        session,
        targetEmployeeId: original.employeeId,
        permission: "employee:lifecycle:apply",
        reasonCode: "permission_denied",
      })
      throw new ForbiddenError()
    }
    const scope = await resolveLifecycleApplyScope(c, session, original.employeeId)
    if (scope instanceof Error) throw new InternalError("failed to resolve lifecycle scope")
    if (scope === null) {
      await appendLifecycleDeniedAudit({
        c,
        session,
        targetEmployeeId: original.employeeId,
        permission: "employee:lifecycle:apply",
        reasonCode: "lifecycle_scope_denied",
      })
      throw new NotFoundError("action not found")
    }
    const idempotencyKey = c.req.header("Idempotency-Key")
    if (idempotencyKey === undefined) {
      throw toHttpException(
        new ValidationError("Idempotency-Key が必要です", "personnel_action_stale"),
      )
    }
    const body = c.req.valid("json")
    const input = await resolvePersonnelActionPosition(c, {
      kind: "corrected",
      eventOn: body.event_on,
      correctsActionId: original.id,
      reason: body.reason,
      replacementAction: body.replacement_action,
    })
    if (input instanceof ApplicationError) throw toHttpException(input)
    const result = await new ApplyPersonnelAction(c).run({
      session,
      employeeId: original.employeeId,
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
