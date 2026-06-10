import { DeleteEmployee } from "@/application/employee/delete-employee"
import { GetEmployee } from "@/application/employee/get-employee"
import { UpdateEmployee } from "@/application/employee/update-employee"
import type { Employee } from "@/domain/employee/employee"
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
import { employeeRoleSchema } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// 従業員をレスポンス用の snake_case に整形する。
function toResponseBody(employee: Employee) {
  return {
    code: employee.code,
    name: employee.name,
    dept_name: employee.deptName,
    position: employee.position,
    email: employee.email,
    status: employee.status,
    role: employee.role,
  }
}

// GET /employees/:code — 従業員 1 件の詳細
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const employee = await new GetEmployee(c).run({
    code: validateCodeParam(c.req.param("code"), "employee"),
  })

  if (employee instanceof Error) {
    throw new InternalError("failed to load employee")
  }

  if ("reason" in employee) {
    throw new NotFoundError("employee not found")
  }

  return c.json(toResponseBody(employee), 200)
})

// PUT /employees/:code — 従業員の氏名・メール・ロール・部署・役職・在籍状況を変更（権限が必要）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(200),
      email: z.string().email().max(254),
      role: employeeRoleSchema,
      dept_id: z.number().int().nullable().optional(),
      dept_name: z.string().max(200).nullable().optional(),
      position: z.string().max(200).nullable().optional(),
      status: z.enum(["active", "leave", "retired"]),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const updated = await new UpdateEmployee(c).run({
      viewerRole: session.role,
      viewerEmployeeId: session.employeeId,
      code: validateCodeParam(c.req.param("code"), "employee"),
      profile: {
        name: json.name,
        email: json.email,
        role: json.role,
        deptId: json.dept_id ?? null,
        deptName: json.dept_name ?? null,
        position: json.position ?? null,
        status: json.status,
      },
    })

    if (updated instanceof Error) {
      throw new InternalError("failed to update employee")
    }

    if ("reason" in updated) {
      if (updated.reason === "employee_not_found") {
        throw new NotFoundError("employee not found")
      }

      if (updated.reason === "role_escalation_forbidden") {
        throw new ForbiddenError("only admin can assign non-member roles")
      }

      if (updated.reason === "cannot_demote_self") {
        throw new ForbiddenError("cannot remove admin role from yourself")
      }

      if (updated.reason === "last_admin") {
        throw new ForbiddenError("cannot remove the last admin")
      }

      throw new ForbiddenError()
    }

    return c.json(toResponseBody(updated), 200)
  },
)

// DELETE /employees/:code — 従業員を台帳から削除（権限が必要、自分自身は不可）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new DeleteEmployee(c).run({
    viewerRole: session.role,
    viewerEmployeeId: session.employeeId,
    code: validateCodeParam(c.req.param("code"), "employee"),
  })

  if (result instanceof Error) {
    throw new InternalError("failed to delete employee")
  }

  if (result.reason === "employee_not_found") {
    throw new NotFoundError("employee not found")
  }

  if (result.reason === "forbidden") {
    throw new ForbiddenError()
  }

  if (result.reason === "self_delete") {
    throw new ConflictError("cannot delete your own account")
  }

  return c.body(null, 204)
})
