import { Contract } from "@/domain/contract/contract.entity"
import { canManageContracts } from "@/lib/contract/can-manage-contracts"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import { ContractRepository } from "@/infrastructure/contract/contract-repository"
import { PartnerRepository } from "@/infrastructure/partner/partner-repository"

export type Command = {
  session: SessionPayload
  contract: {
    partnerId: number
    title: string
    contractDate: string
    startsOn: string | null
    endsOn: string | null
    renewalDeadline: string | null
    note: string | null
  }
  createdAt: string
}

/**
 * 権限と親取引先の存在を確認し、契約記録を新規作成する。
 */
export class CreateContract {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Contract | ApplicationError> {
    if (canManageContracts(command.session) === false) {
      return new ForbiddenError("cannot manage contracts", "forbidden")
    }

    const partner = await new PartnerRepository(this.c).findById(command.contract.partnerId)

    if (partner instanceof Error) {
      return new UnexpectedError("failed to find partner", { cause: partner })
    }

    if (partner === null) {
      return new NotFoundError("partner not found", "partner_not_found")
    }

    const contract = Contract.create({
      partnerId: command.contract.partnerId,
      title: command.contract.title,
      contractDate: command.contract.contractDate,
      startsOn: command.contract.startsOn,
      endsOn: command.contract.endsOn,
      renewalDeadline: command.contract.renewalDeadline,
      note: command.contract.note,
      createdAt: command.createdAt,
    })

    const created = await new ContractRepository(this.c).create(contract)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create contract", { cause: created })
    }

    return created
  }
}
