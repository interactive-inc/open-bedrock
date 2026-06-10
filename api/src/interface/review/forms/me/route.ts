import { toAnswers } from "@/domain/review/review-form-helpers"
import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { reviewForms } from "@/schema"
import { asc, eq } from "drizzle-orm"

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
  const body = rows.map((row) => ({
    id: row.id,
    cycle_id: row.cycleId,
    subject_employee_id: row.subjectEmployeeId,
    reviewer_employee_id: row.reviewerEmployeeId,
    reviewer_type: row.reviewerType,
    answers: toAnswers(row.answers),
    score: row.score,
    status: row.status,
    submitted_at: row.submittedAt,
  }))
  return c.json(body, 200)
})
