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
