import { SubmitApplication } from "@/contexts/request/application/submit-application"
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

    const created = await new SubmitApplication(c).run({
      applicantId: session.employeeId,
      templateCode: body.template_code,
      payload: body.payload,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppApplication.parse({
      id: created.id,
      template_code: created.templateCode,
      template_name: created.templateName,
      applicant_name: created.applicantName,
      status: created.status,
      current_step: created.currentStep,
      payload: created.payload,
      created_at: created.createdAt,
      approver_roles: [...created.approverRoles],
    })

    return c.json(responseBody, 201)
  },
)
