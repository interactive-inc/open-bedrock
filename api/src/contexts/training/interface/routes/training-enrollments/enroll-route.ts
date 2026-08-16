import { EnrollTraining } from "@/contexts/training/application/enroll-training"
import { factory } from "@/contexts/company/interface/utils/factory"
import { isoDate } from "@/lib/schemas"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zAppTrainingEnrollment } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"

// @authorization service - session を application service に渡して判定する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      course_code: codeSchema,
      employee_code: codeSchema.optional(),
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
      session: session,
      courseCode: body.course_code,
      enrolleeEmployeeCode: body.employee_code ?? null,
      dueDate: body.due_date ?? null,
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppTrainingEnrollment.parse({
      id: created.id,
      course_id: created.courseId,
      employee_id: created.employeeId,
      status: created.status,
      completed_at: created.completedAt,
      score: created.score,
      due_date: created.dueDate,
    })

    return c.json(responseBody, 201)
  },
)
