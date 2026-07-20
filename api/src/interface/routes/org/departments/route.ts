import { CreateOrgDepartment } from "@/application/org/create-org-department"
import { OrgDepartment } from "@/domain/org/org-department.entity"
import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { MAX_ORG_NODES } from "@/interface/utils/to-bounded-int"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/interface/lib/errors"
import { zAppOrgDepartment, zAppOrgDepartmentList } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"
import { loadCurrentOrganization } from "@/lib/org/current-organization-read-model"
import { InternalError } from "@/interface/lib/errors"

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

/** GET /org/departments — 部署ノード一覧 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const organization = await loadCurrentOrganization(c)
  if (organization instanceof Error) throw new InternalError("failed to load organization")
  const currentDepartments = organization.departments.map(
    (department) =>
      new OrgDepartment({
        code: department.code,
        departmentId: department.departmentId,
        parentCode: department.parentCode,
        managerEmployeeCode: organization.managerByDepartmentCode.get(department.code) ?? null,
        order: department.order,
      }),
  )

  if (currentDepartments.length > MAX_ORG_NODES) {
    console.warn(`[org] department list exceeded ${MAX_ORG_NODES} nodes; response truncated`)
  }

  const bounded = currentDepartments.slice(0, MAX_ORG_NODES)

  const responseBody = zAppOrgDepartmentList.parse(bounded.map(toResponseBody))

  return c.json(responseBody, 200)
})

/** POST /org/departments — 部署ノードを作成（権限が必要） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.strictObject({
      code: codeSchema,
      department_id: z.number().int(),
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

    const created = await new CreateOrgDepartment(c).run({
      session: session,
      department: {
        code: json.code,
        departmentId: json.department_id,
        parentCode: json.parent_code ?? null,
        managerEmployeeCode: null,
        order: json.order,
      },
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppOrgDepartment.parse(toResponseBody(created))

    return c.json(responseBody, 201)
  },
)
