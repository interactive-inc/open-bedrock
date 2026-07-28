import { CreatePosition } from "@/application/position/create-position"
import { factory } from "@/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppPosition } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { UnauthorizedError } from "@/interface/lib/errors"
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
