import { ReadOrganizationWorkforceState } from "@/contexts/company/infrastructure/workforce/read-organization-workforce-state.repository"
import { restoreCalendarDate } from "@/contexts/company/domain/values/restore-calendar-date.definition"
import type { CalendarDate } from "@/contexts/company/domain/values/calendar-date.definition"
import { OrganizationUnitReadRepository } from "@/contexts/company/infrastructure/workforce/organization-unit-read.repository"
import { OrganizationWorkforceSnapshotRepository } from "@/contexts/company/infrastructure/workforce/organization-workforce-snapshot.repository"
import type { CompanyContext } from "@/contexts/company/infrastructure/configuration/company-context.repository"
import {
  CompanyConflictError,
  CompanyUnavailableError,
  CompanyUnexpectedError,
} from "@/contexts/company/domain/errors"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/values/resolve-company-business-date.definition"

/** 既存App向けに、会社営業日時点の検証済みcanonical Company snapshotを一度だけ読む。 */
export async function readCanonicalOrganizationState(c: CompanyContext, asOf?: CalendarDate) {
  const businessDate =
    asOf ??
    resolveCompanyBusinessDate({
      now: c.env.NOW ?? new Date().toISOString(),
      timeZone: c.env.COMPANY_TIME_ZONE,
    })
  if (typeof businessDate !== "string") {
    return new CompanyUnexpectedError("会社営業日を解決できません", { cause: businessDate })
  }
  const result = await new ReadOrganizationWorkforceState({
    organization: new OrganizationUnitReadRepository(c.var.database),
    workforce: new OrganizationWorkforceSnapshotRepository(c),
  }).execute(restoreCalendarDate(businessDate))
  if (result.kind === "unavailable") {
    return new CompanyUnavailableError(
      "Company組織snapshotを読み出せません",
      "organization_snapshot_unavailable",
      { cause: result.cause },
    )
  }
  if (result.kind === "invalid") {
    return new CompanyConflictError(
      "Company組織snapshotが不整合です",
      "code" in result.error ? String(result.error.code) : "organization_snapshot_invalid",
      { cause: result.error },
    )
  }
  return result
}
