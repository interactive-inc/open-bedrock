import { ApplicationTemplate } from "@/domain/application/application-template"
import { canManageApplicationTemplates } from "@/domain/application/can-manage-application-templates"
import type { Context } from "@/env"
import { ApplicationTemplateRepository } from "@/infrastructure/application/application-template-repository"

export type Command = {
  viewerRole: string
  code: string
  name: string
  category: string
  description: string | null
  schemaJson: unknown
  approverRoles: ReadonlyArray<string>
}

export type Forbidden = { reason: "forbidden" }

export type TemplateCodeConflict = { reason: "template_code_conflict" }

/**
 * 管理権限を持つ者が新しい申請テンプレートを作成する。
 */
export class CreateApplicationTemplate {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<ApplicationTemplate | Forbidden | TemplateCodeConflict | Error> {
    const templateRepository = new ApplicationTemplateRepository(this.c)

    if (canManageApplicationTemplates(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const existing = await templateRepository.findByCode(command.code)

    if (existing instanceof Error) {
      return existing
    }

    if (existing !== null) {
      return { reason: "template_code_conflict" }
    }

    const template = ApplicationTemplate.create({
      code: command.code,
      name: command.name,
      category: command.category,
      description: command.description,
      schemaJson: command.schemaJson,
      approverRoles: command.approverRoles,
    })

    return templateRepository.create(template)
  }
}
