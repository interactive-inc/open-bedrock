import { ReadCompanyReadiness } from "@/contexts/company/application/workforce/read-company-readiness"
import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import { CompanyReadinessRepository } from "@/contexts/company/infrastructure/workforce/company-readiness.repository"
import type { Context } from "@/env"
import { UnavailableError, UnprocessableError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"

/** canonical Company migrationが未完了ならlegacyへ戻らず503で停止する。 */
export async function requireCanonicalCompany(c: Context, asOf?: CalendarDate): Promise<void> {
  const readiness = await new ReadCompanyReadiness(
    new CompanyReadinessRepository(c.env.DB),
  ).execute(c.env.COMPANY_TIME_ZONE)
  if (readiness.kind === "ready") {
    if (asOf !== undefined && asOf < readiness.baselineOn) {
      throw toHttpException(
        new UnprocessableError(
          "as_of is before the canonical Company baseline",
          "company_as_of_before_baseline",
        ),
      )
    }
    return
  }

  throw toHttpException(
    new UnavailableError(
      "canonical Company migration is not ready",
      readiness.kind === "incomplete"
        ? "company_migration_incomplete"
        : "company_migration_unavailable",
      readiness.kind === "unavailable" ? { cause: readiness.cause } : undefined,
    ),
  )
}
