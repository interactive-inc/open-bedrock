import type { Department } from "@/contexts/company/domain/organization/department.value"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/lib/d1/is-unique-constraint-error"
import { UniqueConstraintError } from "@/lib/d1/unique-constraint-error"
import { departments } from "@/contexts/company/infrastructure/schema/organization"
import { asc } from "drizzle-orm"

export class DepartmentRepository {
  constructor(private readonly c: Context) {}

  /** 部署マスタを id の昇順で返す。 */
  async findAll(props: {
    limit: number
    offset: number
  }): Promise<ReadonlyArray<Department> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(departments)
        .orderBy(asc(departments.id))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => ({ id: row.id, name: row.name }))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load departments")
    }
  }

  async count(): Promise<number | Error> {
    try {
      const rows = await this.c.var.database.select({ id: departments.id }).from(departments)

      return rows.length
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count departments")
    }
  }

  async create(name: string): Promise<Department | Error> {
    try {
      const rows = await this.c.var.database.insert(departments).values({ name }).returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to create department")
        : { id: row.id, name: row.name }
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("department name already exists", { cause: error })
      }

      return error instanceof Error ? error : new Error("failed to create department")
    }
  }
}
