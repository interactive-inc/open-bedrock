import { DeleteEmployee } from "@/application/employee/delete-employee"
import { GetEmployee } from "@/application/employee/get-employee"
import { UpdateEmployee } from "@/application/employee/update-employee"
import type { Employee } from "@/domain/employee/employee.entity"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/interface/lib/errors"
import { validateCodeParam } from "@/interface/shared/validate-code-param"
import { zAppEmployee } from "@/lib/app-schemas"
import { employeeRoleSchema } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// 従業員をレスポンス用の snake_case に整形する。
function toResponseBody(employee: Employee) {
  return zAppEmployee.parse({
    code: employee.code,
    name: employee.name,
    dept_name: employee.deptName,
    position: employee.position,
    email: employee.email,
    status: employee.status,
    role: employee.role,
  })
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

  if (employee instanceof ApplicationError) {
    throw toHttpException(employee)
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
      session: session,
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

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
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
    session: session,
    viewerEmployeeId: session.employeeId,
    code: validateCodeParam(c.req.param("code"), "employee"),
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
