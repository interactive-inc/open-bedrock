import type { Session } from "@/lib/auth/session"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ApplicationTemplateRepository } from "@/infrastructure/application/application-template-repository"

export type Command = {
  session: Session
  code: string
}

export type Deleted = { reason: "deleted" }

/**
 * 管理権限を持つ者が申請テンプレートを削除する。
 * 参照する申請が存在するテンプレートは削除できない（状態を問わない。repository 側で
 * D1 batch によりアトミックに判定する）。
 */
export class DeleteApplicationTemplate {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | ApplicationError> {
    const templateRepository = new ApplicationTemplateRepository(this.c)

    if (command.session.hasPermission("application_template:manage") === false) {
      return new ForbiddenError("cannot manage application templates", "forbidden")
    }

    const current = await templateRepository.findByCode(command.code)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find application template", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("template not found", "template_not_found")
    }

    if (current.systemBinding !== null) {
      return new ConflictError("system template cannot be deleted", "system_template_locked")
    }

    // D1 batch で申請参照チェックと削除をアトミックに実行。
    // null = 参照する申請が存在するため削除不可（状態を問わない）。
    const deleted = await templateRepository.delete(command.code)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete application template", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError("template is in use by applications", "template_in_use")
    }

    return { reason: "deleted" }
  }
}
