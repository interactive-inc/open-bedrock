import { ReadOrganizationWorkforceState } from "@/contexts/company/application/workforce/read-organization-workforce-state"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import { OrganizationUnitReadRepository } from "@/contexts/company/infrastructure/workforce/organization-unit-read.repository"
import { OrganizationWorkforceSnapshotRepository } from "@/contexts/company/infrastructure/workforce/organization-workforce-snapshot.repository"
import { ForbiddenError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company/interface/utils/factory"
import { requireCanonicalCompany } from "@/contexts/company/interface/utils/require-canonical-company"
import { toCompanyOrganizationSnapshotResponse } from "@/contexts/company/interface/utils/to-company-organization-snapshot-response"
import { zAppCompanyOrganizationSnapshot } from "@/lib/app-schemas"
import { UnavailableError } from "@/lib/errors"
import { isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission - 全社Workforce読取permissionで判定する
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator("query", z.strictObject({ as_of: isoDate })),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    if (!session.hasPermission("employee:lifecycle:read:all")) throw new ForbiddenError()
    const asOf = restoreCalendarDate(c.req.valid("query").as_of)
    await requireCanonicalCompany(c, asOf)

    const result = await new ReadOrganizationWorkforceState({
      organization: new OrganizationUnitReadRepository(c.var.database),
      workforce: new OrganizationWorkforceSnapshotRepository(c),
    }).execute(asOf)
    if (result.kind === "invalid") {
      throw toHttpException(
        new UnavailableError("Company organization is inconsistent", "company_workforce_invalid"),
      )
    }
    if (result.kind === "unavailable") {
      throw toHttpException(
        new UnavailableError(
          "Company organization is unavailable",
          "company_workforce_unavailable",
          { cause: result.cause },
        ),
      )
    }

    return c.json(
      zAppCompanyOrganizationSnapshot.parse(toCompanyOrganizationSnapshotResponse(result)),
      200,
    )
  },
)
