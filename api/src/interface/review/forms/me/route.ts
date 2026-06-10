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

// GET /review-forms/me — 本人が評価者として割り当てられたフォームの一覧
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

// answers は JSON 文字列で保存されているため配列に復元する。
function toAnswers(value: string): ReadonlyArray<unknown> {
  try {
    const decoded: unknown = JSON.parse(value)

    return Array.isArray(decoded) ? decoded : []
  } catch {
    return []
  }
}
