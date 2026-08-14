import { ApplicationTemplate } from "@/contexts/company/domain/application/application-template.entity"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/contexts/company/infrastructure/shared/is-unique-constraint-error"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/d1/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/d1/is-aborted-by-guard"
import { UniqueConstraintError } from "@/contexts/company/infrastructure/shared/unique-constraint-error"
import { applicationTemplates } from "@/schema"
import { eq } from "drizzle-orm"

export class ApplicationTemplateRepository {
  constructor(private readonly c: Context) {}

  async findById(id: number): Promise<ApplicationTemplate | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(applicationTemplates)
        .where(eq(applicationTemplates.id, id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : ApplicationTemplate.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load application_template")
    }
  }

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
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("application_template unique constraint violated", {
          cause: error,
        })
      }

      return error instanceof Error ? error : new Error("failed to insert application_template")
    }
  }

  /**
   * 申請テンプレートの内容を更新する。code をキーに更新し、更新後の行を返す。
   * 対象行が存在しない場合は null を返す。
   */
  async update(template: ApplicationTemplate): Promise<ApplicationTemplate | null | Error> {
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

      return row === undefined ? null : ApplicationTemplate.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update application_template")
    }
  }

  /**
   * 参照する申請が 1 件も存在しない場合のみテンプレートを削除する。
   * 状態を問わず（pending / approved / rejected）参照があれば削除しない。
   * 決定済み申請がテンプレートを参照したまま削除されると、監査記録（template_name/code）が壊れるため。
   * D1 batch でチェックと削除をアトミックに実行し TOCTOU を防ぐ。
   * 0 行削除（参照する申請が存在）なら null を返す。
   */
  async delete(code: string): Promise<true | null | Error> {
    try {
      await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          `DELETE FROM application_templates
           WHERE code = ?1
             AND NOT EXISTS (
               SELECT 1 FROM application_requests
               WHERE template_id = (SELECT id FROM application_templates WHERE code = ?1)
             )`,
        ).bind(code),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        this.c.env.DB.prepare(
          `DELETE FROM application_workflows
           WHERE template_id NOT IN (SELECT id FROM application_templates)`,
        ),
      ])

      return true
    } catch (error) {
      if (isAbortedByGuard(error)) {
        return null
      }
      return error instanceof Error ? error : new Error("failed to delete application_template")
    }
  }
}
