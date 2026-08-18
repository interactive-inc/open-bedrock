import { CreateDepartment } from "@/contexts/company-compatibility/application/organization/create-department"
import { DepartmentRepository } from "@/contexts/company-compatibility/infrastructure/organization/department-repository"
import { InternalError, UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT, MAX_LIST_OFFSET, toBoundedInt } from "@/contexts/company-compatibility/interface/utils/to-bounded-int"
import { zAppDepartmentDefinition, zAppDepartmentDefinitionList } from "@/lib/app-schemas"
import { ApplicationError } from "@/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/** POST /department-definitions — 部署マスタを新規登録する（org:manage） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.strictObject({
      name: z.string().trim().min(1).max(200),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const department = await new CreateDepartment(c).run({
      session,
      name: json.name,
    })

    if (department instanceof ApplicationError) {
      throw toHttpException(department)
    }

    const responseBody = zAppDepartmentDefinition.parse({
      id: department.id,
      name: department.name,
    })

    return c.json(responseBody, 201)
  },
)

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
