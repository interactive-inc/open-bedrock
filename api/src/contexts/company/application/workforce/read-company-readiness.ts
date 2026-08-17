import {
  isCalendarDate,
  type CalendarDate,
} from "@/contexts/company/domain/workforce/calendar-date"

export type CompanyMigrationStatus = "pending" | "backfilled" | "verified"

export type CompanyReadinessPortResult =
  | Readonly<{
      ok: true
      status: CompanyMigrationStatus
      baselineOn: string | null
      companyTimeZone: string | null
    }>
  | Readonly<{ ok: false; cause: unknown }>

export type CompanyReadinessPort = Readonly<{
  readStatus(): Promise<CompanyReadinessPortResult>
}>

export type ReadCompanyReadinessResult =
  | Readonly<{ kind: "ready"; baselineOn: CalendarDate }>
  | Readonly<{ kind: "incomplete"; status: Exclude<CompanyMigrationStatus, "verified"> }>
  | Readonly<{ kind: "unavailable"; cause: unknown }>

/** canonical Company APIを未移行projectionへfallbackさせず、明示的に停止する。 */
export class ReadCompanyReadiness {
  constructor(private readonly port: CompanyReadinessPort) {
    Object.freeze(this)
  }

  async execute(expectedCompanyTimeZone: string | undefined): Promise<ReadCompanyReadinessResult> {
    try {
      const read = await this.port.readStatus()
      if (!read.ok) return { kind: "unavailable", cause: read.cause }

      if (read.status !== "verified") return { kind: "incomplete", status: read.status }
      if (read.baselineOn === null || !isCalendarDate(read.baselineOn)) {
        return { kind: "unavailable", cause: new Error("Company baseline date is missing") }
      }
      if (
        expectedCompanyTimeZone === undefined ||
        read.companyTimeZone === null ||
        read.companyTimeZone !== expectedCompanyTimeZone
      ) {
        return { kind: "unavailable", cause: new Error("Company time zone is inconsistent") }
      }
      return { kind: "ready", baselineOn: read.baselineOn }
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
  }
}
