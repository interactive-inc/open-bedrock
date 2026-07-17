import { ApplyPersonnelAction } from "@/application/employee-lifecycle/apply-personnel-action"
import { GetEmployee } from "@/application/employee/get-employee"
import {
  appendLifecycleDeniedAudit,
  lifecycleNoStore,
  resolveLifecycleApplyScope,
} from "@/interface/employee/lifecycle-route-contract"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { nonCorrectionPersonnelActionInputSchema } from "@/domain/employee-lifecycle/lifecycle-types"
import type { PersonnelActionRecord } from "@/infrastructure/employee-lifecycle/personnel-action-repository"
import { PositionRepository } from "@/infrastructure/position/position-repository"
import { hasPermission } from "@/lib/auth/has-permission"
import { ApplicationError, ValidationError } from "@/lib/errors"
import { factory } from "@/lib/factory"
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
    action: nonCorrectionPersonnelActionInputSchema,
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
    if (!hasPermission(session, "employee:lifecycle:apply")) {
      await appendLifecycleDeniedAudit({
        c,
        session,
        targetEmployeeId: employee.id,
        permission: "employee:lifecycle:apply",
        reasonCode: "permission_denied",
      })
      throw new ForbiddenError()
    }
    const scope = await resolveLifecycleApplyScope(c, session, employee.id)
    if (scope instanceof Error) throw new InternalError("failed to resolve lifecycle scope")
    if (scope === null) {
      await appendLifecycleDeniedAudit({
        c,
        session,
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

    // positionTitle が含まれる発令はコードをマスタ名に解決する。
    // マスタが空（未セットアップ）の場合はフリーテキストとしてそのまま通す。
    const actionInput = { ...body.action }
    if ("positionTitle" in actionInput && actionInput.positionTitle != null) {
      const positionRepository = new PositionRepository(c)
      const positionCount = await positionRepository.count()
      if (positionCount instanceof Error) {
        throw new InternalError("failed to validate position")
      }
      if (positionCount > 0) {
        const position = await positionRepository.findByCode(actionInput.positionTitle)
        if (position instanceof Error) {
          throw new InternalError("failed to validate position")
        }
        if (position === null) {
          throw toHttpException(new ValidationError("position not found", "position_not_found"))
        }
        actionInput.positionTitle = position.name
      }
    }

    const result = await new ApplyPersonnelAction(c).run({
      session,
      employeeId: employee.id,
      input: actionInput,
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
