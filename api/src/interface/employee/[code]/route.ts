import { DeleteEmployee } from "@/application/employee/delete-employee"
import { GetEmployee } from "@/application/employee/get-employee"
import { UpdateEmployee } from "@/application/employee/update-employee"
import type { Employee } from "@/domain/employee/employee.entity"
import type { Context } from "@/env"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { IdentityRepository } from "@/infrastructure/auth/identity-repository"
import { AccountRepository } from "@/infrastructure/iam/account-repository"
import { toPrimaryRole } from "@/lib/auth/to-primary-role"
import { ApplicationError, UnexpectedError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/interface/lib/errors"
import { validateCodeParam } from "@/interface/shared/validate-code-param"
import { zAppEmployee } from "@/lib/app-schemas"
import { employeeRoleSchema } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// 従業員をレスポンス用の snake_case に整形する。email/role は IAM(identities/account_roles)から解決する。
async function toResponseBody(c: Context, employee: Employee) {
  const emailByEmployeeId = await new IdentityRepository(c).findEmailsByEmployeeIds([employee.id])

  if (emailByEmployeeId instanceof Error) {
    return new UnexpectedError("failed to resolve email", { cause: emailByEmployeeId })
  }

  const roleKeys = await new AccountRepository(c).findRoleKeysByEmployeeId(employee.id)

  if (roleKeys instanceof Error) {
    return new UnexpectedError("failed to resolve role", { cause: roleKeys })
  }

  return zAppEmployee.parse({
    code: employee.code,
    name: employee.name,
    dept_name: employee.deptName,
    position: employee.position,
    email: emailByEmployeeId.get(employee.id) ?? "",
    status: employee.status,
    role: toPrimaryRole(roleKeys),
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

  const body = await toResponseBody(c, employee)

  if (body instanceof ApplicationError) {
    throw toHttpException(body)
  }

  return c.json(body, 200)
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

    // email/role の認証・認可情報は IAM が正。台帳更新は name/dept/position/status のみ。
    const updated = await new UpdateEmployee(c).run({
      session: session,
      viewerEmployeeId: session.employeeId,
      code: validateCodeParam(c.req.param("code"), "employee"),
      profile: {
        name: json.name,
        deptId: json.dept_id ?? null,
        deptName: json.dept_name ?? null,
        position: json.position ?? null,
        status: json.status,
      },
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const body = await toResponseBody(c, updated)

    if (body instanceof ApplicationError) {
      throw toHttpException(body)
    }

    return c.json(body, 200)
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
