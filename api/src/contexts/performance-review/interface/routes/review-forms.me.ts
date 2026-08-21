import { toAnswers } from "@/contexts/performance-review/domain/values/review-answers.definition"
import { factory } from "@/api/http/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { zAppReviewFormList } from "@/lib/app-schemas"
import { verifyBearer } from "@/api/http/verify-bearer"
import { UnauthorizedError } from "@/lib/http/errors"
import { reviewForms } from "@/contexts/performance-review/infrastructure/schema/performance-review"
import { asc, count, eq } from "drizzle-orm"

// @authorization owner - 本人のリソースに限定する
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) {
    throw new UnauthorizedError()
  }
  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })
  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })
  const rows = await c.var.database
    .select()
    .from(reviewForms)
    .where(eq(reviewForms.reviewerEmployeeId, session.employeeId))
    .orderBy(asc(reviewForms.id))
    .limit(limit)
    .offset(offset)

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(reviewForms)
    .where(eq(reviewForms.reviewerEmployeeId, session.employeeId))

  const responseBody = zAppReviewFormList.parse({
    data: rows.map((row) => ({
      id: row.id,
      cycle_id: row.cycleId,
      subject_employee_id: row.subjectEmployeeId,
      reviewer_employee_id: row.reviewerEmployeeId,
      reviewer_type: row.reviewerType,
      answers: toAnswers(row.answers),
      score: row.score,
      status: row.status,
      submitted_at: row.submittedAt,
      visibility: row.visibility,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
