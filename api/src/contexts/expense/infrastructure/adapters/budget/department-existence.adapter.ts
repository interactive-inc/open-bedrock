import { departments } from "@/contexts/company/infrastructure/schema/organization"
import type { Context } from "@/env"
import { eq } from "drizzle-orm"

export class DepartmentExistenceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async exists(departmentId: number): Promise<boolean | Error> {
    try {
      const rows = await this.c.var.database
        .select({ id: departments.id })
        .from(departments)
        .where(eq(departments.id, departmentId))
        .limit(1)
      return rows.length > 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to find department")
    }
  }
}
