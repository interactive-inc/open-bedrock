import { DeleteEmployee } from "@/contexts/company-compatibility/application/employee/delete-employee"
import { GetEmployee } from "@/contexts/company-compatibility/application/employee/get-employee"
import { UpdateEmployee } from "@/contexts/company-compatibility/application/employee/update-employee"
import type { Employee } from "@/contexts/company-compatibility/domain/employee/employee.entity"
import type { Context } from "@/env"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { IdentityRepository } from "@/contexts/company-compatibility/infrastructure/auth/identity-repository"
import { AccountRepository } from "@/contexts/company-compatibility/infrastructure/iam/account-repository"
import { toPrimaryRole } from "@/contexts/company-compatibility/interface/utils/to-primary-role"
import { ApplicationError, UnavailableError, UnexpectedError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import {
  NotFoundError,
  UnauthorizedError,
} from "@/contexts/company-compatibility/interface/lib/errors"
import { validateCodeParam } from "@/contexts/company-compatibility/interface/utils/validate-code-param"
import { zAppEmployee } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { isoDate } from "@/lib/schemas"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"
import { ReadOrganizationWorkforceState } from "@/contexts/company/application/workforce/read-organization-workforce-state"
import { toWorkforceEmployeeId } from "@/contexts/company-compatibility/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import { OrganizationUnitReadRepository } from "@/contexts/company-compatibility/infrastructure/workforce/organization-unit-read.repository"
import { OrganizationWorkforceSnapshotRepository } from "@/contexts/company-compatibility/infrastructure/workforce/organization-workforce-snapshot.repository"
import { CanonicalCompanyAccess } from "@/contexts/company-compatibility/interface/utils/canonical-company-access"
import { requireCanonicalCompany } from "@/contexts/company-compatibility/interface/utils/require-canonical-company"

/** 従業員をレスポンス用の snake_case に整形する。email/role は IAM(identities/account_roles)から解決する。 */
async function toResponseBody(
  c: Context,
  employee: Employee,
  state?: Readonly<{
    status: "active" | "leave" | "retired"
    departmentName: string | null
    position: string | null
  }>,
) {
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
    dept_name: state?.departmentName ?? employee.deptName,
    position: state?.position ?? employee.position,
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

    if (employee.id !== session.employeeId && !session.hasPermission("employee:read")) {
      throw new NotFoundError("employee not found")
    }
    const resolvedDate =
      c.req.valid("query").as_of ??
      resolveCompanyBusinessDate({
        now: c.env.NOW ?? new Date().toISOString(),
        timeZone: c.env.COMPANY_TIME_ZONE,
      })
    if (typeof resolvedDate !== "string") {
      throw toHttpException(
        new UnavailableError(
          "failed to resolve company business date",
          "company_timezone_unavailable",
          {
            cause: resolvedDate,
          },
        ),
      )
    }
    const asOf = restoreCalendarDate(resolvedDate)
    await requireCanonicalCompany(c, asOf)
    const employeeId = toWorkforceEmployeeId(employee.id)
    const authorization = await new CanonicalCompanyAccess({ c, session }).authorizeWorkforceRead(
      employeeId,
      asOf,
    )
    if (authorization.kind === "denied") throw new NotFoundError("employee not found")
    if (authorization.kind === "invalid" || authorization.kind === "unavailable") {
      throw toHttpException(
        new UnavailableError(
          "Company authority is unavailable",
          authorization.kind === "invalid"
            ? "company_authority_invalid"
            : "company_authority_unavailable",
          authorization.kind === "unavailable" ? { cause: authorization.cause } : undefined,
        ),
      )
    }
    const snapshot = await new ReadOrganizationWorkforceState({
      organization: new OrganizationUnitReadRepository(c.var.database),
      workforce: new OrganizationWorkforceSnapshotRepository(c),
    }).execute(asOf)
    if (snapshot.kind !== "found") {
      throw toHttpException(
        new UnavailableError(
          "Company workforce is unavailable",
          snapshot.kind === "invalid"
            ? "company_workforce_invalid"
            : "company_workforce_unavailable",
          snapshot.kind === "unavailable" ? { cause: snapshot.cause } : undefined,
        ),
      )
    }
    if (
      authorization.organizationRevision !== null &&
      authorization.organizationRevision !== snapshot.organization.revision
    ) {
      throw toHttpException(
        new UnavailableError("Company organization changed", "company_workforce_snapshot_changed"),
      )
    }
    const state = snapshot.employees.find((candidate) => candidate.employeeId === employeeId)
    if (state === undefined || state.status === "PRE_HIRE") {
      throw new NotFoundError("employee not found")
    }
    const departmentName =
      state.primaryAssignment === null
        ? null
        : (snapshot.organization.units.find(
            (unit) => unit.organizationUnitId === state.primaryAssignment?.organizationUnitId,
          )?.officialName ?? null)
    const body = await toResponseBody(c, employee, {
      status:
        state.status === "ACTIVE" ? "active" : state.status === "ON_LEAVE" ? "leave" : "retired",
      departmentName,
      position: state.primaryAssignment?.positionTitle ?? null,
    })

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
