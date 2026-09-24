import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { PartnerRepository } from "@/contexts/partner/infrastructure/repositories/partner.repository"
import type { Partner } from "@/contexts/partner/domain/entities/partner.entity"

type Context = Readonly<{
  partnerRepository: Pick<PartnerRepository, "findById" | "update">
}>

export type Command = {
  session: CompanySessionValue
  id: number
}

export type Archived = { reason: "archived" }

/**
 * 管理権限を持つ者が取引先をアーカイブする。契約記録を壊さないため物理削除はしない。
 */
export class ArchivePartner {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Archived | ApplicationError> {
    if (command.session.hasPermission("partner:manage") === false) {
      return new ForbiddenError("cannot manage partners", "forbidden")
    }

    const current: Partner | null | Error = await this.c.partnerRepository.findById(command.id)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find partner", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("partner not found", "partner_not_found")
    }

    const updated = await this.c.partnerRepository.update(current.archive())

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update partner", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("partner not found", "partner_not_found")
    }

    return { reason: "archived" }
  }
}
