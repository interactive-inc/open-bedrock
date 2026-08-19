import { filterFormsForSubjectViewer } from "@/contexts/performance-review/interface/http/review-forms/filter-forms-for-subject-viewer"
import { toReviewerTypeSummary } from "@/contexts/performance-review/interface/lib/to-reviewer-type-summary"
import { factory } from "@/contexts/company/interface/utils/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { zAppReviewResult } from "@/lib/app-schemas"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"
import { ReviewFormRepository } from "@/contexts/performance-review/infrastructure/review/review-form-repository"

// @authorization permission - 権限キーで判定する
/**
 * GET /review-forms?subject_employee_id=&cycle_id= — 被評価者ごとのフォームと提出状況（360度評価の集計）。
 * 管理者は全件、被評価者本人は disclosed のみ閲覧できる（開示制御）。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const subjectEmployeeId = Number(c.req.query("subject_employee_id") ?? "")

  if (Number.isInteger(subjectEmployeeId) === false || subjectEmployeeId <= 0) {
    throw new BadRequestError("subject_employee_id is required")
  }

  const isAdministrator = session.hasPermission("review:administer")

  const isSubjectSelf = subjectEmployeeId === session.employeeId

  if (isAdministrator === false && isSubjectSelf === false) {
    throw new ForbiddenError()
  }

  const cycleIdRaw = c.req.query("cycle_id")

  const cycleId = cycleIdRaw === undefined ? null : Number(cycleIdRaw)

  if (cycleId !== null && (Number.isInteger(cycleId) === false || cycleId <= 0)) {
    throw new BadRequestError("cycle_id is invalid")
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

  const loaded = await new ReviewFormRepository(c).findBySubject({
    subjectEmployeeId,
    cycleId,
    limit,
    offset,
  })

  if (loaded instanceof Error) {
    throw new UnauthorizedError()
  }

  const forms = filterFormsForSubjectViewer({
    forms: loaded,
    isAdministrator,
    isSubjectSelf,
  })

  let submittedCount = 0

  let scoredCount = 0

  let scoreTotal = 0

  for (const form of forms) {
    if (form.status === "submitted") {
      submittedCount = submittedCount + 1

      if (form.score !== null) {
        scoredCount = scoredCount + 1

        scoreTotal = scoreTotal + form.score
      }
    }
  }

  const responseBody = zAppReviewResult.parse({
    cycle_id: cycleId ?? 0,
    subject_employee_id: subjectEmployeeId,
    form_count: forms.length,
    submitted_count: submittedCount,
    average_score: scoredCount === 0 ? null : scoreTotal / scoredCount,
    reviewer_type_summary: toReviewerTypeSummary(forms).map((summary) => ({
      reviewer_type: summary.reviewerType,
      form_count: summary.formCount,
      submitted_count: summary.submittedCount,
    })),
    forms: forms.map((form) => ({
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

  return c.json(responseBody, 200)
})
