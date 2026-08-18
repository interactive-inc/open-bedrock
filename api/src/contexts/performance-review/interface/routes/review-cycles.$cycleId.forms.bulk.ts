import { CreateReviewFormsBulk } from "@/contexts/performance-review/application/review/create-review-forms-bulk"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppReviewFormBulkResult } from "@/lib/app-schemas"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { validateIntParam } from "@/contexts/company-compatibility/interface/utils/validate-int-param"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/** POST /review-cycles/:cycleId/forms/bulk — 管理者が被評価者と評価者種別の組を一括作成（360度評価） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      forms: z
        .array(
          z.object({
            subject_employee_id: z.number().int().positive(),
            reviewer_employee_id: z.number().int().positive(),
            reviewer_type: z.enum(["self", "manager", "peer", "subordinate"]),
          }),
        )
        .min(1)
        .max(500),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const cycleId = validateIntParam(c.req.param("cycleId"), "review cycle")

    const json = c.req.valid("json")

    const created = await new CreateReviewFormsBulk(c).run({
      session,
      cycleId,
      forms: json.forms.map((form) => ({
        subjectEmployeeId: form.subject_employee_id,
        reviewerEmployeeId: form.reviewer_employee_id,
        reviewerType: form.reviewer_type,
      })),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppReviewFormBulkResult.parse({
      created_count: created.length,
      forms: created.map((form) => ({
        id: form.id,
        cycle_id: form.cycleId,
        subject_employee_id: form.subjectEmployeeId,
        reviewer_employee_id: form.reviewerEmployeeId,
        reviewer_type: form.reviewerType,
        answers: form.answers,
        score: form.score,
        status: form.status,
        submitted_at: form.submittedAt,
        visibility: form.visibility,
      })),
    })

    return c.json(responseBody, 201)
  },
)
