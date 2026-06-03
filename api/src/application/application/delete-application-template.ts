import { canManageApplicationTemplates } from "@/domain/application/can-manage-application-templates"
import type { Context } from "@/env"
import { ApplicationTemplateRepository } from "@/infrastructure/application/application-template-repository"

export type Command = {
  viewerRole: string
  code: string
}

export type Forbidden = { reason: "forbidden" }

export type TemplateNotFound = { reason: "template_not_found" }

export type Deleted = { reason: "deleted" }

export type DeleteFailure = Forbidden | TemplateNotFound

/**
 * 管理権限を持つ者が申請テンプレートを削除する。
 */
export class DeleteApplicationTemplate {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | DeleteFailure | Error> {
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

    const deleted = await templateRepository.delete(command.code)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "deleted" }
  }
}
