import { ReadWorkforceState } from "@/contexts/company/application/workforce/read-workforce-state"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import { restoreWorkforceId } from "@/contexts/company/domain/workforce/workforce-id"
import { EmployeeLifecycleWorkforceRepository } from "@/contexts/company/infrastructure/workforce/employee-lifecycle-workforce.repository"
import { OrganizationUnitReadRepository } from "@/contexts/company/infrastructure/workforce/organization-unit-read.repository"
import { NotFoundError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { CanonicalCompanyAccess } from "@/contexts/company/interface/utils/canonical-company-access"
import { factory } from "@/contexts/company/interface/utils/factory"
import { requireCanonicalCompany } from "@/contexts/company/interface/utils/require-canonical-company"
import { toCompanyWorkforceStateResponse } from "@/contexts/company/interface/utils/to-company-workforce-state-response"
import { zAppCompanyWorkforceState } from "@/lib/app-schemas"
import { ConflictError, UnavailableError } from "@/lib/errors"
import { isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const workforceIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/)

// @authorization service - Technical PermissionとCompany組織資格を合成する
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator("param", z.strictObject({ employee_id: workforceIdSchema })),
  zValidator("query", z.strictObject({ as_of: isoDate })),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    const employeeId = restoreWorkforceId("employee", c.req.valid("param").employee_id)
    const asOf = restoreCalendarDate(c.req.valid("query").as_of)
    await requireCanonicalCompany(c, asOf)
    if (
      employeeId !== toWorkforceEmployeeId(session.employeeId) &&
      !session.hasPermission("employee:read")
    ) {
      throw new NotFoundError("employee not found")
    }
    const authorization = await new CanonicalCompanyAccess({ c, session }).authorizeWorkforceRead(
      employeeId,
      asOf,
    )
    if (authorization.kind === "denied") throw new NotFoundError("employee not found")
    if (authorization.kind === "invalid") {
      throw toHttpException(
        new UnavailableError("Company authority is inconsistent", "company_authority_invalid"),
      )
    }
    if (authorization.kind === "unavailable") {
      throw toHttpException(
        new UnavailableError("Company authority is unavailable", "company_authority_unavailable", {
          cause: authorization.cause,
        }),
      )
    }

    const result = await new ReadWorkforceState({
      workforce: new EmployeeLifecycleWorkforceRepository(c),
      organization: new OrganizationUnitReadRepository(c.var.database),
    }).execute({ employeeId, asOf })
    if (result.kind === "not_found") throw new NotFoundError("employee not found")
    if (result.kind === "invalid_schedule" || result.kind === "invalid_organization") {
      throw toHttpException(
        new UnavailableError("Company workforce is inconsistent", "company_workforce_invalid"),
      )
    }
    if (result.kind === "unavailable") {
      throw toHttpException(
        new UnavailableError("Company workforce is unavailable", "company_workforce_unavailable", {
          cause: result.cause,
        }),
      )
    }
    if (
      authorization.organizationRevision !== null &&
      authorization.organizationRevision !== result.organizationRevision
    ) {
      throw toHttpException(
        new ConflictError("organization revision changed", "organization_revision_conflict"),
      )
    }

    return c.json(
      zAppCompanyWorkforceState.parse(
        toCompanyWorkforceStateResponse(result.state, result.organizationRevision),
      ),
      200,
    )
  },
)
