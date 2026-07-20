import { factory } from "@/lib/factory"
import { zAppPositionList } from "@/lib/app-schemas"
import { PositionRepository } from "@/infrastructure/position/position-repository"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"

/** GET /positions — 役職マスタ一覧（全認証者。マスタは公開情報） */
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

  const repository = new PositionRepository(c)

  const positions = await repository.findAll({ limit, offset })

  if (positions instanceof Error) {
    throw new InternalError("failed to load positions")
  }

  const total = await repository.count()

  if (total instanceof Error) {
    throw new InternalError("failed to count positions")
  }

  const responseBody = zAppPositionList.parse({
    data: positions.map((position) => ({
      id: position.id,
      code: position.code,
      name: position.name,
      rank: position.rank,
      description: position.description,
      created_at: position.createdAt,
    })),
    total,
  })

  return c.json(responseBody, 200)
})
