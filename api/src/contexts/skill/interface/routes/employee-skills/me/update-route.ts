import { SetMySkill } from "@/contexts/skill/application/set-my-skill"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { zAppEmployeeSkill } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"

// @authorization owner - 本人のリソースに限定する
/** PUT /employee-skills/me — 本人のスキルを登録・更新（スキルマスタ結合済みを返す） */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      skill_code: codeSchema,
      level: z.number().int().min(1).max(10),
      years: z.number().int().nonnegative().nullable().optional(),
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const result = await new SetMySkill(c).run({
      employeeId: session.employeeId,
      skillCode: json.skill_code,
      level: json.level,
      years: json.years ?? null,
      note: json.note ?? null,
    })

    if (result instanceof ApplicationError) {
      throw toHttpException(result)
    }

    const responseBody = zAppEmployeeSkill.parse({
      skill_code: result.employeeSkill.skillCode,
      skill_name: result.skill.name,
      skill_category: result.skill.category,
      level: result.employeeSkill.level,
      years: result.employeeSkill.years,
      note: result.employeeSkill.note,
    })

    return c.json(responseBody, 200)
  },
)
