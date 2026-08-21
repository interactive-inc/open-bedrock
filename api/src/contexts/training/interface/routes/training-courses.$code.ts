import { ArchiveTrainingCourse } from "@/contexts/training/application/archive-training-course"
import { UpdateTrainingCourse } from "@/contexts/training/application/update-training-course"
import type { TrainingCourse } from "@/contexts/training/domain/entities/training-course.entity"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { NotFoundError, UnauthorizedError } from "@/lib/http/errors"
import { validateCodeParam } from "@/lib/http/validate-code-param"
import { zAppTrainingCourse } from "@/lib/app-schemas"
import { trainingCourses } from "@/contexts/training/infrastructure/schema/training"
import { zValidator } from "@hono/zod-validator"
import { eq } from "drizzle-orm"
import { z } from "zod"

/** 研修コースをレスポンス用の snake_case に整形する。 */
function toResponseBody(course: TrainingCourse) {
  return zAppTrainingCourse.parse({
    id: course.id,
    code: course.code,
    title: course.title,
    description: course.description,
    duration_minutes: course.durationMinutes,
    category: course.category,
    is_required: course.isRequired,
    status: course.status,
  })
}

// @authorization authenticated - ログインしていれば誰でも読める共有データ
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const code = validateCodeParam(c.req.param("code"), "training course")

  const rows = await c.var.database
    .select()
    .from(trainingCourses)
    .where(eq(trainingCourses.code, code))
    .limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("course not found")
  }

  const responseBody = zAppTrainingCourse.parse({
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    duration_minutes: row.durationMinutes,
    category: row.category,
    is_required: row.isRequired,
    status: row.status,
  })

  return c.json(responseBody, 200)
})

// @authorization service - session を application service に渡して判定する
/** PUT /training-courses/:code — 研修コースの内容を変更（管理権限のみ） */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      title: z.string().min(1).max(500),
      category: z.string().min(1).max(200),
      description: z.string().max(3_000).nullable().optional(),
      duration_minutes: z.number().int().positive().nullable().optional(),
      is_required: z.boolean().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const body = c.req.valid("json")

    const updated = await new UpdateTrainingCourse(c).run({
      session: session,
      code: validateCodeParam(c.req.param("code"), "training course"),
      title: body.title,
      category: body.category,
      description: body.description ?? null,
      durationMinutes: body.duration_minutes ?? null,
      isRequired: body.is_required ?? false,
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    return c.json(toResponseBody(updated), 200)
  },
)

// @authorization service - session を application service に渡して判定する
/** DELETE /training-courses/:code — 研修コースをアーカイブ（管理権限のみ） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new ArchiveTrainingCourse(c).run({
    session: session,
    code: validateCodeParam(c.req.param("code"), "training course"),
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
