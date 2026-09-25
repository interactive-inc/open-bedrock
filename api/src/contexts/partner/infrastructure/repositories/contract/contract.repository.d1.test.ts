import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { Contract } from "@/contexts/partner/domain/entities/contract.entity"
import { Partner } from "@/contexts/partner/domain/entities/partner.entity"
import { ContractRepository } from "@/contexts/partner/infrastructure/repositories/contract/contract.repository"
import { PartnerRepository } from "@/contexts/partner/infrastructure/repositories/partner.repository"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({ migrated: ["contract"] })
})

afterAll(async () => {
  await local.dispose()
})

describe("ContractRepository on local D1", () => {
  test("creates a contract for an existing partner and persists updates", async () => {
    const { context } = await createLocalD1Context(local, "contract")

    const partner = await new PartnerRepository(context).create(
      Partner.create({
        code: "P0001",
        name: "Acme Supplies",
        category: "supplier",
        corporateNumber: null,
        note: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    if (partner instanceof Error || partner.id === null) throw new Error("seed partner failed")

    const repository = new ContractRepository(context)

    const created = await repository.create(
      Contract.create({
        partnerId: partner.id,
        title: "Supply Agreement",
        contractDate: "2026-01-10",
        startsOn: "2026-02-01",
        endsOn: null,
        renewalDeadline: "2026-12-01",
        note: null,
        createdAt: "2026-01-10T00:00:00.000Z",
      }),
    )

    if (created instanceof Error || created.id === null) throw new Error("create failed")

    expect(created.partnerId).toBe(partner.id)

    const updated = await repository.update(
      created.withDetails({
        title: "Amended Agreement",
        contractDate: "2026-01-15",
        startsOn: "2026-02-01",
        endsOn: "2027-01-31",
        renewalDeadline: "2026-11-30",
        note: "amended",
      }),
    )

    expect(updated).toBeInstanceOf(Contract)

    const reloaded = await repository.findById(created.id)

    if (!(reloaded instanceof Contract)) throw new Error("reload failed")

    expect(reloaded.title).toBe("Amended Agreement")
    expect(reloaded.renewalDeadline).toBe("2026-11-30")
    expect(await repository.findById("0190001e-0000-7000-8000-00000000270f")).toBeNull()
  })
})
