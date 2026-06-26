import { SubmitApplication } from "@/application/application/submit-application"
import { factory } from "@/lib/factory"
import { jsonPayloadSchema } from "@/interface/shared/json-payload-schema"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/interface/lib/errors"
import { zAppApplication } from "@/lib/app-schemas"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"

// POST /applications — 本人として申請を作成
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
    })

    return c.json(responseBody, 201)
  },
)
