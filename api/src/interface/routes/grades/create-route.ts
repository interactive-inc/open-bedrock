import { CreateGrade } from "@/application/grade/create-grade"
import { factory } from "@/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppGrade } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { UnauthorizedError } from "@/interface/lib/errors"
import { z } from "zod"

/** POST /grades — 等級マスタを新規登録する（grade:manage） */
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
