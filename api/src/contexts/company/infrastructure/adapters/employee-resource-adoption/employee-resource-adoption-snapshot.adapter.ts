import { EmployeeResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/employee-resource-adoption-snapshot.value"
import { employeeResourceAdoptionSnapshotSql } from "@/contexts/company/infrastructure/adapters/employee-resource-adoption/lib/employee-resource-adoption-snapshot-sql"

type Context = D1Database

/** 既存台帳の全期間revisionを保全する移行snapshotと、同一transactionの変更検知を用意する。 */
export class EmployeeResourceAdoptionSnapshotAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(employeeId: string): Promise<EmployeeResourceAdoptionSnapshotValue | null | Error> {
    try {
      const row = await this.c
        .prepare(employeeResourceAdoptionSnapshotSql())
        .bind(employeeId)
        .first<{ snapshot_json: string }>()
      if (row === null) return null
      return EmployeeResourceAdoptionSnapshotValue.create(row.snapshot_json)
    } catch (cause) {
      return new Error("failed to read workforce adoption snapshot", { cause })
    }
  }

  prepareGuard(snapshot: EmployeeResourceAdoptionSnapshotValue): D1PreparedStatement {
    return this.c
      .prepare(`SELECT CASE WHEN coalesce((
      ${employeeResourceAdoptionSnapshotSql()}
    ), '') = ?2 THEN 1 ELSE json_extract('', '$') END`)
      .bind(snapshot.props.value.employee.id, snapshot.props.sourceJson)
  }
}
