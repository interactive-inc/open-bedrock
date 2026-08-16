import type { Session } from "@/contexts/company/domain/iam/session"
import type { Regulation } from "@/contexts/regulation/domain/regulation.entity"
import type { Context } from "@/env"
import { RegulationRepository } from "@/contexts/regulation/infrastructure/regulation-repository"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  session: Session
  code: string
}

/**
 * 権限を確認し、規程をアーカイブする。版は残す。
 */
export class ArchiveRegulation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Regulation | ApplicationError> {
    const regulationRepository = new RegulationRepository(this.c)

    if (command.session.hasPermission("regulation:manage") === false) {
      return new ForbiddenError("cannot manage regulations", "forbidden")
    }

    const regulation = await regulationRepository.findByCode(command.code)

    if (regulation instanceof Error) {
      return new UnexpectedError("failed to find regulation", { cause: regulation })
    }

    if (regulation === null) {
      return new NotFoundError("regulation not found", "regulation_not_found")
    }

    const result = await regulationRepository.updateStatus(regulation.archive())

    if (result instanceof Error) {
      return new UnexpectedError("failed to archive regulation", { cause: result })
    }

    if (result === null) {
      return new NotFoundError("regulation not found", "regulation_not_found")
    }

    return result
  }
}
