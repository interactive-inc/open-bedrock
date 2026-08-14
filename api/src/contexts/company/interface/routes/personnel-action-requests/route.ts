import { CreatePersonnelActionRequest } from "@/contexts/company/application/employee-lifecycle/create-personnel-action-request"
import { PersonnelActionRequestAccess } from "@/contexts/company/application/employee-lifecycle/personnel-action-request-access"
import { resolvePersonnelActionPosition } from "@/contexts/company/interface/utils/resolve-personnel-action-position"
import { wirePersonnelActionInputSchema } from "@/contexts/company/interface/utils/wire-personnel-action-input"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/contexts/company/interface/utils/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"

const requestSchema = z
  .object({
    action: wirePersonnelActionInputSchema,
    base_employee_revision: z.number().int().nonnegative(),
    base_organization_revision: z.number().int().nonnegative().nullable(),
  })
  .strict()

const listQuerySchema = z.object({
  target_employee_code: codeSchema.optional(),
  status: z.enum(["pending", "approved", "rejected", "withdrawn"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

// @authorization service - session を application service に渡して判定する
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator("query", listQuerySchema),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    const query = c.req.valid("query")
    const requests = await new PersonnelActionRequestAccess({ c, session }).list({
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

// @authorization service - session を application service に渡して判定する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator("json", requestSchema),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    const body = c.req.valid("json")
    const input = await resolvePersonnelActionPosition(c, body.action)
    if (input instanceof ApplicationError) throw toHttpException(input)
    const result = await new CreatePersonnelActionRequest(c).run({
      session,
      input,
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
