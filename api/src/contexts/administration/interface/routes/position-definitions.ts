import { CreatePosition } from "@/contexts/administration/application/position/create-position"
import { PositionRepository } from "@/contexts/administration/infrastructure/repositories/position/position.repository"
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
import { zAppPosition, zAppPositionList } from "@/lib/app-schemas"
import { ApplicationError } from "@/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/** POST /position-definitions — 役職マスタを新規登録する（position:manage） */
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

    const position = await new CreatePosition(c).run({
      session,
      code: json.code,
      name: json.name,
      rank: json.rank,
      description: json.description ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (position instanceof ApplicationError) {
      throw toHttpException(position)
    }

    const responseBody = zAppPosition.parse({
      id: position.id,
      code: position.code,
      name: position.name,
      rank: position.rank,
      description: position.description,
      created_at: position.createdAt,
    })

    return c.json(responseBody, 201)
  },
)

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/** GET /position-definitions — 役職マスタ一覧（全認証者。マスタは公開情報） */
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
