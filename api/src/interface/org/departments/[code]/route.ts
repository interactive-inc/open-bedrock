import { DeleteOrgDepartment } from "@/application/org/delete-org-department"
import { GetOrgDepartment } from "@/application/org/get-org-department"
import { UpdateOrgDepartment } from "@/application/org/update-org-department"
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
import { validateCodeParam } from "@/interface/shared/validate-code-param"
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

  if (department instanceof Error) {
    throw new InternalError("failed to load department")
  }

  if ("reason" in department) {
    throw new NotFoundError("department not found")
  }

  return c.json(toResponseBody(department), 200)
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

    if (updated instanceof Error) {
      throw new InternalError("failed to update department")
    }

    if ("reason" in updated) {
      if (updated.reason === "forbidden") {
        throw new ForbiddenError()
      }

      if (updated.reason === "department_not_found") {
        throw new NotFoundError("department not found")
      }

      if (updated.reason === "parent_not_found") {
        throw new NotFoundError("parent department not found")
      }

      if (updated.reason === "circular_reference") {
        throw new ConflictError("circular reference detected in department hierarchy")
      }

      throw new ConflictError("a department cannot be its own parent")
    }

    return c.json(toResponseBody(updated), 200)
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

  if (result instanceof Error) {
    throw new InternalError("failed to delete department")
  }

  if (result.reason === "forbidden") {
    throw new ForbiddenError()
  }

  if (result.reason === "department_not_found") {
    throw new NotFoundError("department not found")
  }

  if (result.reason === "department_in_use") {
    throw new ConflictError("department has children or members")
  }

  return c.body(null, 204)
})
