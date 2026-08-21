import { EmployeeRepository } from "@/contexts/company/infrastructure/employee/employee.repository"
import { NotFoundError as ApplicationNotFoundError, UnexpectedError } from "@/lib/errors"
import { ApplyPersonnelAction } from "@/contexts/company/application/employee-lifecycle/apply-personnel-action"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { LifecycleAccess } from "@/contexts/administration/interface/utils/lifecycle-access"
import { lifecycleNoStore } from "@/contexts/administration/interface/middlewares/lifecycle-no-store"
import { ForbiddenError, InternalError, NotFoundError, UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { verifyBearer } from "@/api/http/verify-bearer"
import { resolvePersonnelActionPosition } from "@/contexts/administration/interface/utils/resolve-personnel-action-position"
import { nonCorrectionWirePersonnelActionInputSchema } from "@/contexts/administration/interface/utils/wire-personnel-action-input"
import type { PersonnelActionRecord } from "@/contexts/company/infrastructure/employee-lifecycle/personnel-action.repository"
import { ApplicationError, ValidationError } from "@/lib/errors"
import { factory } from "@/api/http/factory"
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

// @authorization permission - 権限キーで判定する
export const POST = factory.createHandlers(
  lifecycleNoStore,
  verifyBearer,
  zValidator("json", requestSchema),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    const body = c.req.valid("json")
    const employee = await (async () => {
      const command = { code: body.action.employeeCode }

      const employeeRepository = new EmployeeRepository(c)

      const employee = await employeeRepository.findByCode(command.code)

      if (employee instanceof Error) {
        return new UnexpectedError("failed to find employee", {
          cause: employee,
        })
      }

      if (employee === null) {
        return new ApplicationNotFoundError("employee not found", "employee_not_found")
      }

      return employee
    })()
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
    if (result instanceof CompanyOperationError) {
      throw new InternalError("failed to apply personnel action")
    }
    return c.json(
      { ...personnelActionResponse(result.action), replayed: result.replayed },
      result.replayed ? 200 : 201,
    )
  },
)
