import { canManagePartners } from "@/lib/partner/can-manage-partners"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import { PartnerRepository } from "@/infrastructure/partner/partner-repository"

export type Command = {
  session: SessionPayload
  id: number
}

export type Archived = { reason: "archived" }

/**
 * 管理権限を持つ者が取引先をアーカイブする。契約記録を壊さないため物理削除はしない。
 */
export class ArchivePartner {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Archived | ApplicationError> {
    const partnerRepository = new PartnerRepository(this.c)

    if (canManagePartners(command.session) === false) {
      return new ForbiddenError("cannot manage partners", "forbidden")
    }

    const current = await partnerRepository.findById(command.id)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find partner", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("partner not found", "partner_not_found")
    }

    const updated = await partnerRepository.update(current.archive())

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update partner", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("partner not found", "partner_not_found")
    }

    return { reason: "archived" }
  }
}
