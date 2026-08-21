import { OnboardingTemplate } from "@/contexts/onboarding/domain/entities/onboarding-template.entity"
import { OnboardingTemplateTask } from "@/contexts/onboarding/domain/entities/onboarding-template-task.entity"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/lib/d1/is-unique-constraint-error"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"
import { UniqueConstraintError } from "@/lib/d1/unique-constraint-error"
import {
  onboardingTemplates,
  onboardingTemplateTasks,
} from "@/contexts/onboarding/infrastructure/schema/onboarding"
import { asc, eq } from "drizzle-orm"

export class OnboardingTemplateRepository {
  constructor(private readonly c: Context) {}

  async findByCode(code: string): Promise<OnboardingTemplate | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(onboardingTemplates)
        .where(eq(onboardingTemplates.code, code))
        .limit(1)

      const row = rows.at(0)

      if (row === undefined) {
        return null
      }

      const tasks = await this.findTasksByCode(row.code)

      if (tasks instanceof Error) {
        return tasks
      }

      return OnboardingTemplate.fromRow(row, tasks)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load onboarding_template")
    }
  }

  async create(template: OnboardingTemplate): Promise<OnboardingTemplate | Error> {
    try {
      const rows = await this.c.var.database
        .insert(onboardingTemplates)
        .values({
          code: template.code,
          name: template.name,
          kind: template.kind,
          description: template.description,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert onboarding_template")
        : OnboardingTemplate.fromRow(row, [])
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("onboarding template code already exists", {
          cause: error,
        })
      }
      return error instanceof Error ? error : new Error("failed to insert onboarding_template")
    }
  }

  /** テンプレートの名称・種別・説明を更新する。code をキーに更新し、更新後の行を tasks 付きで返す。 */
  async update(template: OnboardingTemplate): Promise<OnboardingTemplate | null | Error> {
    try {
      const code = await this.c.env.DB.prepare(
        `UPDATE onboarding_templates
         SET name = ?2, kind = ?3, description = ?4
         WHERE code = ?1
           AND (
             kind = ?3 OR NOT EXISTS (
               SELECT 1 FROM lifecycle_effect_template_bindings
               WHERE template_code = ?1
             )
           )
         RETURNING code`,
      )
        .bind(template.code, template.name, template.kind, template.description)
        .first<string>("code")

      return code === null ? null : await this.findByCode(code)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update onboarding_template")
    }
  }

  /**
   * テンプレートを削除する。紐づくタスク定義も合わせて削除する。
   * アクティブ（in_progress）な割り当てが存在する場合は削除せず null を返す（TOCTOU 競合を防ぐ）。
   */
  async delete(code: string): Promise<true | null | Error> {
    try {
      const db = this.c.env.DB
      await db.batch([
        db.prepare("DELETE FROM onboarding_template_tasks WHERE template_code = ?1").bind(code),
        db
          .prepare(
            `DELETE FROM onboarding_templates
             WHERE code = ?1
               AND NOT EXISTS (
                 SELECT 1 FROM onboarding_assignments
                 WHERE template_code = ?1 AND status = 'in_progress'
               )
               AND NOT EXISTS (
                 SELECT 1 FROM lifecycle_effect_template_bindings
                 WHERE template_code = ?1
               )`,
          )
          .bind(code),
        abortWhenPreviousStatementChangedNoRows(db),
      ])

      return true
    } catch (error) {
      if (isAbortedByGuard(error)) {
        return null
      }
      return error instanceof Error ? error : new Error("failed to delete onboarding_template")
    }
  }

  async saveLifecycleBinding(props: {
    effectType: "hire" | "retired"
    templateCode: string
    expectedKind: "join" | "leave"
    updatedAt: number
    updatedByAccountId: string
  }): Promise<boolean | Error> {
    try {
      const saved = await this.c.env.DB.prepare(
        `INSERT INTO lifecycle_effect_template_bindings
           (effect_type, template_code, updated_at, updated_by_account_id)
         SELECT ?1, ?2, ?3, ?4
         FROM onboarding_templates
         WHERE code = ?2 AND kind = ?5
         ON CONFLICT(effect_type) DO UPDATE SET
           template_code = excluded.template_code,
           updated_at = excluded.updated_at,
           updated_by_account_id = excluded.updated_by_account_id
         RETURNING effect_type`,
      )
        .bind(
          props.effectType,
          props.templateCode,
          props.updatedAt,
          props.updatedByAccountId,
          props.expectedKind,
        )
        .first<string>("effect_type")

      return saved !== null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to save lifecycle template binding")
    }
  }

  async removeLifecycleBinding(templateCode: string): Promise<boolean | Error> {
    try {
      const removed = await this.c.env.DB.prepare(
        `DELETE FROM lifecycle_effect_template_bindings
         WHERE template_code = ?1
         RETURNING effect_type`,
      )
        .bind(templateCode)
        .first<string>("effect_type")

      return removed !== null
    } catch (error) {
      return error instanceof Error
        ? error
        : new Error("failed to remove lifecycle template binding")
    }
  }

  private async findTasksByCode(
    templateCode: string,
  ): Promise<ReadonlyArray<OnboardingTemplateTask> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(onboardingTemplateTasks)
        .where(eq(onboardingTemplateTasks.templateCode, templateCode))
        .orderBy(asc(onboardingTemplateTasks.sortOrder))

      return rows.map((row) => OnboardingTemplateTask.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load onboarding_template_tasks")
    }
  }
}
