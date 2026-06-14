import { CreateOrgDepartment } from "@/application/org/create-org-department"
import { ListOrgDepartments } from "@/application/org/list-org-departments"
import type { OrgDepartment } from "@/domain/org/org-department.entity"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { MAX_ORG_NODES } from "@/interface/shared/to-bounded-int"
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"

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

// GET /org/departments — 部署ノード一覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const departments = await new ListOrgDepartments(c).run()

  if (departments instanceof Error) {
    throw new InternalError("failed to load departments")
  }

  if (departments.length > MAX_ORG_NODES) {
    console.warn(`[org] department list exceeded ${MAX_ORG_NODES} nodes; response truncated`)
  }

  const bounded = departments.slice(0, MAX_ORG_NODES)

  return c.json(bounded.map(toResponseBody), 200)
})

// POST /org/departments — 部署ノードを作成（権限が必要）
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      code: codeSchema,
      department_id: z.number().int(),
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

    const created = await new CreateOrgDepartment(c).run({
      viewerRole: session.role,
      department: {
        code: json.code,
        departmentId: json.department_id,
        parentCode: json.parent_code ?? null,
        managerEmployeeCode: json.manager_employee_code ?? null,
        order: json.order,
      },
    })

    if (created instanceof Error) {
      throw new InternalError("failed to create department")
    }

    if ("reason" in created) {
      if (created.reason === "forbidden") {
        throw new ForbiddenError()
      }

      if (created.reason === "parent_not_found") {
        throw new NotFoundError("parent department not found")
      }

      throw new ConflictError("department code already exists")
    }

    return c.json(toResponseBody(created), 201)
  },
)
