import { CreateGrade } from "@/contexts/administration/application/grade/create-grade"
import { GradeRepository } from "@/contexts/administration/infrastructure/grade/grade.repository"
import { InternalError, UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { verifyBearer } from "@/api/http/verify-bearer"
import { factory } from "@/api/http/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { zAppGrade, zAppGradeList } from "@/lib/app-schemas"
import { ApplicationError } from "@/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/** POST /grade-definitions — 等級マスタを新規登録する（grade:manage） */
export const POST = factory.createHandlers(
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

    const grade = await new CreateGrade(c).run({
      session,
      code: json.code,
      name: json.name,
      rank: json.rank,
      description: json.description ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (grade instanceof ApplicationError) {
      throw toHttpException(grade)
    }

    const responseBody = zAppGrade.parse({
      id: grade.id,
      code: grade.code,
      name: grade.name,
      rank: grade.rank,
      description: grade.description,
      created_at: grade.createdAt,
    })

    return c.json(responseBody, 201)
  },
)

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/** GET /grade-definitions — 等級マスタ一覧（全認証者。マスタは公開情報） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  const repository = new GradeRepository(c)

  const grades = await repository.findAll({ limit, offset })

  if (grades instanceof Error) {
    throw new InternalError("failed to load grades")
  }

  const total = await repository.count()

  if (total instanceof Error) {
    throw new InternalError("failed to count grades")
  }

  const responseBody = zAppGradeList.parse({
    data: grades.map((grade) => ({
      id: grade.id,
      code: grade.code,
      name: grade.name,
      rank: grade.rank,
      description: grade.description,
      created_at: grade.createdAt,
    })),
    total,
  })

  return c.json(responseBody, 200)
})
