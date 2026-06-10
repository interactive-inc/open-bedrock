import { ApplyToCareerPosting } from "@/application/career/apply-to-career-posting"
import { factory } from "@/lib/factory"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import {
  ConflictError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { z } from "zod"

export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      message: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const postingId = validateIntParam(c.req.param("posting_id"), "posting")

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

    if (view instanceof Error) {
      throw new InternalError("failed to create application")
    }

    if ("reason" in view) {
      if (view.reason === "already_applied") {
        throw new ConflictError("already applied")
      }

      throw new NotFoundError("posting not found")
    }

    const responseBody = {
      id: view.id,
      posting_id: view.postingId,
      applicant_id: view.applicantId,
      message: view.message,
      status: view.status,
    }

    return c.json(responseBody, 201)
  },
)
