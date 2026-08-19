import { CompleteTrainingEnrollment } from "@/contexts/training/application/complete-training-enrollment"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"
import { zAppTrainingEnrollment } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
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
      session: session,
      score: body.score ?? null,
      completedAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (completed instanceof ApplicationError) {
      throw toHttpException(completed)
    }

    const responseBody = zAppTrainingEnrollment.parse({
      id: completed.id,
      course_id: completed.courseId,
      employee_id: completed.employeeId,
      status: completed.status,
      completed_at: completed.completedAt,
      score: completed.score,
      due_date: completed.dueDate,
    })

    return c.json(responseBody, 200)
  },
)
