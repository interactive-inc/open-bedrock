import { factory } from "@/interface/utils/factory"
import { zAppDepartmentDefinitionList } from "@/lib/app-schemas"
import { DepartmentRepository } from "@/contexts/company/infrastructure/organization/department-repository"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/** GET /department-definitions — 部署マスタ一覧（全認証者。マスタは公開情報） */
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

  const repository = new DepartmentRepository(c)

  const departmentDefinitions = await repository.findAll({ limit, offset })

  if (departmentDefinitions instanceof Error) {
    throw new InternalError("failed to load departments")
  }

  const total = await repository.count()

  if (total instanceof Error) {
    throw new InternalError("failed to count departments")
  }

  const responseBody = zAppDepartmentDefinitionList.parse({
    data: departmentDefinitions.map((department) => ({
      id: department.id,
      name: department.name,
    })),
    total,
  })

  return c.json(responseBody, 200)
})
