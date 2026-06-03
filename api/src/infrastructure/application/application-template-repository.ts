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

  async create(template: ApplicationTemplate): Promise<ApplicationTemplate | Error> {
    try {
      const rows = await this.c.var.database
        .insert(applicationTemplates)
        .values({
          code: template.code,
          name: template.name,
          category: template.category,
          description: template.description,
          schemaJson: JSON.stringify(template.schemaJson),
          approverRoles: JSON.stringify(template.approverRoles),
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert application_template")
        : ApplicationTemplate.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert application_template")
    }
  }

  // 申請テンプレートの内容を更新する。code をキーに更新し、更新後の行を返す。
  async update(template: ApplicationTemplate): Promise<ApplicationTemplate | Error> {
    try {
      const rows = await this.c.var.database
        .update(applicationTemplates)
        .set({
          name: template.name,
          category: template.category,
          description: template.description,
          schemaJson: JSON.stringify(template.schemaJson),
          approverRoles: JSON.stringify(template.approverRoles),
        })
        .where(eq(applicationTemplates.code, template.code))
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to update application_template")
        : ApplicationTemplate.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update application_template")
    }
  }

  // 申請テンプレートを削除する。
  async delete(code: string): Promise<null | Error> {
    try {
      await this.c.var.database
        .delete(applicationTemplates)
        .where(eq(applicationTemplates.code, code))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete application_template")
    }
  }
}
