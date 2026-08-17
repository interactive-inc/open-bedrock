import type {
  OrganizationRevisionReadResult,
  OrganizationUnitReadPort,
  OrganizationUnitSnapshotReadResult,
} from "@/contexts/company/application/workforce/read-organization-state"
import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import { WorkforceSnapshotChangedError } from "@/contexts/company/application/workforce/read-workforce-state"
import { projectOrganizationUnitSnapshot } from "@/contexts/company-compatibility/infrastructure/workforce/organization-unit-row.adapter"
import {
  organizationChangeOperations,
  organizationLifecycleStates,
  organizationUnitPeriodVersions,
} from "@/contexts/company-compatibility/infrastructure/schema/organization"
import { asc, eq } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"

type OrganizationDatabase = Pick<
  DrizzleD1Database<{
    organizationLifecycleStates: typeof organizationLifecycleStates
    organizationChangeOperations: typeof organizationChangeOperations
    organizationUnitPeriodVersions: typeof organizationUnitPeriodVersions
  }>,
  "select"
>

export class InvalidOrganizationLifecycleStateError extends Error {
  readonly code = "invalid_organization_lifecycle_state"

  constructor() {
    super("organization lifecycle state is missing or invalid")
    this.name = "InvalidOrganizationLifecycleStateError"
  }
}

/** Company組織のappend-only tablesをrevision付き共通snapshot portへ接続する。 */
export class OrganizationUnitReadRepository implements OrganizationUnitReadPort {
  constructor(private readonly database: OrganizationDatabase) {
    Object.freeze(this)
  }

  private async revision(): Promise<number> {
    const pending = await this.database
      .select({ id: organizationChangeOperations.id })
      .from(organizationChangeOperations)
      .where(eq(organizationChangeOperations.status, "PENDING"))
      .limit(1)
    if (pending.length !== 0) throw new InvalidOrganizationLifecycleStateError()

    const rows = await this.database
      .select({ revision: organizationLifecycleStates.revision })
      .from(organizationLifecycleStates)
      .where(eq(organizationLifecycleStates.id, 1))
      .limit(2)
    const revision = rows[0]?.revision
    if (rows.length !== 1 || !Number.isSafeInteger(revision) || revision < 0) {
      throw new InvalidOrganizationLifecycleStateError()
    }
    return revision
  }

  async readRevision(): Promise<OrganizationRevisionReadResult> {
    try {
      return { ok: true, revision: await this.revision() }
    } catch (cause) {
      return { ok: false, cause }
    }
  }

  async readSnapshot(asOf: CalendarDate): Promise<OrganizationUnitSnapshotReadResult> {
    try {
      const revision = await this.revision()
      const rows = await this.database
        .select()
        .from(organizationUnitPeriodVersions)
        .orderBy(
          asc(organizationUnitPeriodVersions.periodId),
          asc(organizationUnitPeriodVersions.revision),
        )
      if ((await this.revision()) !== revision) throw new WorkforceSnapshotChangedError()

      return {
        ok: true,
        snapshot: projectOrganizationUnitSnapshot({ revision, asOf, rows }),
      }
    } catch (cause) {
      return { ok: false, cause }
    }
  }
}
