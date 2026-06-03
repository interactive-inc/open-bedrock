import type { ApplicationTemplate } from "@/domain/application/application-template"
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

export type TemplateNotFound = { reason: "template_not_found" }

export type UpdateFailure = Forbidden | TemplateNotFound

/**
 * 管理権限を持つ者が申請テンプレートの内容を変更する。code は変更しない。
 */
export class UpdateApplicationTemplate {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ApplicationTemplate | UpdateFailure | Error> {
    const templateRepository = new ApplicationTemplateRepository(this.c)

    if (canManageApplicationTemplates(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const current = await templateRepository.findByCode(command.code)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "template_not_found" }
    }

    const updated = await templateRepository.update(
      current.withDetails({
        name: command.name,
        category: command.category,
        description: command.description,
        schemaJson: command.schemaJson,
        approverRoles: command.approverRoles,
      }),
    )

    if (updated instanceof Error) {
      return updated
    }

    return updated
  }
}
