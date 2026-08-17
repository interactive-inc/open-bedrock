import type {
  CompanyReadinessPort,
  CompanyReadinessPortResult,
} from "@/contexts/company/application/workforce/read-company-readiness"

/** lifecycle migration markerをcanonical Company APIのreadiness portへ接続する。 */
export class CompanyReadinessRepository implements CompanyReadinessPort {
  constructor(private readonly database: D1Database) {
    Object.freeze(this)
  }

  async readStatus(): Promise<CompanyReadinessPortResult> {
    try {
      const row = await this.database
        .prepare(
          `SELECT status, baseline_on AS baselineOn, company_time_zone AS companyTimeZone
             FROM lifecycle_migration_states WHERE id = 1`,
        )
        .first<{
          status: "pending" | "backfilled" | "verified"
          baselineOn: string | null
          companyTimeZone: string | null
        }>()

      return row === null
        ? { ok: false, cause: new Error("company migration state is missing") }
        : {
            ok: true,
            status: row.status,
            baselineOn: row.baselineOn,
            companyTimeZone: row.companyTimeZone,
          }
    } catch (cause) {
      return { ok: false, cause }
    }
  }
}
