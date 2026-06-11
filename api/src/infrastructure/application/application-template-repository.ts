import { ApplicationTemplate } from "@/domain/application/application-template"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/infrastructure/shared/is-unique-constraint-error"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
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
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("application_template unique constraint violated", {
          cause: error,
        })
      }

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

  // pending 申請が存在しない場合のみテンプレートを削除する。
  // D1 batch でチェックと削除をアトミックに実行し TOCTOU を防ぐ。
  // 0 行削除（pending 申請が存在）なら null を返す。
  async delete(code: string): Promise<true | null | Error> {
    try {
      await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          `DELETE FROM application_templates
           WHERE code = ?1
             AND NOT EXISTS (
               SELECT 1 FROM applications
               WHERE template_id = (SELECT id FROM application_templates WHERE code = ?1)
                 AND status = 'pending'
             )`,
        ).bind(code),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
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

function abortWhenPreviousStatementChangedNoRows(db: D1Database): D1PreparedStatement {
  return db.prepare("SELECT CASE WHEN changes() = 0 THEN json_extract('', '$') ELSE 1 END AS ok")
}

// ガード文（abortWhenPreviousStatementChangedNoRows）の json_extract('', '$') による
// 意図的な abort かを判定する。これ以外の batch 失敗は本物の DB エラーとして伝播させる。
function isAbortedByGuard(error: unknown): boolean {
  return error instanceof Error && error.message.includes("malformed JSON")
}
