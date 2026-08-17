import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import type { Contract } from "@/contexts/partner/domain/contract/contract.entity"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { ContractRepository } from "@/contexts/partner/infrastructure/contract/contract-repository"

export type Command = {
  session: Session
  id: number
  details: {
    title: string
    contractDate: string
    startsOn: string | null
    endsOn: string | null
    renewalDeadline: string | null
    note: string | null
  }
}

/**
 * 権限と存在を確認し、契約記録の表題・契約日・期間・更新期限・備考を更新する。
 */
export class UpdateContract {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Contract | ApplicationError> {
    const contractRepository = new ContractRepository(this.c)

    if (command.session.hasPermission("contract:manage") === false) {
      return new ForbiddenError("cannot manage contracts", "forbidden")
    }

    const contract = await contractRepository.findById(command.id)

    if (contract instanceof Error) {
      return new UnexpectedError("failed to find contract", { cause: contract })
    }

    if (contract === null) {
      return new NotFoundError("contract not found", "contract_not_found")
    }

    const updated = await contractRepository.update(contract.withDetails(command.details))

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update contract", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("contract not found", "contract_not_found")
    }

    return updated
  }
}
