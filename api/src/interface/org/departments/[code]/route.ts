import { DeleteOrgDepartment } from "@/application/org/delete-org-department"
import { GetOrgDepartment } from "@/application/org/get-org-department"
import { UpdateOrgDepartment } from "@/application/org/update-org-department"
import type { OrgDepartment } from "@/domain/org/org-department.entity"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/interface/lib/errors"
import { validateCodeParam } from "@/interface/shared/validate-code-param"
import { zAppOrgDepartment } from "@/lib/app-schemas"
import { codeSchema } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// 部署ノードをレスポンス用の snake_case に整形する。
function toResponseBody(department: OrgDepartment) {
  return {
    code: department.code,
    department_id: department.departmentId,
    parent_code: department.parentCode,
    manager_employee_code: department.managerEmployeeCode,
    order: department.order,
  }
}

// GET /org/departments/:code — 部署ノードの詳細
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const department = await new GetOrgDepartment(c).run({
    code: validateCodeParam(c.req.param("code"), "department"),
  })

  if (department instanceof ApplicationError) {
    throw toHttpException(department)
  }

  const responseBody = zAppOrgDepartment.parse(toResponseBody(department))

  return c.json(responseBody, 200)
})

// PUT /org/departments/:code — 親・責任者・表示順を変更（権限が必要）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      parent_code: codeSchema.nullable().optional(),
      manager_employee_code: codeSchema.nullable().optional(),
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
      viewerRole: session.role,
      code: validateCodeParam(c.req.param("code"), "department"),
      parentCode: json.parent_code ?? null,
      managerEmployeeCode: json.manager_employee_code ?? null,
      order: json.order,
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppOrgDepartment.parse(toResponseBody(updated))

    return c.json(responseBody, 200)
  },
)

// DELETE /org/departments/:code — 部署ノードを削除（権限が必要）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new DeleteOrgDepartment(c).run({
    viewerRole: session.role,
    code: validateCodeParam(c.req.param("code"), "department"),
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
