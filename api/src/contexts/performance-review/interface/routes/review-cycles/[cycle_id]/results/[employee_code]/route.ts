import { toReviewCycleStatus } from "@/contexts/performance-review/domain/review/review-cycle-status.value"
import { ReviewCycle } from "@/contexts/performance-review/domain/review/review-cycle.entity"
import { ReviewForm } from "@/contexts/performance-review/domain/review/review-form.entity"
import { toReviewResultView } from "@/contexts/performance-review/interface/routes/review-cycles/[cycle_id]/results/[employee_code]/to-review-result-view"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { zAppReviewResult } from "@/lib/app-schemas"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { employees } from "@/contexts/company-compatibility/infrastructure/schema/employee"
import {
  reviewCycles,
  reviewForms,
} from "@/contexts/performance-review/infrastructure/schema/performance-review"
import { and, asc, eq } from "drizzle-orm"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/contexts/company-compatibility/interface/lib/errors"
import { validateCodeParam } from "@/contexts/company-compatibility/interface/utils/validate-code-param"
import { validateIntParam } from "@/contexts/company-compatibility/interface/utils/validate-int-param"

// @authorization permission - 権限キーで判定する
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) {
    throw new UnauthorizedError()
  }
  const cycleId = validateIntParam(c.req.param("cycle_id"), "review cycle")

  const cycleRows = await c.var.database
    .select()
    .from(reviewCycles)
    .where(eq(reviewCycles.id, cycleId))
    .limit(1)
  const cycleRow = cycleRows.at(0)
  if (cycleRow === undefined) {
    throw new NotFoundError("review cycle not found")
  }
  const employeeRows = await c.var.database
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.code, validateCodeParam(c.req.param("employee_code"), "employee")))
    .limit(1)
  const employeeRow = employeeRows.at(0)
  if (employeeRow === undefined) {
    throw new NotFoundError("employee not found")
  }
  const formRows = await c.var.database
    .select()
    .from(reviewForms)
    .where(and(eq(reviewForms.cycleId, cycleId), eq(reviewForms.subjectEmployeeId, employeeRow.id)))
    .orderBy(asc(reviewForms.id))
  const canAdminister = session.hasPermission("review:administer")
  let visibleFormRows = formRows

  if (canAdminister === false) {
    if (cycleRow.status !== "closed") {
      throw new ForbiddenError()
    }

    if (employeeRow.id !== session.employeeId) {
      visibleFormRows = formRows.filter(
        (form) => form.reviewerEmployeeId === session.employeeId && form.status === "submitted",
      )

      if (visibleFormRows.length === 0) {
        throw new ForbiddenError()
      }
    }
  }
  const forms = visibleFormRows.map((row) => ReviewForm.fromRow(row))
  const cycle = new ReviewCycle({
    id: cycleRow.id,
    title: cycleRow.title,
    period: cycleRow.period,
    status: toReviewCycleStatus(cycleRow.status),
    dueDate: cycleRow.dueDate,
  })
  const view = toReviewResultView(cycle, forms, employeeRow.id)
  if (view instanceof Error) {
    throw new InternalError("internal server error")
  }
  // 360-degree review confidentiality: when the subject employee views their own
  // results as a non-admin, strip reviewer identity to keep feedback anonymous.
  const isSelfView = canAdminister === false && employeeRow.id === session.employeeId
  const responseBody = zAppReviewResult.parse({
    cycle_id: view.cycleId,
    subject_employee_id: view.subjectEmployeeId,
    form_count: view.formCount,
    submitted_count: view.submittedCount,
    average_score: view.averageScore,
    reviewer_type_summary: view.reviewerTypeSummary.map((summary) => ({
      reviewer_type: summary.reviewerType,
      form_count: summary.formCount,
      submitted_count: summary.submittedCount,
    })),
    forms: view.forms.map((form) => ({
      id: form.id,
      cycle_id: form.cycleId,
      subject_employee_id: form.subjectEmployeeId,
      reviewer_employee_id: isSelfView ? 0 : form.reviewerEmployeeId,
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
