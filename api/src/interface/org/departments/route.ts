import { CreateOrgDepartment } from "@/application/org/create-org-department"
import { ListOrgDepartments } from "@/application/org/list-org-departments"
import type { OrgDepartment } from "@/domain/org/org-department"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
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

  return c.json(departments.map(toResponseBody), 200)
})

// POST /org/departments — 部署ノードを作成（権限が必要）
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      code: z.string().min(1),
      department_id: z.number(),
      parent_code: z.string().nullable().optional(),
      manager_employee_code: z.string().nullable().optional(),
      order: z.number(),
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
