import { GetMySkill } from "@/application/skill/get-my-skill"
import { RemoveMySkill } from "@/application/skill/remove-my-skill"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, NotFoundError, UnauthorizedError } from "@/interface/lib/errors"
import { validateCodeParam } from "@/interface/shared/validate-code-param"

// GET /skills/me/:skill_code — 本人の登録スキルを1件取得（スキルマスタ結合済み）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new GetMySkill(c).run({
    employeeId: session.employeeId,
    skillCode: validateCodeParam(c.req.param("skill_code"), "skill"),
  })

  if (result instanceof Error) {
    throw new InternalError("failed to load skill")
  }

  if ("reason" in result) {
    throw new NotFoundError("skill not registered")
  }

  const responseBody = {
    skill_code: result.employeeSkill.skillCode,
    skill_name: result.skill?.name ?? "",
    skill_category: result.skill?.category ?? "",
    level: result.employeeSkill.level,
    years: result.employeeSkill.years,
    note: result.employeeSkill.note,
  }

  return c.json(responseBody, 200)
})

// DELETE /skills/me/:skill_code — 本人の登録スキルを削除
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new RemoveMySkill(c).run({
    employeeId: session.employeeId,
    skillCode: validateCodeParam(c.req.param("skill_code"), "skill"),
  })

  if (result instanceof Error) {
    throw new InternalError("failed to remove skill")
  }

  if (result.reason === "skill_not_registered") {
    throw new NotFoundError("skill not registered")
  }

  return c.body(null, 204)
})
