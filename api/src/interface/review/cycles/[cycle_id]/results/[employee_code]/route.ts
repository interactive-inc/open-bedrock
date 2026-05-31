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
  BadRequestError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"

// GET /review-cycles/:cycle_id/results/:employee_code — 管理者が集計済みの評価結果を取得
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (canAdministerCycle(session.role) === false) {
    throw new ForbiddenError()
  }

  const cycleId = Number(c.req.param("cycle_id"))

  if (Number.isInteger(cycleId) === false) {
    throw new BadRequestError("invalid cycle id")
  }

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
    .where(eq(employees.code, c.req.param("employee_code") ?? ""))
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

  const forms = formRows.map(
    (row) =>
      new ReviewForm({
        id: row.id,
        cycleId: row.cycleId,
        subjectEmployeeId: row.subjectEmployeeId,
        reviewerEmployeeId: row.reviewerEmployeeId,
        reviewerType: toReviewerType(row.reviewerType),
        answers: toAnswers(row.answers),
        score: row.score,
        status: toFormStatus(row.status),
        submittedAt: row.submittedAt,
      }),
  )

  const cycle = new ReviewCycle({
    id: cycleRow.id,
    title: cycleRow.title,
    period: cycleRow.period,
    status: toCycleStatus(cycleRow.status),
    dueDate: cycleRow.dueDate,
  })

  const view = toReviewResultView(cycle, forms)

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

function toReviewerType(value: string): "self" | "manager" | "peer" | "subordinate" {
  if (value === "manager") {
    return "manager"
  }

  if (value === "peer") {
    return "peer"
  }

  if (value === "subordinate") {
    return "subordinate"
  }

  return "self"
}

function toFormStatus(value: string): "pending" | "submitted" {
  return value === "submitted" ? "submitted" : "pending"
}

function toAnswers(value: string): ReadonlyArray<unknown> {
  try {
    const decoded: unknown = JSON.parse(value)

    return Array.isArray(decoded) ? decoded : []
  } catch {
    return []
  }
}
