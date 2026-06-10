import { OnboardingTemplate } from "@/domain/onboarding/onboarding-template"
import { OnboardingTemplateTask } from "@/domain/onboarding/onboarding-template-task"
import type { Context } from "@/env"
import { onboardingTemplates, onboardingTemplateTasks } from "@/schema"
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
      return error instanceof Error ? error : new Error("failed to insert onboarding_template")
    }
  }

  // テンプレートの名称・種別・説明を更新する。code をキーに更新し、更新後の行を tasks 付きで返す。
  async update(template: OnboardingTemplate): Promise<OnboardingTemplate | Error> {
    try {
      const rows = await this.c.var.database
        .update(onboardingTemplates)
        .set({
          name: template.name,
          kind: template.kind,
          description: template.description,
        })
        .where(eq(onboardingTemplates.code, template.code))
        .returning()

      const row = rows.at(0)

      if (row === undefined) {
        return new Error("failed to update onboarding_template")
      }

      const tasks = await this.findTasksByCode(row.code)

      if (tasks instanceof Error) {
        return tasks
      }

      return OnboardingTemplate.fromRow(row, tasks)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update onboarding_template")
    }
  }

  // テンプレートを削除する。紐づくタスク定義も合わせて削除する。
  async delete(code: string): Promise<null | Error> {
    try {
      await this.c.var.database.batch([
        this.c.var.database
          .delete(onboardingTemplateTasks)
          .where(eq(onboardingTemplateTasks.templateCode, code)),
        this.c.var.database.delete(onboardingTemplates).where(eq(onboardingTemplates.code, code)),
      ])

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete onboarding_template")
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
