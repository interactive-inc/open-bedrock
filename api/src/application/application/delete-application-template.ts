import { canManageApplicationTemplates } from "@/lib/application/can-manage-application-templates"
import type { Context, SessionPayload } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ApplicationTemplateRepository } from "@/infrastructure/application/application-template-repository"

export type Command = {
  session: SessionPayload
  code: string
}

export type Deleted = { reason: "deleted" }

/**
 * 管理権限を持つ者が申請テンプレートを削除する。
 * pending 申請が存在するテンプレートは削除できない（repository 側で
 * D1 batch によりアトミックに判定する）。
 */
export class DeleteApplicationTemplate {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | ApplicationError> {
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

    // D1 batch で pending 申請チェックと削除をアトミックに実行。
    // null = pending 申請が存在するため削除不可。
    const deleted = await templateRepository.delete(command.code)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete application template", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError("template is in use by pending applications", "template_in_use")
    }

    return { reason: "deleted" }
  }
}
