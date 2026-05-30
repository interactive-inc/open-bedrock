import { SubmitApplication } from "@/application/application/submit-application"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { InternalError, NotFoundError, UnauthorizedError } from "@/interface/lib/errors"
import { z } from "zod"

// POST /applications — 本人として申請を作成
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      template_code: z.string().min(1),
      payload: z.unknown(),
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

    if (created instanceof Error) {
      throw new InternalError("failed to submit application")
    }

    if ("reason" in created) {
      throw new NotFoundError("template not found")
    }

    const responseBody = {
      id: created.id,
      template_code: created.templateCode,
      template_name: created.templateName,
      applicant_name: created.applicantName,
      status: created.status,
      current_step: created.currentStep,
      payload: created.payload,
      created_at: created.createdAt,
    }

    return c.json(responseBody, 201)
  },
)
