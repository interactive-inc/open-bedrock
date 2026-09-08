import { z } from "zod"
import { LicenseEntity } from "@/contexts/software-license/domain/entities/license.entity"
import type { LicenseState as LicenseRow } from "@/contexts/software-license/domain/entities/license.entity"
import type { SoftwareLicenseContext } from "@/contexts/software-license/configuration/software-license-context"
import { LicenseError } from "@/contexts/software-license/domain/errors"

const columns = `id, name, vendor, category, seats, renewal_deadline AS renewalDeadline,
  owner_employee_id AS ownerEmployeeId, note, status, created_at AS createdAt,
  plan_name AS planName, revision`
const snapshot = `json_object('id',id,'name',name,'vendor',vendor,'category',category,'seats',seats,
  'renewalDeadline',renewal_deadline,'ownerEmployeeId',owner_employee_id,'note',note,
  'status',status,'createdAt',created_at,'planName',plan_name,'revision',revision)`
type WriteOptions = Readonly<{
  commandId?: string
  requestJson?: string
  previous: LicenseEntity | null
  accountId: string
  recordedAt: number
  assertions: ReadonlyArray<D1PreparedStatement>
}>

type Context = Pick<SoftwareLicenseContext, "env">

/** 契約台帳とその変更履歴を同じtransactionで保存する。 */
export class LicenseRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(id: number): Promise<LicenseEntity | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT ${columns} FROM software_licenses WHERE id = ?1`,
      )
        .bind(id)
        .first<LicenseRow>()
      return row === null ? null : LicenseEntity.fromRow(row)
    } catch (cause) {
      return new Error("license is unavailable", { cause })
    }
  }

  async findMany(
    props: Readonly<{ status: "active" | "cancelled" | null; limit: number; offset: number }>,
  ) {
    try {
      const pages = await this.c.env.DB.batch([
        this.c.env.DB.prepare(`SELECT ${columns} FROM software_licenses WHERE (?1 IS NULL OR status = ?1)
          ORDER BY renewal_deadline IS NULL, renewal_deadline, id LIMIT ?2 OFFSET ?3`).bind(
          props.status,
          props.limit,
          props.offset,
        ),
        this.c.env.DB.prepare(
          `SELECT count(*) AS total FROM software_licenses WHERE (?1 IS NULL OR status = ?1)`,
        ).bind(props.status),
      ])
      const rows = pages[0]?.results as LicenseRow[] | undefined
      const count = z.object({ total: z.number().int().nonnegative() }).parse(pages[1]?.results[0])
      if (pages.length !== 2 || pages.some((page) => !page.success) || rows === undefined)
        return new Error("license list is unavailable")
      return { licenses: rows.map((row) => LicenseEntity.fromRow(row)), total: count.total }
    } catch (cause) {
      return new Error("license list is unavailable", { cause })
    }
  }

  async write(
    license: LicenseEntity,
    options: WriteOptions,
  ): Promise<LicenseEntity | LicenseError> {
    const database = this.c.env.DB
    const changeId = crypto.randomUUID()
    const values = [
      license.name,
      license.vendor,
      license.category,
      license.seats,
      license.renewalDeadline,
      license.ownerEmployeeId,
      license.note,
      license.status,
      license.planName,
    ]
    const statements = [...options.assertions]
    if (license.id === null) {
      statements.push(
        database
          .prepare(`INSERT INTO software_licenses
        (name,vendor,category,seats,renewal_deadline,owner_employee_id,note,status,plan_name,created_at,revision)
        VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,1)`)
          .bind(...values, license.createdAt),
      )
      statements.push(
        database
          .prepare(`INSERT INTO software_license_changes
        (id,license_id,actor_account_id,recorded_at,command_id,request_json,before_json,after_json)
        SELECT ?1,id,?2,?3,?4,?5,NULL,${snapshot} FROM software_licenses WHERE id = last_insert_rowid()`)
          .bind(
            changeId,
            options.accountId,
            options.recordedAt,
            options.commandId ?? null,
            options.requestJson ?? null,
          ),
      )
    } else {
      statements.push(
        database
          .prepare(`UPDATE software_licenses SET name=?1,vendor=?2,category=?3,seats=?4,
        renewal_deadline=?5,owner_employee_id=?6,note=?7,status=?8,plan_name=?9,revision=revision+1
        WHERE id=?10 AND revision=?11`)
          .bind(...values, license.id, license.revision),
      )
      statements.push(
        database.prepare(
          `SELECT CASE WHEN changes()=1 THEN 1 ELSE json_extract('{}','license_revision_changed') END AS ok`,
        ),
      )
      statements.push(
        database
          .prepare(`INSERT INTO software_license_changes
        (id,license_id,actor_account_id,recorded_at,before_json,after_json)
        SELECT ?1,id,?2,?3,?4,${snapshot} FROM software_licenses WHERE id=?5`)
          .bind(
            changeId,
            options.accountId,
            options.recordedAt,
            JSON.stringify(options.previous),
            license.id,
          ),
      )
    }
    statements.push(
      database
        .prepare(`SELECT ${columns} FROM software_licenses
      WHERE id=(SELECT license_id FROM software_license_changes WHERE id=?1)`)
        .bind(changeId),
    )
    try {
      const writes = await database.batch(statements)
      const row = writes.at(-1)?.results[0] as LicenseRow | undefined
      if (
        writes.length !== statements.length ||
        writes.some((write) => !write.success) ||
        row === undefined
      )
        return new LicenseError("license_unavailable", "license write is unavailable")
      return LicenseEntity.fromRow(row)
    } catch (cause) {
      if (
        cause instanceof Error &&
        /software_license_capacity_conflict|license_revision_changed|UNIQUE constraint failed: software_license_changes/.test(
          cause.message,
        )
      )
        return new LicenseError(
          "license_conflict",
          "license changed or active assignments prevent this change",
          { cause },
        )
      return new LicenseError("license_unavailable", "license write is unavailable", { cause })
    }
  }
}
