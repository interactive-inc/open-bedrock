import { DeleteOrgDepartment } from "@/application/org/delete-org-department"
import { UpdateOrgDepartment } from "@/application/org/update-org-department"
import { OrgDepartment } from "@/domain/org/org-department.entity"
import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/interface/lib/errors"
import { validateCodeParam } from "@/interface/utils/validate-code-param"
import { zAppOrgDepartment } from "@/lib/app-schemas"
import { codeSchema } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { loadCurrentOrganization } from "@/lib/org/current-organization-read-model"
import { InternalError, NotFoundError } from "@/interface/lib/errors"

/** 部署ノードをレスポンス用の snake_case に整形する。 */
function toResponseBody(department: OrgDepartment) {
  return {
    code: department.code,
    department_id: department.departmentId,
    parent_code: department.parentCode,
    manager_employee_code: department.managerEmployeeCode,
    order: department.order,
  }
}

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/** GET /departments/:code — 部署ノードの詳細 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const code = validateCodeParam(c.req.param("code"), "department")
  const organization = await loadCurrentOrganization(c)
  if (organization instanceof Error) throw new InternalError("failed to load organization")
  const current = organization.departments.find((department) => department.code === code)
  if (current === undefined) throw new NotFoundError("department not found")
  const department = new OrgDepartment({
    code: current.code,
    departmentId: current.departmentId,
    parentCode: current.parentCode,
    managerEmployeeCode: organization.managerByDepartmentCode.get(current.code) ?? null,
    order: current.order,
  })

  const responseBody = zAppOrgDepartment.parse(toResponseBody(department))

  return c.json(responseBody, 200)
})

// @authorization service - session を application service に渡して判定する
/** PUT /departments/:code — 親・責任者・表示順を変更（権限が必要） */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.strictObject({
      parent_code: codeSchema.nullable().optional(),
      order: z.number().int(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const updated = await new UpdateOrgDepartment(c).run({
      session: session,
      code: validateCodeParam(c.req.param("code"), "department"),
      parentCode: json.parent_code ?? null,
      managerEmployeeCode: undefined,
      order: json.order,
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppOrgDepartment.parse(toResponseBody(updated))

    return c.json(responseBody, 200)
  },
)

// @authorization service - session を application service に渡して判定する
/** DELETE /departments/:code — 部署ノードを削除（権限が必要） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new DeleteOrgDepartment(c).run({
    session: session,
    code: validateCodeParam(c.req.param("code"), "department"),
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
