import { submitSystemApplication } from "@/api/routes/application-requests/lib/system-application-operation"
import {
  parseSystemApplicationBody,
  toApplicationCurrentStep,
  toApplicationStatus,
} from "@/api/routes/application-requests/lib/system-application-view"
import { factory } from "@/contexts/company/interface/utils/factory"
import { jsonPayloadSchema } from "@/contexts/company/interface/utils/json-payload-schema"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zAppApplication } from "@/lib/app-schemas"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"

// @authorization owner - 本人のリソースに限定する
/** POST /application-requests — 本人として申請を作成 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      template_code: codeSchema,
      payload: jsonPayloadSchema(10_000),
    }),
  ),
  async (c) => {
    const body = c.req.valid("json")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const created = await submitSystemApplication(c, {
      applicantId: session.employeeId,
      templateCode: body.template_code,
      payload: body.payload,
      createdAt: new Date(c.env.NOW ?? Date.now()),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const payload = parseSystemApplicationBody(created.proposal)
    if (payload instanceof Error) throw payload
    const responseBody = zAppApplication.parse({
      id: created.proposal.number,
      template_code: created.proposal.procedureKey,
      template_name: created.proposal.title,
      applicant_name: created.applicantName,
      status: toApplicationStatus(created.proposal.status),
      current_step: toApplicationCurrentStep(created.proposal),
      payload: payload.value,
      created_at: created.proposal.createdAt.toISOString(),
      approver_roles: [...created.approverRoles],
    })

    return c.json(responseBody, 201)
  },
)
