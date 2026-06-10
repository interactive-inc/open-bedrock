import { canAdministerCycle } from "@/domain/review/can-administer-cycle"
import { ReviewCycle } from "@/domain/review/review-cycle"
import { ReviewForm } from "@/domain/review/review-form"
import { toCycleStatus } from "@/domain/review/to-cycle-status"
import { toReviewResultView } from "@/domain/review/to-review-result-view"
import { factory } from "@/lib/factory"
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
  if (canAdministerCycle(session.role) === false) {
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
    status: toCycleStatus(cycleRow.status),
    dueDate: cycleRow.dueDate,
  })
  const view = toReviewResultView(cycle, forms, employeeRow.id)
  if (view instanceof Error) {
    throw new InternalError(view.message)
  }
  const body = {
    cycle_id: view.cycleId,
    subject_employee_id: view.subjectEmployeeId,
    form_count: view.formCount,
    submitted_count: view.submittedCount,
    average_score: view.averageScore,
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
    })),
  }
  return c.json(body, 200)
})
