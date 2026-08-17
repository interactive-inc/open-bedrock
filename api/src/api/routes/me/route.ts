import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { toPrimaryRole } from "@/contexts/company-compatibility/interface/utils/to-primary-role"
import { zAppAuthMe } from "@/lib/app-schemas"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { IdentityRepository } from "@/contexts/company-compatibility/infrastructure/auth/identity-repository"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { employees } from "@/contexts/company-compatibility/infrastructure/schema/employee"
import { eq } from "drizzle-orm"
import {
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/contexts/company-compatibility/interface/lib/errors"
import { ReadOrganizationWorkforceState } from "@/contexts/company/application/workforce/read-organization-workforce-state"
import { toWorkforceEmployeeId } from "@/contexts/company-compatibility/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import { OrganizationUnitReadRepository } from "@/contexts/company-compatibility/infrastructure/workforce/organization-unit-read.repository"
import { OrganizationWorkforceSnapshotRepository } from "@/contexts/company-compatibility/infrastructure/workforce/organization-workforce-snapshot.repository"
import { requireCanonicalCompany } from "@/contexts/company-compatibility/interface/utils/require-canonical-company"
import { UnavailableError } from "@/lib/errors"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"

// @authorization owner - 本人のリソースに限定する
/** GET /me — 認証済みの本人の社員情報 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }
  const rows = await c.var.database
    .select()
    .from(employees)
    .where(eq(employees.id, session.employeeId))
    .limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("employee not found")
  }

  // email は認証情報(identities)が正。本人の id から解決する。
  const emailByEmployeeId = await new IdentityRepository(c).findEmailsByEmployeeIds([row.id])

  if (emailByEmployeeId instanceof Error) {
    throw new InternalError("internal server error")
  }

  const businessDate = resolveCompanyBusinessDate({
    now: c.env.NOW ?? new Date().toISOString(),
    timeZone: c.env.COMPANY_TIME_ZONE,
  })
  if (typeof businessDate !== "string") {
    throw toHttpException(
      new UnavailableError(
        "failed to resolve company business date",
        "company_timezone_unavailable",
        {
          cause: businessDate,
        },
      ),
    )
  }
  const asOf = restoreCalendarDate(businessDate)
  await requireCanonicalCompany(c, asOf)
  const snapshot = await new ReadOrganizationWorkforceState({
    organization: new OrganizationUnitReadRepository(c.var.database),
    workforce: new OrganizationWorkforceSnapshotRepository(c),
  }).execute(asOf)
  if (snapshot.kind !== "found") {
    throw toHttpException(
      new UnavailableError(
        "Company workforce is unavailable",
        snapshot.kind === "invalid" ? "company_workforce_invalid" : "company_workforce_unavailable",
        snapshot.kind === "unavailable" ? { cause: snapshot.cause } : undefined,
      ),
    )
  }
  const state = snapshot.employees.find(
    (employee) => employee.employeeId === toWorkforceEmployeeId(row.id),
  )
  if (state === undefined || (state.status !== "ACTIVE" && state.status !== "ON_LEAVE")) {
    throw new NotFoundError("employee not found")
  }
  const primary = state.primaryAssignment
  const departmentName =
    primary === null
      ? null
      : (snapshot.organization.units.find(
          (unit) => unit.organizationUnitId === primary.organizationUnitId,
        )?.officialName ?? null)

  const responseBody = zAppAuthMe.parse({
    id: row.id,
    code: row.code,
    name: row.name,
    email: emailByEmployeeId.get(row.id) ?? "",
    // レスポンス互換: 単一 role は roleKeys の代表値から導出する。
    role: toPrimaryRole(session.roleKeys),
    dept_name: departmentName,
    position: primary?.positionTitle ?? null,
    permissions: [...session.permissions],
    role_keys: [...session.roleKeys],
    phone: row.phone,
  })

  return c.json(responseBody, 200)
})
