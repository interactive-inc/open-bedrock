import type { ApplicationTemplate } from "@/domain/application/application-template.entity"
import { canManageApplicationTemplates } from "@/lib/application/can-manage-application-templates"
import type { Context, SessionPayload } from "@/env"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ApplicationTemplateRepository } from "@/infrastructure/application/application-template-repository"

export type Command = {
  session: SessionPayload
  code: string
  name: string
  category: string
  description: string | null
  schemaJson: unknown
  approverRoles: ReadonlyArray<string>
}

/**
 * 管理権限を持つ者が申請テンプレートの内容を変更する。code は変更しない。
 */
export class UpdateApplicationTemplate {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ApplicationTemplate | ApplicationError> {
    const templateRepository = new ApplicationTemplateRepository(this.c)

    if (canManageApplicationTemplates(command.session) === false) {
      return new ForbiddenError("cannot manage application templates", "forbidden")
    }

    const current = await templateRepository.findByCode(command.code)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find application template", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("template not found", "template_not_found")
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
      return new UnexpectedError("failed to update application template", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("template not found", "template_not_found")
    }

    return updated
  }
}
