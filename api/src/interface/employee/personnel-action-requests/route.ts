import { CreatePersonnelActionRequest } from "@/application/employee-lifecycle/create-personnel-action-request"
import { listAccessiblePersonnelActionRequests } from "@/application/employee-lifecycle/personnel-action-request-access"
import { personnelActionInputSchema } from "@/domain/employee-lifecycle/lifecycle-types"
import { PositionRepository } from "@/infrastructure/position/position-repository"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { ApplicationError, ValidationError } from "@/lib/errors"
import { factory } from "@/lib/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"

const requestSchema = z
  .object({
    action: personnelActionInputSchema,
    base_employee_revision: z.number().int().nonnegative(),
    base_organization_revision: z.number().int().nonnegative().nullable(),
  })
  .strict()

const listQuerySchema = z.object({
  target_employee_code: codeSchema.optional(),
  status: z.enum(["pending", "approved", "rejected", "withdrawn"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const GET = factory.createHandlers(
  verifyBearer,
  zValidator("query", listQuerySchema),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    const query = c.req.valid("query")
    const requests = await listAccessiblePersonnelActionRequests({
      c,
      session,
      targetEmployeeCode: query.target_employee_code,
      status: query.status,
      limit: query.limit,
    })
    if (requests instanceof ApplicationError) throw toHttpException(requests)
    return c.json(
      {
        requests: requests.map((request) => ({
          id: request.id,
          application_id: request.applicationId,
          target_employee_code: request.targetEmployeeCode,
          target_employee_name: request.targetEmployeeName,
          requested_by_employee_code: request.requestedByEmployeeCode,
          requested_by_employee_name: request.requestedByEmployeeName,
          kind: request.kind,
          status: request.status,
          current_step: request.currentStep,
          created_at: new Date(request.createdAt * 1_000).toISOString(),
          applied_action_id: request.appliedActionId,
          withdrawn_at:
            request.withdrawnAt === null
              ? null
              : new Date(request.withdrawnAt * 1_000).toISOString(),
        })),
      },
      200,
    )
  },
)

export const POST = factory.createHandlers(
  verifyBearer,
  zValidator("json", requestSchema),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    const body = c.req.valid("json")

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

    const result = await new CreatePersonnelActionRequest(c).run({
      session,
      input: actionInput,
      baseEmployeeRevision: body.base_employee_revision,
      baseOrganizationRevision: body.base_organization_revision,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })
    if (result instanceof ApplicationError) throw toHttpException(result)
    return c.json(
      {
        id: result.id,
        application_id: result.applicationId,
        target_employee_code: result.targetEmployeeCode,
        kind: result.kind,
        status: result.status,
        current_step: result.currentStep,
        created_at: result.createdAt,
      },
      201,
    )
  },
)
