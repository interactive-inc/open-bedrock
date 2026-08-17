import { ReadCompanyReadiness } from "@/contexts/company/application/workforce/read-company-readiness"
import { ReadOrganizationWorkforceState } from "@/contexts/company/application/workforce/read-organization-workforce-state"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import { CompanyReadinessRepository } from "@/contexts/company/infrastructure/workforce/company-readiness.repository"
import { OrganizationUnitReadRepository } from "@/contexts/company/infrastructure/workforce/organization-unit-read.repository"
import { OrganizationWorkforceSnapshotRepository } from "@/contexts/company/infrastructure/workforce/organization-workforce-snapshot.repository"
import type { Context } from "@/env"
import { ConflictError, UnavailableError, UnexpectedError } from "@/lib/errors"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"

/** 既存App向けに、会社営業日時点の検証済みcanonical Company snapshotを一度だけ読む。 */
export async function readCanonicalOrganizationState(c: Context, asOf?: CalendarDate) {
  const readiness = await new ReadCompanyReadiness(
    new CompanyReadinessRepository(c.env.DB),
  ).execute(c.env.COMPANY_TIME_ZONE)
  if (readiness.kind === "incomplete") {
    return new UnavailableError(
      "Company migrationが完了していません",
      "company_migration_incomplete",
    )
  }
  if (readiness.kind === "unavailable") {
    return new UnavailableError(
      "Company migrationの状態を確認できません",
      "company_migration_unavailable",
      { cause: readiness.cause },
    )
  }

  const businessDate =
    asOf ??
    resolveCompanyBusinessDate({
      now: c.env.NOW ?? new Date().toISOString(),
      timeZone: c.env.COMPANY_TIME_ZONE,
    })
  if (typeof businessDate !== "string") {
    return new UnexpectedError("会社営業日を解決できません", { cause: businessDate })
  }
  if (businessDate < readiness.baselineOn) {
    return new UnavailableError(
      "Company snapshotの基準日がmigration baselineより前です",
      "company_as_of_before_baseline",
    )
  }

  const result = await new ReadOrganizationWorkforceState({
    organization: new OrganizationUnitReadRepository(c.var.database),
    workforce: new OrganizationWorkforceSnapshotRepository(c),
  }).execute(restoreCalendarDate(businessDate))
  if (result.kind === "unavailable") {
    return new UnavailableError(
      "Company組織snapshotを読み出せません",
      "organization_snapshot_unavailable",
      { cause: result.cause },
    )
  }
  if (result.kind === "invalid") {
    return new ConflictError(
      "Company組織snapshotが不整合です",
      "code" in result.error ? String(result.error.code) : "organization_snapshot_invalid",
      { cause: result.error },
    )
  }
  return result
}
