import { CancelTrainingEnrollment } from "@/application/training/cancel-training-enrollment"
import { GetTrainingEnrollment } from "@/application/training/get-training-enrollment"
import { RescheduleTrainingEnrollment } from "@/application/training/reschedule-training-enrollment"
import type { TrainingEnrollment } from "@/domain/training/training-enrollment"
import { factory } from "@/lib/factory"
import { isoDate } from "@/lib/schemas"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// 受講登録をレスポンス用の snake_case に整形する。
function toResponseBody(enrollment: TrainingEnrollment) {
  return {
    id: enrollment.id,
    course_id: enrollment.courseId,
    employee_id: enrollment.employeeId,
    status: enrollment.status,
    completed_at: enrollment.completedAt,
    score: enrollment.score,
    due_date: enrollment.dueDate,
  }
}

// GET /training/enrollments/:id — 受講登録の詳細（本人または管理権限）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const enrollmentId = Number(c.req.param("id"))

  if (Number.isInteger(enrollmentId) === false) {
    throw new BadRequestError("invalid enrollment id")
  }

  const enrollment = await new GetTrainingEnrollment(c).run({
    enrollmentId: enrollmentId,
    viewerEmployeeId: session.employeeId,
    viewerRole: session.role,
  })

  if (enrollment instanceof Error) {
    throw new InternalError("failed to load enrollment")
  }

  if ("reason" in enrollment) {
    if (enrollment.reason === "enrollment_not_found") {
      throw new NotFoundError("enrollment not found")
    }

    throw new ForbiddenError()
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

    const enrollmentId = Number(c.req.param("id"))

    if (Number.isInteger(enrollmentId) === false) {
      throw new BadRequestError("invalid enrollment id")
    }

    const body = c.req.valid("json")

    const updated = await new RescheduleTrainingEnrollment(c).run({
      enrollmentId: enrollmentId,
      viewerEmployeeId: session.employeeId,
      viewerRole: session.role,
      dueDate: body.due_date ?? null,
    })

    if (updated instanceof Error) {
      throw new InternalError("failed to update enrollment")
    }

    if ("reason" in updated) {
      if (updated.reason === "enrollment_not_found") {
        throw new NotFoundError("enrollment not found")
      }

      if (updated.reason === "forbidden") {
        throw new ForbiddenError()
      }

      throw new ConflictError("already completed")
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

  const enrollmentId = Number(c.req.param("id"))

  if (Number.isInteger(enrollmentId) === false) {
    throw new BadRequestError("invalid enrollment id")
  }

  const result = await new CancelTrainingEnrollment(c).run({
    enrollmentId: enrollmentId,
    viewerEmployeeId: session.employeeId,
    viewerRole: session.role,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to cancel enrollment")
  }

  if (result.reason === "enrollment_not_found") {
    throw new NotFoundError("enrollment not found")
  }

  if (result.reason === "forbidden") {
    throw new ForbiddenError()
  }

  if (result.reason === "already_completed") {
    throw new ConflictError("already completed")
  }

  return c.body(null, 204)
})
