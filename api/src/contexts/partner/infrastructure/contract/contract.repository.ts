import { Contract } from "@/contexts/partner/domain/contract/contract.entity"
import type { Context } from "@/env"
import { contracts } from "@/contexts/partner/infrastructure/schema/partner"
import { eq } from "drizzle-orm"

export class ContractRepository {
  constructor(private readonly c: Context) {}

  async findById(id: number): Promise<Contract | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(contracts)
        .where(eq(contracts.id, id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Contract.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load contract")
    }
  }

  async create(contract: Contract): Promise<Contract | Error> {
    try {
      const rows = await this.c.var.database
        .insert(contracts)
        .values({
          partnerId: contract.partnerId,
          title: contract.title,
          contractDate: contract.contractDate,
          startsOn: contract.startsOn,
          endsOn: contract.endsOn,
          renewalDeadline: contract.renewalDeadline,
          note: contract.note,
          createdAt: contract.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined ? new Error("failed to insert contract") : Contract.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert contract")
    }
  }

  async update(contract: Contract): Promise<Contract | null | Error> {
    try {
      if (contract.id === null) {
        return new Error("cannot update unsaved contract")
      }

      const rows = await this.c.var.database
        .update(contracts)
        .set({
          title: contract.title,
          contractDate: contract.contractDate,
          startsOn: contract.startsOn,
          endsOn: contract.endsOn,
          renewalDeadline: contract.renewalDeadline,
          note: contract.note,
        })
        .where(eq(contracts.id, contract.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Contract.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update contract")
    }
  }
}
