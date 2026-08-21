import { ApplyToCareerPosting } from "@/contexts/career/application/apply-to-career-posting"
import { factory } from "@/api/http/factory"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppCareerApplication } from "@/lib/app-schemas"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      message: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const postingId = validateIntParam(c.req.param("postingId"), "posting")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const view = await new ApplyToCareerPosting(c).run({
      postingId,
      applicantId: session.employeeId,
      message: json.message ?? null,
    })

    if (view instanceof ApplicationError) {
      throw toHttpException(view)
    }

    const responseBody = zAppCareerApplication.parse({
      id: view.id,
      posting_id: view.postingId,
      applicant_id: view.applicantId,
      message: view.message,
      status: view.status,
    })

    return c.json(responseBody, 201)
  },
)
