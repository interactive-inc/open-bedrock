import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { employeeSkills, skills } from "@/schema"
import { eq } from "drizzle-orm"

// GET /skills/me — 本人の登録スキル一覧（スキルマスタ結合済み）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const rows = await c.var.database
    .select({ employeeSkill: employeeSkills, skill: skills })
    .from(employeeSkills)
    .leftJoin(skills, eq(skills.code, employeeSkills.skillCode))
    .where(eq(employeeSkills.employeeId, session.employeeId))

  const responseBody = rows.map((row) => ({
    skill_code: row.employeeSkill.skillCode,
    skill_name: row.skill?.name ?? "",
    skill_category: row.skill?.category ?? "",
    level: row.employeeSkill.level,
    years: row.employeeSkill.years,
    note: row.employeeSkill.note,
  }))

  return c.json(responseBody, 200)
})
