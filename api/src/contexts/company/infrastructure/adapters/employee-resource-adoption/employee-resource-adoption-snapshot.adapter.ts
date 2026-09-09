import { EmployeeResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/employee-resource-adoption-snapshot.value"
import { CompanyValidationError } from "@/contexts/company/domain/errors"
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

  async findMany(
    employeeIds: ReadonlyArray<string>,
  ): Promise<ReadonlyArray<EmployeeResourceAdoptionSnapshotValue> | Error> {
    try {
      const rows = await this.c
        .prepare(`WITH snapshots AS MATERIALIZED (${employeeResourceAdoptionSnapshotSql("batch")}),
          total AS (SELECT coalesce(sum(length(CAST(snapshot_json AS BLOB))), 0) AS bytes FROM snapshots)
          SELECT CASE WHEN total.bytes <= 8000000 THEN snapshot_json ELSE NULL END AS snapshot_json
          FROM snapshots CROSS JOIN total`)
        .bind(JSON.stringify(employeeIds))
        .all<{ snapshot_json: string | null }>()
      const snapshots: EmployeeResourceAdoptionSnapshotValue[] = []
      for (const row of rows.results) {
        if (row.snapshot_json === null)
          return new CompanyValidationError(
            "一括接続の確認履歴が大きすぎます",
            "employee_resource_adoption_batch_too_large",
          )
        const snapshot = await EmployeeResourceAdoptionSnapshotValue.create(row.snapshot_json)
        if (snapshot instanceof Error) return snapshot
        snapshots.push(snapshot)
      }
      return snapshots
    } catch (cause) {
      return new Error("failed to read workforce adoption snapshots", { cause })
    }
  }

  prepareBatchGuard(payload: string): D1PreparedStatement {
    return this.c
      .prepare(`SELECT CASE WHEN (
      SELECT count(*) FROM json_each(?1) AS expected WHERE coalesce((
        ${employeeResourceAdoptionSnapshotSql("guard")}
      ), '') = json_extract(expected.value, '$.sourceJson')
    ) = json_array_length(?1) THEN 1 ELSE json_extract('', '$') END`)
      .bind(payload)
  }
}
