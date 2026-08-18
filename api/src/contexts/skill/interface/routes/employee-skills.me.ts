import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT, MAX_LIST_OFFSET, toBoundedInt } from "@/contexts/company-compatibility/interface/utils/to-bounded-int"
import { SetMySkill } from "@/contexts/skill/application/set-my-skill"
import { employeeSkills, skills } from "@/contexts/skill/infrastructure/schema/skill"
import { zAppEmployeeSkill, zAppEmployeeSkillList } from "@/lib/app-schemas"
import { ApplicationError } from "@/lib/errors"
import { codeSchema } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { count, eq } from "drizzle-orm"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
/** GET /employee-skills/me — 本人の登録スキル一覧（スキルマスタ結合済み） */
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

  const rows = await c.var.database
    .select({ employeeSkill: employeeSkills, skill: skills })
    .from(employeeSkills)
    .leftJoin(skills, eq(skills.code, employeeSkills.skillCode))
    .where(eq(employeeSkills.employeeId, session.employeeId))
    .limit(limit)
    .offset(offset)

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(employeeSkills)
    .where(eq(employeeSkills.employeeId, session.employeeId))

  const responseBody = zAppEmployeeSkillList.parse({
    data: rows.map((row) => ({
      skill_code: row.employeeSkill.skillCode,
      skill_name: row.skill?.name ?? "",
      skill_category: row.skill?.category ?? "",
      level: row.employeeSkill.level,
      years: row.employeeSkill.years,
      note: row.employeeSkill.note,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})

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
