import type { Partner } from "@/domain/partner/partner.entity"
import { canManagePartners } from "@/lib/partner/can-manage-partners"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import { PartnerRepository } from "@/infrastructure/partner/partner-repository"

export type Command = {
  session: SessionPayload
  id: number
  details: {
    name: string
    category: string | null
    corporateNumber: string | null
    note: string | null
  }
}

/**
 * 権限と存在を確認し、取引先の名称・分類・法人番号・備考を更新する。
 */
export class UpdatePartner {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Partner | ApplicationError> {
    const partnerRepository = new PartnerRepository(this.c)

    if (canManagePartners(command.session) === false) {
      return new ForbiddenError("cannot manage partners", "forbidden")
    }

    const partner = await partnerRepository.findById(command.id)

    if (partner instanceof Error) {
      return new UnexpectedError("failed to find partner", { cause: partner })
    }

    if (partner === null) {
      return new NotFoundError("partner not found", "partner_not_found")
    }

    const updated = await partnerRepository.update(partner.withDetails(command.details))

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update partner", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("partner not found", "partner_not_found")
    }

    return updated
  }
}
