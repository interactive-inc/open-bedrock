import { CompleteTrainingEnrollment } from "@/application/training/complete-training-enrollment"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      score: z.number().safe().int().min(0).max(100).optional(),
    }),
  ),
  async (c) => {
    const enrollmentId = validateIntParam(c.req.param("id"), "enrollment")

    const body = c.req.valid("json")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const completed = await new CompleteTrainingEnrollment(c).run({
      enrollmentId: enrollmentId,
      viewerEmployeeId: session.employeeId,
      viewerRole: session.role,
      score: body.score ?? null,
      completedAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (completed instanceof Error) {
      throw new InternalError("failed to complete enrollment")
    }

    if ("reason" in completed) {
      if (completed.reason === "enrollment_not_found") {
        throw new NotFoundError("enrollment not found")
      }

      if (completed.reason === "forbidden") {
        throw new ForbiddenError()
      }

      throw new ConflictError("already completed")
    }

    const responseBody = {
      id: completed.id,
      course_id: completed.courseId,
      employee_id: completed.employeeId,
      status: completed.status,
      completed_at: completed.completedAt,
      score: completed.score,
      due_date: completed.dueDate,
    }

    return c.json(responseBody, 200)
  },
)
