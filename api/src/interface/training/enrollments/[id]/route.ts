import { CancelTrainingEnrollment } from "@/application/training/cancel-training-enrollment"
import { GetTrainingEnrollment } from "@/application/training/get-training-enrollment"
import { RescheduleTrainingEnrollment } from "@/application/training/reschedule-training-enrollment"
import type { TrainingEnrollment } from "@/domain/training/training-enrollment.entity"
import { factory } from "@/lib/factory"
import { isoDate } from "@/lib/schemas"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/interface/lib/errors"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import { zAppTrainingEnrollment } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// 受講登録をレスポンス用の snake_case に整形する。
function toResponseBody(enrollment: TrainingEnrollment) {
  return zAppTrainingEnrollment.parse({
    id: enrollment.id,
    course_id: enrollment.courseId,
    employee_id: enrollment.employeeId,
    status: enrollment.status,
    completed_at: enrollment.completedAt,
    score: enrollment.score,
    due_date: enrollment.dueDate,
  })
}

// GET /training/enrollments/:id — 受講登録の詳細（本人または管理権限）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const enrollmentId = validateIntParam(c.req.param("id"), "enrollment")

  const enrollment = await new GetTrainingEnrollment(c).run({
    enrollmentId: enrollmentId,
    viewerEmployeeId: session.employeeId,
    session: session,
  })

  if (enrollment instanceof ApplicationError) {
    throw toHttpException(enrollment)
  }

  return c.json(toResponseBody(enrollment), 200)
})

// PUT /training/enrollments/:id — 受講期限を変更（本人または管理権限）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator("json", z.object({ due_date: isoDate.nullable().optional() })),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const enrollmentId = validateIntParam(c.req.param("id"), "enrollment")

    const body = c.req.valid("json")

    const updated = await new RescheduleTrainingEnrollment(c).run({
      enrollmentId: enrollmentId,
      viewerEmployeeId: session.employeeId,
      session: session,
      dueDate: body.due_date ?? null,
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    return c.json(toResponseBody(updated), 200)
  },
)

// DELETE /training/enrollments/:id — 受講を取り消す（本人または管理権限）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const enrollmentId = validateIntParam(c.req.param("id"), "enrollment")

  const result = await new CancelTrainingEnrollment(c).run({
    enrollmentId: enrollmentId,
    viewerEmployeeId: session.employeeId,
    session: session,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
