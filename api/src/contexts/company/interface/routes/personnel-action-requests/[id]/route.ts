import { PersonnelActionRequestAccess } from "@/contexts/company/application/employee-lifecycle/personnel-action-request-access"
import { WithdrawPersonnelActionRequest } from "@/contexts/company/application/employee-lifecycle/withdraw-personnel-action-request"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { validateUuidParam } from "@/contexts/company/interface/utils/validate-uuid-param"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { ApplicationError, NotFoundError } from "@/lib/errors"
import { factory } from "@/contexts/company/interface/utils/factory"

// @authorization service - session を application service に渡して判定する
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const request = await new PersonnelActionRequestAccess({ c, session }).find(
    validateUuidParam(c.req.param("id"), "personnel action request"),
  )
  if (request instanceof ApplicationError) throw toHttpException(request)
  if (request === null) {
    throw toHttpException(
      new NotFoundError("人事変更申請が見つかりません", "personnel_action_request_not_found"),
    )
  }
  return c.json(
    {
      id: request.id,
      application_id: request.applicationId,
      target_employee_code: request.targetEmployeeCode,
      target_employee_name: request.targetEmployeeName,
      requested_by_employee_code: request.requestedByEmployeeCode,
      requested_by_employee_name: request.requestedByEmployeeName,
      action: request.action,
      kind: request.kind,
      base_employee_revision: request.baseEmployeeRevision,
      base_organization_revision: request.baseOrganizationRevision,
      status: request.status,
      current_step: request.currentStep,
      created_at: new Date(request.createdAt * 1_000).toISOString(),
      applied_action_id: request.appliedActionId,
      withdrawn_at:
        request.withdrawnAt === null ? null : new Date(request.withdrawnAt * 1_000).toISOString(),
    },
    200,
  )
})

// @authorization service - session を application service に渡して判定する
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const result = await new WithdrawPersonnelActionRequest(c).run({
    session,
    requestId: validateUuidParam(c.req.param("id"), "personnel action request"),
    withdrawnAt: c.env.NOW ?? new Date().toISOString(),
  })
  if (result instanceof ApplicationError) throw toHttpException(result)
  return c.json(result, 200)
})
