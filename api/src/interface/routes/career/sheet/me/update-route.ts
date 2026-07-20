import { UpdateMyCareerSheet } from "@/application/career/update-my-career-sheet"
import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppCareerSheet } from "@/lib/app-schemas"
import { z } from "zod"

/** PUT /career/sheet/me — 本人のキャリアシートを登録・更新 */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      goals_text: z.string().max(5_000).nullable().optional(),
      strengths_text: z.string().max(5_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const updated = await new UpdateMyCareerSheet(c).run({
      employeeId: session.employeeId,
      goalsText: json.goals_text ?? null,
      strengthsText: json.strengths_text ?? null,
      now: c.env.NOW ?? new Date().toISOString(),
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppCareerSheet.parse({
      employee_id: updated.employeeId,
      goals_text: updated.goalsText,
      strengths_text: updated.strengthsText,
      updated_at: updated.updatedAt,
    })

    return c.json(responseBody, 200)
  },
)
