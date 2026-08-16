import { License } from "@/contexts/software-license/domain/license/license.entity"
import type { Context } from "@/env"
import { licenses } from "@/contexts/software-license/infrastructure/schema/software-license"
import { and, asc, count, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"

export class LicenseRepository {
  constructor(private readonly c: Context) {}

  /** 更新期限が近い順（NULL は末尾）で台帳を返す。status で絞り込める。 */
  async findAll(props: {
    status: "active" | "cancelled" | null
    limit: number
    offset: number
  }): Promise<ReadonlyArray<License> | Error> {
    try {
      const where = toWhere(props.status)

      const rows = await this.c.var.database
        .select()
        .from(licenses)
        .where(where)
        .orderBy(asc(licenses.renewalDeadline))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => License.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load licenses")
    }
  }

  async count(status: "active" | "cancelled" | null): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .select({ total: count() })
        .from(licenses)
        .where(toWhere(status))

      return rows.at(0)?.total ?? 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count licenses")
    }
  }

  async findById(id: number): Promise<License | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(licenses)
        .where(eq(licenses.id, id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : License.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load license")
    }
  }

  async create(license: License): Promise<License | Error> {
    try {
      const rows = await this.c.var.database
        .insert(licenses)
        .values({
          name: license.name,
          vendor: license.vendor,
          category: license.category,
          seats: license.seats,
          renewalDeadline: license.renewalDeadline,
          ownerEmployeeId: license.ownerEmployeeId,
          note: license.note,
          status: license.status,
          createdAt: license.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined ? new Error("failed to insert license") : License.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert license")
    }
  }

  async update(license: License): Promise<License | null | Error> {
    try {
      if (license.id === null) {
        return new Error("cannot update unsaved license")
      }

      const rows = await this.c.var.database
        .update(licenses)
        .set({
          name: license.name,
          vendor: license.vendor,
          category: license.category,
          seats: license.seats,
          renewalDeadline: license.renewalDeadline,
          ownerEmployeeId: license.ownerEmployeeId,
          note: license.note,
          status: license.status,
        })
        .where(eq(licenses.id, license.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : License.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update license")
    }
  }
}

/** status 絞り込み条件を組み立てる。未指定は全件。 */
function toWhere(status: "active" | "cancelled" | null): SQL | undefined {
  const conditions: Array<SQL> = []

  if (status !== null) {
    conditions.push(eq(licenses.status, status))
  }

  return conditions.length === 0 ? undefined : and(...conditions)
}
