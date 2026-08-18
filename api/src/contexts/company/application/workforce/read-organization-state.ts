import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import type { OrganizationInvariantViolation } from "@/contexts/company/domain/workforce/validate-organization-unit-snapshot"
import { validateOrganizationUnitSnapshot } from "@/contexts/company/domain/workforce/validate-organization-unit-snapshot"
import type { OrganizationUnitSnapshot } from "@/contexts/company/domain/workforce/organization-unit"

export type OrganizationUnitSnapshotReadResult =
  | Readonly<{ ok: true; snapshot: OrganizationUnitSnapshot }>
  | Readonly<{ ok: false; cause: unknown }>

export type OrganizationRevisionReadResult =
  | Readonly<{ ok: true; revision: number }>
  | Readonly<{ ok: false; cause: unknown }>

export type OrganizationUnitReadPort = {
  readSnapshot(asOf: CalendarDate): Promise<OrganizationUnitSnapshotReadResult>
  readRevision(): Promise<OrganizationRevisionReadResult>
}

export type ReadOrganizationStateResult =
  | Readonly<{ kind: "found"; snapshot: OrganizationUnitSnapshot }>
  | Readonly<{ kind: "invalid_organization"; error: OrganizationInvariantViolation }>
  | Readonly<{ kind: "unavailable"; cause: unknown }>

/** 製品固有の保存形式を漏らさず、検証済みCompany組織snapshotだけを返す。 */
export class ReadOrganizationState {
  constructor(private readonly port: OrganizationUnitReadPort) {
    Object.freeze(this)
  }

  async execute(asOf: CalendarDate): Promise<ReadOrganizationStateResult> {
    let loaded: OrganizationUnitSnapshotReadResult
    try {
      loaded = await this.port.readSnapshot(asOf)
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
    if (!loaded.ok) return { kind: "unavailable", cause: loaded.cause }

    const error = validateOrganizationUnitSnapshot(loaded.snapshot)
    return error === null
      ? { kind: "found", snapshot: loaded.snapshot }
      : { kind: "invalid_organization", error }
  }
}
