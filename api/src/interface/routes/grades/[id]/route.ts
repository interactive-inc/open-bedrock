import { DeleteGrade } from "@/application/grade/delete-grade"
import { UpdateGrade } from "@/application/grade/update-grade"
import type { Grade } from "@/domain/grade/grade.entity"
import { factory } from "@/lib/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppGrade } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** 等級をレスポンス用スキーマで検証する。 */
function toResponseBody(grade: Grade) {
  return zAppGrade.parse({
    id: grade.id,
    code: grade.code,
    name: grade.name,
    rank: grade.rank,
    description: grade.description,
    created_at: grade.createdAt,
  })
}

/** パスパラメータの id を正の整数に変換する。不正値は 404。 */
function toGradeId(value: string | undefined): number {
  return validateIntParam(value, "grade")
}

/** PUT /grades/:id — 等級マスタの定義を変更（grade:manage） */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      code: z.string().min(1).max(100),
      name: z.string().min(1).max(200),
      rank: z.number().int(),
      description: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const grade = await new UpdateGrade(c).run({
      session,
      gradeId: toGradeId(c.req.param("id") ?? ""),
      code: json.code,
      name: json.name,
      rank: json.rank,
      description: json.description ?? null,
    })

    if (grade instanceof ApplicationError) {
      throw toHttpException(grade)
    }

    return c.json(toResponseBody(grade), 200)
  },
)

/** DELETE /grades/:id — 等級マスタを削除（grade:manage） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new DeleteGrade(c).run({
    session,
    gradeId: toGradeId(c.req.param("id") ?? ""),
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
