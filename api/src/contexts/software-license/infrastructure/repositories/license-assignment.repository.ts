import { LicenseAssignmentEntity } from "@/contexts/software-license/domain/entities/license-assignment.entity"
import type { SoftwareLicenseContext } from "@/contexts/software-license/configuration/software-license-context"
import { LicenseError } from "@/contexts/software-license/domain/errors"
import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"

type Context = Pick<SoftwareLicenseContext, "env">

/** 割当履歴と監査をまとめて保存する。 */
export class LicenseAssignmentRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(
    id: string,
    assertions: ReadonlyArray<D1PreparedStatement> = [],
  ): Promise<LicenseAssignmentEntity | null | Error> {
    try {
      const reads = await this.c.env.DB.batch([
        ...assertions,
        this.c.env.DB.prepare("SELECT * FROM software_license_assignments WHERE id=?1").bind(id),
      ])
      if (reads.some((read) => !read.success)) return new Error("assignment is unavailable")
      const row = reads.at(-1)?.results[0]
      return row === undefined ? null : LicenseAssignmentEntity.create(row)
    } catch (cause) {
      return new Error("assignment is unavailable", { cause })
    }
  }

  async findMany(
    input: Readonly<{
      licenseId: number | null
      employeeId: string | null
      state: "assigned" | "released" | null
      limit: number
      offset: number
    }>,
  ) {
    try {
      const rows = await this.c.env.DB.prepare(`SELECT * FROM software_license_assignments
        WHERE (?1 IS NULL OR license_id=?1) AND (?2 IS NULL OR employee_id=?2)
          AND (?3 IS NULL OR (?3='assigned' AND released_at IS NULL) OR (?3='released' AND released_at IS NOT NULL))
        ORDER BY assigned_at DESC, id LIMIT ?4 OFFSET ?5`)
        .bind(input.licenseId, input.employeeId, input.state, input.limit, input.offset)
        .all()
      if (!rows.success) return new Error("assignment list is unavailable")
      const assignments = rows.results.map((row) => LicenseAssignmentEntity.create(row))
      const invalid = assignments.find((assignment) => assignment instanceof Error)
      if (invalid instanceof Error) return invalid
      return assignments.filter(
        (assignment): assignment is LicenseAssignmentEntity =>
          assignment instanceof LicenseAssignmentEntity,
      )
    } catch (cause) {
      return new Error("assignment list is unavailable", { cause })
    }
  }

  async write(
    assignment: LicenseAssignmentEntity,
    input: Readonly<{
      isNew: boolean
      licenseRevision: number
      assertions: ReadonlyArray<D1PreparedStatement>
      audit: SystemAuditEventEntity
    }>,
  ): Promise<void | LicenseError> {
    const database = this.c.env.DB
    const props = assignment.props
    const statements = [
      ...input.assertions,
      database
        .prepare(`SELECT CASE WHEN EXISTS
      (SELECT 1 FROM software_licenses WHERE id=?1 AND revision=?2)
      THEN 1 ELSE json_extract('{}','license_revision_changed') END AS ok`)
        .bind(props.license_id, input.licenseRevision),
    ]
    if (input.isNew) {
      statements.push(
        database
          .prepare(`INSERT INTO software_license_assignments
        (id,license_id,employee_id,service_name,plan_name,account_reference,assigned_at,assigned_by,assigned_reason,released_at,released_by,release_reason)
        VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,NULL,NULL,NULL)`)
          .bind(
            props.id,
            props.license_id,
            props.employee_id,
            props.service_name,
            props.plan_name,
            props.account_reference,
            props.assigned_at,
            props.assigned_by,
            props.assigned_reason,
          ),
      )
    } else {
      statements.push(
        database
          .prepare(`UPDATE software_license_assignments SET released_at=?1,released_by=?2,release_reason=?3
        WHERE id=?4 AND released_at IS NULL`)
          .bind(props.released_at, props.released_by, props.release_reason, props.id),
      )
      statements.push(
        database.prepare(
          `SELECT CASE WHEN changes()=1 THEN 1 ELSE json_extract('{}','license_assignment_changed') END AS ok`,
        ),
      )
    }
    statements.push(...new SystemAuditEventRepository(this.c).prepareAppend(input.audit))
    try {
      const writes = await database.batch(statements)
      if (writes.length !== statements.length || writes.some((write) => !write.success))
        return new LicenseError("license_unavailable", "assignment write is unavailable")
    } catch (cause) {
      if (
        cause instanceof Error &&
        /software_license_capacity_conflict|UNIQUE constraint failed: software_license_assignments|license_revision_changed|license_assignment_changed/.test(
          cause.message,
        )
      )
        return new LicenseError(
          "license_conflict",
          "assignment conflicts with current license state",
          { cause },
        )
      return new LicenseError("license_unavailable", "assignment write is unavailable", { cause })
    }
  }
}
