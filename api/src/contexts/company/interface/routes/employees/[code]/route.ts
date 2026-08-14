import { DeleteEmployee } from "@/contexts/company/application/employee/delete-employee"
import { GetEmployee } from "@/contexts/company/application/employee/get-employee"
import { UpdateEmployee } from "@/contexts/company/application/employee/update-employee"
import type { Employee } from "@/contexts/company/domain/employee/employee.entity"
import type { Context } from "@/env"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { IdentityRepository } from "@/contexts/company/infrastructure/auth/identity-repository"
import { AccountRepository } from "@/contexts/company/infrastructure/iam/account-repository"
import { toPrimaryRole } from "@/contexts/company/interface/utils/to-primary-role"
import { ApplicationError, UnexpectedError, UnprocessableError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import {
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"
import { validateCodeParam } from "@/contexts/company/interface/utils/validate-code-param"
import { zAppEmployee } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { resolveOrganizationAuthority } from "@/contexts/company/application/organization/resolve-organization-authority"
import { EmployeeLifecycleRepository } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import { GetLifecycleState } from "@/contexts/company/application/employee-lifecycle/get-lifecycle-state"
import type { EmployeeLifecycleState } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-read-repository"
import { isoDate } from "@/lib/schemas"

/** 従業員をレスポンス用の snake_case に整形する。email/role は IAM(identities/account_roles)から解決する。 */
async function toResponseBody(c: Context, employee: Employee, state?: EmployeeLifecycleState) {
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
    dept_name: state?.primaryAssignment?.departmentName ?? employee.deptName,
    position: state?.primaryAssignment?.positionTitle ?? employee.position,
    email: emailByEmployeeId.get(employee.id) ?? "",
    status: state?.status ?? employee.status,
    role: toPrimaryRole(roleKeys),
  })
}

// @authorization permission - 権限キーで判定する
/** GET /employees/:code — 従業員 1 件の詳細 */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator("query", z.object({ as_of: isoDate.optional() })),
  async (c) => {
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

    if (employee.id !== session.employeeId) {
      if (session.hasPermission("employee:read") === false) {
        throw new NotFoundError("employee not found")
      }

      if (session.hasPermission("org:manage") === false) {
        const authority = await resolveOrganizationAuthority(c, session.employeeId, employee.id)

        if (authority instanceof Error) {
          throw new InternalError("failed to resolve employee organization scope")
        }

        if (authority.managementChain === false && authority.departmentManager === false) {
          throw new NotFoundError("employee not found")
        }
      }
    }

    const migrationStatus = await new EmployeeLifecycleRepository(c).migrationStatus()
    if (migrationStatus instanceof ApplicationError) throw toHttpException(migrationStatus)

    // as_of は確定済みライフサイクル履歴を引く指定。移行未完了の legacy 経路では基準日を
    // 適用できないため、黙って無視せず 422 で拒否する（無視すると呼び出し側が現在時点の
    // 台帳を「基準日時点の姿」として誤読する）
    if (c.req.valid("query").as_of !== undefined && migrationStatus !== "verified") {
      throw toHttpException(
        new UnprocessableError(
          "as_of は人事ライフサイクル移行の完了後にのみ指定できます",
          "lifecycle_migration_incomplete",
        ),
      )
    }

    const state =
      migrationStatus === "verified"
        ? await new GetLifecycleState(c).run({
            employeeId: employee.id,
            asOf: c.req.valid("query").as_of,
          })
        : undefined
    if (state instanceof ApplicationError) throw toHttpException(state)
    if (state?.archived || state?.status === "prehire") {
      throw new NotFoundError("employee not found")
    }

    const body = await toResponseBody(c, employee, state)

    if (body instanceof ApplicationError) {
      throw toHttpException(body)
    }

    return c.json(body, 200)
  },
)

// @authorization service - session を application service に渡して判定する
/**
 * PUT /employees/:code — 人物台帳の氏名だけを変更（権限が必要）。
 * IAM はアカウント管理、所属・役職・在籍状態は人事発令で変更する。
 */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator("json", z.strictObject({ name: z.string().min(1).max(200) })),
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
      name: json.name,
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

// @authorization service - session を application service に渡して判定する
/** DELETE /employees/:code — 互換用。物理削除は禁止し、履歴保持アーカイブへ誘導する。 */
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
