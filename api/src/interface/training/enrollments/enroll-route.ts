import { EnrollTraining } from "@/application/training/enroll-training"
import { factory } from "@/lib/factory"
import { isoDate } from "@/lib/schemas"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      course_code: z.string().min(1),
      employee_code: z.string().optional(),
      due_date: isoDate.optional(),
    }),
  ),
  async (c) => {
    const body = c.req.valid("json")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const created = await new EnrollTraining(c).run({
      viewerEmployeeId: session.employeeId,
      viewerRole: session.role,
      courseCode: body.course_code,
      enrolleeEmployeeCode: body.employee_code ?? null,
      dueDate: body.due_date ?? null,
    })

    if (created instanceof Error) {
      throw new InternalError("failed to create enrollment")
    }

    if ("reason" in created) {
      if (created.reason === "forbidden") {
        throw new ForbiddenError()
      }

      if (created.reason === "employee_not_found") {
        throw new NotFoundError("employee not found")
      }

      if (created.reason === "course_not_found") {
        throw new NotFoundError("course not found")
      }

      if (created.reason === "course_archived") {
        throw new ConflictError("course is archived")
      }

      throw new ConflictError("already enrolled")
    }

    const responseBody = {
      id: created.id,
      course_id: created.courseId,
      employee_id: created.employeeId,
      status: created.status,
      completed_at: created.completedAt,
      score: created.score,
      due_date: created.dueDate,
    }

    return c.json(responseBody, 201)
  },
)
