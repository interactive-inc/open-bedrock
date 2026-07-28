import { GetMySkill } from "@/application/skill/get-my-skill"
import { RemoveMySkill } from "@/application/skill/remove-my-skill"
import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppEmployeeSkill } from "@/lib/app-schemas"
import { validateCodeParam } from "@/interface/utils/validate-code-param"

// @authorization owner - 本人のリソースに限定する
/** GET /employee-skills/me/:skill_code — 本人の登録スキルを1件取得（スキルマスタ結合済み） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new GetMySkill(c).run({
    employeeId: session.employeeId,
    skillCode: validateCodeParam(c.req.param("skill_code"), "skill"),
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  const responseBody = zAppEmployeeSkill.parse({
    skill_code: result.employeeSkill.skillCode,
    skill_name: result.skill?.name ?? "",
    skill_category: result.skill?.category ?? "",
    level: result.employeeSkill.level,
    years: result.employeeSkill.years,
    note: result.employeeSkill.note,
  })

  return c.json(responseBody, 200)
})

// @authorization owner - 本人のリソースに限定する
/** DELETE /employee-skills/me/:skill_code — 本人の登録スキルを削除 */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new RemoveMySkill(c).run({
    employeeId: session.employeeId,
    skillCode: validateCodeParam(c.req.param("skill_code"), "skill"),
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
