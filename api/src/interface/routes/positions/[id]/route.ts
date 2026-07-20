import { DeletePosition } from "@/application/position/delete-position"
import { UpdatePosition } from "@/application/position/update-position"
import type { Position } from "@/domain/position/position.entity"
import { factory } from "@/lib/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppPosition } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** 役職をレスポンス用スキーマで検証する。 */
function toResponseBody(position: Position) {
  return zAppPosition.parse({
    id: position.id,
    code: position.code,
    name: position.name,
    rank: position.rank,
    description: position.description,
    created_at: position.createdAt,
  })
}

/** パスパラメータの id を正の整数に変換する。不正値は 404。 */
function toPositionId(value: string | undefined): number {
  return validateIntParam(value, "position")
}

/** PUT /positions/:id — 役職マスタの定義を変更（position:manage） */
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

    const position = await new UpdatePosition(c).run({
      session,
      positionId: toPositionId(c.req.param("id") ?? ""),
      code: json.code,
      name: json.name,
      rank: json.rank,
      description: json.description ?? null,
    })

    if (position instanceof ApplicationError) {
      throw toHttpException(position)
    }

    return c.json(toResponseBody(position), 200)
  },
)

/** DELETE /positions/:id — 役職マスタを削除（position:manage） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new DeletePosition(c).run({
    session,
    positionId: toPositionId(c.req.param("id") ?? ""),
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
