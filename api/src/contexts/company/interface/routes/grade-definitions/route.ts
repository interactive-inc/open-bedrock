import { factory } from "@/interface/utils/factory"
import { zAppGradeList } from "@/lib/app-schemas"
import { GradeRepository } from "@/infrastructure/grade/grade-repository"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"

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
