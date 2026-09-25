import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { Partner } from "@/contexts/partner/domain/entities/partner.entity"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { PartnerRepository } from "@/contexts/partner/infrastructure/repositories/partner.repository"

type Context = Readonly<{
  partnerRepository: Pick<PartnerRepository, "findById" | "update">
}>

export type Command = {
  session: CompanySessionValue
  id: string
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
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Partner | ApplicationError> {
    if (command.session.hasPermission("partner:manage") === false) {
      return new ForbiddenError("cannot manage partners", "forbidden")
    }

    const partner = await this.c.partnerRepository.findById(command.id)

    if (partner instanceof Error) {
      return new UnexpectedError("failed to find partner", { cause: partner })
    }

    if (partner === null) {
      return new NotFoundError("partner not found", "partner_not_found")
    }

    const updated = await this.c.partnerRepository.update(partner.withDetails(command.details))

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update partner", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("partner not found", "partner_not_found")
    }

    return updated
  }
}
