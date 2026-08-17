import type {
  OrganizationalAuthorityCandidateResolution,
  OrganizationalAuthorityCriterion,
  OrganizationalAuthoritySnapshot,
} from "@/contexts/company-compatibility/domain/organization/organizational-authority-candidate"
import { ReadCompanyReadiness } from "@/contexts/company/application/workforce/read-company-readiness"
import { resolveCanonicalOrganizationAuthority } from "@/contexts/company-compatibility/infrastructure/workforce/resolve-canonical-organization-authority"
import { employees } from "@/contexts/company-compatibility/infrastructure/schema/employee"
import { CompanyReadinessRepository } from "@/contexts/company-compatibility/infrastructure/workforce/company-readiness.repository"
import type { Context } from "@/env"
import { ApplicationError, ConflictError, UnavailableError, UnexpectedError } from "@/lib/errors"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"

async function readOrganizationRevision(c: Context): Promise<number | ApplicationError> {
  try {
    const revision = await c.env.DB.prepare(
      "SELECT revision FROM organization_lifecycle_states WHERE id = 1",
    ).first<number>("revision")

    return revision === null
      ? new UnavailableError("組織 revision がありません", "organization_snapshot_unavailable")
      : revision
  } catch (cause) {
    return new UnavailableError(
      "組織 revision を読み出せません",
      "organization_snapshot_unavailable",
      { cause },
    )
  }
}

async function resolveSnapshot(
  c: Context,
  resolvedAt: string,
): Promise<OrganizationalAuthoritySnapshot | ApplicationError> {
  const asOf = resolveCompanyBusinessDate({
    now: resolvedAt,
    timeZone: c.env.COMPANY_TIME_ZONE,
  })
  if (typeof asOf !== "string") {
    return new UnexpectedError("判断資格の基準日を解決できません", { cause: asOf })
  }

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
  if (asOf < readiness.baselineOn) {
    return new UnavailableError(
      "Company snapshotの基準日がmigration baselineより前です",
      "company_as_of_before_baseline",
    )
  }

  const organizationRevision = await readOrganizationRevision(c)
  return organizationRevision instanceof ApplicationError
    ? organizationRevision
    : {
        schemaVersion: 1,
        source: "lifecycle",
        asOf,
        organizationRevision,
      }
}

function revisionConflict(): ConflictError {
  return new ConflictError(
    "組織 revision が変化したため判断資格を固定できません",
    "organization_revision_conflict",
  )
}

/** canonical Company組織だけから判断候補と変更不能な証拠snapshotを解決する。 */
export async function resolveOrganizationalAuthorityCandidates(props: {
  c: Context
  subjectEmployeeId: number | null
  criteria: ReadonlyArray<OrganizationalAuthorityCriterion>
  resolvedAt: string
  targetDepartmentCode?: string | null
}): Promise<OrganizationalAuthorityCandidateResolution | ApplicationError> {
  const snapshot = await resolveSnapshot(props.c, props.resolvedAt)
  if (snapshot instanceof ApplicationError) return snapshot

  try {
    const employeeRows = await props.c.var.database
      .select({ id: employees.id, code: employees.code })
      .from(employees)
    const resolution = await resolveCanonicalOrganizationAuthority({
      c: props.c,
      subjectEmployeeId: props.subjectEmployeeId,
      criteria: props.criteria,
      employeeRows,
      targetDepartmentCode: props.targetDepartmentCode ?? null,
      asOf: snapshot.asOf,
    })
    if (resolution instanceof ApplicationError) return resolution

    const finalOrganizationRevision = await readOrganizationRevision(props.c)
    if (finalOrganizationRevision instanceof ApplicationError) return finalOrganizationRevision
    if (finalOrganizationRevision !== resolution.snapshot.organizationRevision) {
      return revisionConflict()
    }

    return resolution
  } catch (cause) {
    return new UnexpectedError("組織上の判断資格を解決できません", { cause })
  }
}
