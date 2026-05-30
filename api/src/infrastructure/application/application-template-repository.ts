import { ApplicationTemplate } from "@/domain/application/application-template"
import type { Context } from "@/env"
import { applicationTemplates } from "@/schema"
import { eq } from "drizzle-orm"

export class ApplicationTemplateRepository {
  constructor(private readonly c: Context) {}

  async findByCode(code: string): Promise<ApplicationTemplate | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(applicationTemplates)
        .where(eq(applicationTemplates.code, code))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : ApplicationTemplate.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load application_template")
    }
  }
}
