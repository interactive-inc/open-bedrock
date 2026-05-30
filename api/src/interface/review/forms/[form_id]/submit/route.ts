import { SubmitReviewForm } from "@/application/review/submit-review-form"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// POST /review-forms/:form_id/submit — 割り当てられた評価者がフォームを提出
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      score: z.number().optional(),
      answers: z.array(z.unknown()).optional(),
      comment: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const formId = Number(c.req.param("form_id"))

    if (Number.isInteger(formId) === false) {
      throw new BadRequestError("invalid form id")
    }

    const submitted = await new SubmitReviewForm(c).run({
      viewerEmployeeId: session.employeeId,
      formId,
      score: json.score ?? null,
      answers: json.answers ?? [],
      submittedAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (submitted instanceof Error) {
      throw new InternalError("failed to submit review form")
    }

    if ("reason" in submitted) {
      if (submitted.reason === "form_not_found") {
        throw new NotFoundError("review form not found")
      }

      if (submitted.reason === "forbidden") {
        throw new ForbiddenError()
      }

      throw new ConflictError("review form cannot be submitted")
    }

    const responseBody = {
      id: submitted.id,
      cycle_id: submitted.cycleId,
      subject_employee_id: submitted.subjectEmployeeId,
      reviewer_employee_id: submitted.reviewerEmployeeId,
      reviewer_type: submitted.reviewerType,
      answers: submitted.answers,
      score: submitted.score,
      status: submitted.status,
      submitted_at: submitted.submittedAt,
    }

    return c.json(responseBody, 200)
  },
)
