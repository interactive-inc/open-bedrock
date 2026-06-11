import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { employeeSkills, skills } from "@/schema"
import { count, eq } from "drizzle-orm"

// GET /skills/me — 本人の登録スキル一覧（スキルマスタ結合済み）
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

  const responseBody = rows.map((row) => ({
    skill_code: row.employeeSkill.skillCode,
    skill_name: row.skill?.name ?? "",
    skill_category: row.skill?.category ?? "",
    level: row.employeeSkill.level,
    years: row.employeeSkill.years,
    note: row.employeeSkill.note,
  }))

  return c.json({ data: responseBody, total: totalRows.at(0)?.total ?? 0 }, 200)
})
