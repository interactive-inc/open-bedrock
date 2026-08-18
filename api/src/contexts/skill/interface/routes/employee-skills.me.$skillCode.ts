import { GetMySkill } from "@/contexts/skill/application/get-my-skill"
import { RemoveMySkill } from "@/contexts/skill/application/remove-my-skill"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { zAppEmployeeSkill } from "@/lib/app-schemas"
import { validateCodeParam } from "@/contexts/company-compatibility/interface/utils/validate-code-param"

// @authorization owner - 本人のリソースに限定する
/** GET /employee-skills/me/:skillCode — 本人の登録スキルを1件取得（スキルマスタ結合済み） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new GetMySkill(c).run({
    employeeId: session.employeeId,
    skillCode: validateCodeParam(c.req.param("skillCode"), "skill"),
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
/** DELETE /employee-skills/me/:skillCode — 本人の登録スキルを削除 */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new RemoveMySkill(c).run({
    employeeId: session.employeeId,
    skillCode: validateCodeParam(c.req.param("skillCode"), "skill"),
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
