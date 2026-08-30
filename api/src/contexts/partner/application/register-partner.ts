import type { Session } from "@/lib/auth/session"
import { Partner } from "@/contexts/partner/domain/entities/partner.entity"
import { ConflictError, ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { PartnerRepository } from "@/contexts/partner/infrastructure/repositories/partner.repository"
import { UniqueConstraintError } from "@/lib/d1/errors"

export type Command = {
  session: Session
  partner: {
    code: string
    name: string
    category: string | null
    corporateNumber: string | null
    note: string | null
  }
  createdAt: string
}

/**
 * 権限と重複コードを確認し、新しい取引先を active 状態で登録する。
 */
export class RegisterPartner {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Partner | ApplicationError> {
    const partnerRepository = new PartnerRepository(this.c)

    if (command.session.hasPermission("partner:manage") === false) {
      return new ForbiddenError("cannot manage partners", "forbidden")
    }

    const existing = await partnerRepository.findByCode(command.partner.code)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find partner", { cause: existing })
    }

    if (existing !== null) {
      return new ConflictError("partner code already exists", "partner_code_conflict")
    }

    const partner = Partner.create({
      code: command.partner.code,
      name: command.partner.name,
      category: command.partner.category,
      corporateNumber: command.partner.corporateNumber,
      note: command.partner.note,
      createdAt: command.createdAt,
    })

    const created = await partnerRepository.create(partner)

    // findByCode と insert の間に並行リクエストが挿入されると UNIQUE 制約違反になる。
    // リポジトリが UniqueConstraintError として返すので、重複として扱う（TOCTOU 競合対策）。
    if (created instanceof UniqueConstraintError) {
      return new ConflictError("partner code already exists", "partner_code_conflict")
    }

    if (created instanceof Error) {
      return new UnexpectedError("failed to create partner", { cause: created })
    }

    return created
  }
}
