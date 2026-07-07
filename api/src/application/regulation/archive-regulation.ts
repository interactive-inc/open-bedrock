import type { Regulation } from "@/domain/regulation/regulation.entity"
import type { Context, SessionPayload } from "@/env"
import { RegulationRepository } from "@/infrastructure/regulation/regulation-repository"
import { canManageRegulations } from "@/lib/regulation/can-manage-regulations"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  session: SessionPayload
  code: string
}

/**
 * 権限を確認し、規程をアーカイブする。版は残す。
 */
export class ArchiveRegulation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Regulation | ApplicationError> {
    const regulationRepository = new RegulationRepository(this.c)

    if (canManageRegulations(command.session) === false) {
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
