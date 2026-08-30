import { NotFoundError, UnexpectedError } from "@/lib/errors"
import { EmployeeSkillRepository } from "@/contexts/skill/infrastructure/repositories/employee-skill.repository"
import { SkillRepository } from "@/contexts/skill/infrastructure/repositories/skill.repository"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppEmployeeSkill } from "@/contexts/skill/interface/http/response-schemas"
import { validateCodeParam } from "@/lib/http/validate-code-param"

// @authorization owner - 本人のリソースに限定する
/** GET /employee-skills/me/:skillCode — 本人の登録スキルを1件取得（スキルマスタ結合済み） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await (async () => {
    const command = {
      employeeId: session.employeeId,
      skillCode: validateCodeParam(c.req.param("skillCode"), "skill"),
    }

    const employeeSkillRepository = new EmployeeSkillRepository(c)

    const employeeSkill = await employeeSkillRepository.findByEmployeeAndCode({
      employeeId: command.employeeId,
      skillCode: command.skillCode,
    })

    if (employeeSkill instanceof Error) {
      return new UnexpectedError("failed to find skill", { cause: employeeSkill })
    }

    if (employeeSkill === null) {
      return new NotFoundError("skill not registered", "skill_not_registered")
    }

    const skill = await new SkillRepository(c).findByCode(command.skillCode)

    if (skill instanceof Error) {
      return new UnexpectedError("failed to find skill", { cause: skill })
    }

    return { employeeSkill, skill }
  })()

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

  const result = await (async () => {
    const command = {
      employeeId: session.employeeId,
      skillCode: validateCodeParam(c.req.param("skillCode"), "skill"),
    }

    const employeeSkillRepository = new EmployeeSkillRepository(c)

    const current = await employeeSkillRepository.findByEmployeeAndCode({
      employeeId: command.employeeId,
      skillCode: command.skillCode,
    })

    if (current instanceof Error) {
      return new UnexpectedError("failed to find skill", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("skill not registered", "skill_not_registered")
    }

    const deleted = await employeeSkillRepository.delete({
      employeeId: command.employeeId,
      skillCode: command.skillCode,
    })

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete skill", { cause: deleted })
    }

    if (deleted === null) {
      return new NotFoundError("skill not registered", "skill_not_registered")
    }

    return { reason: "removed" }
  })()

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
