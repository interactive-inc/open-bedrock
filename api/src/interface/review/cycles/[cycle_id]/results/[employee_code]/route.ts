import { toReviewCycleStatus } from "@/domain/review/review-cycle-status.value"
import { canAdministerCycle } from "@/lib/review/can-administer-cycle"
import { ReviewCycle } from "@/domain/review/review-cycle.entity"
import { ReviewForm } from "@/domain/review/review-form.entity"
import { toReviewResultView } from "@/lib/review/to-review-result-view"
import { factory } from "@/lib/factory"
import { zAppReviewResult } from "@/lib/app-schemas"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { employees, reviewCycles, reviewForms } from "@/schema"
import { and, asc, eq } from "drizzle-orm"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { validateCodeParam } from "@/interface/shared/validate-code-param"
import { validateIntParam } from "@/interface/shared/validate-int-param"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) {
    throw new UnauthorizedError()
  }
  if (canAdministerCycle(session) === false) {
    throw new ForbiddenError()
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
  const forms = formRows.map((row) => ReviewForm.fromRow(row))
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
