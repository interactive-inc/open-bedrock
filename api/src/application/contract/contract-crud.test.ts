import { describe, expect, test } from "bun:test"
import { Contract } from "@/domain/contract/contract.entity"
import { Partner } from "@/domain/partner/partner.entity"
import { RegisterPartner } from "@/application/partner/register-partner"
import { CreateContract } from "@/application/contract/create-contract"
import { UpdateContract } from "@/application/contract/update-contract"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { expectApplicationError } from "@/interface/shared/test/expect-application-error"
import { ForbiddenError, NotFoundError } from "@/lib/errors"
import type { Context } from "@/env"

async function seedPartner(context: Context): Promise<Partner> {
  const result = await new RegisterPartner(context).run({
    session: makeTestSession("admin"),
    partner: {
      code: "P0001",
      name: "Acme Supplies",
      category: "supplier",
      corporateNumber: null,
      note: null,
    },
    createdAt: "2026-01-01T00:00:00.000Z",
  })

  if (result instanceof Error || result.id === null) {
    throw new Error("seed partner failed")
  }

  return result
}

async function seedContract(context: Context, partnerId: number): Promise<Contract> {
  const result = await new CreateContract(context).run({
    session: makeTestSession("admin"),
    contract: {
      partnerId: partnerId,
      title: "Supply Agreement",
      contractDate: "2026-01-10",
      startsOn: "2026-02-01",
      endsOn: null,
      renewalDeadline: "2026-12-01",
      note: null,
    },
    createdAt: "2026-01-10T00:00:00.000Z",
  })

  if (result instanceof Error) {
    throw new Error("seed contract failed")
  }

  return result
}

describe("CreateContract", () => {
  test("creates a contract as admin", async () => {
    const { context } = createTestContext()

    const partner = await seedPartner(context)

    const result = await new CreateContract(context).run({
      session: makeTestSession("admin"),
      contract: {
        partnerId: partner.id ?? 0,
        title: "Supply Agreement",
        contractDate: "2026-01-10",
        startsOn: null,
        endsOn: null,
        renewalDeadline: null,
        note: null,
      },
      createdAt: "2026-01-10T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(Contract)

    if (result instanceof Error) {
      throw new Error("create failed")
    }

    expect(result.title).toBe("Supply Agreement")
    expect(result.partnerId).toBe(partner.id ?? 0)
    expect(result.id).not.toBeNull()
  })

  test("rejects member with forbidden", async () => {
    const { context } = createTestContext()

    const partner = await seedPartner(context)

    const result = await new CreateContract(context).run({
      session: makeTestSession("member"),
      contract: {
        partnerId: partner.id ?? 0,
        title: "Supply Agreement",
        contractDate: "2026-01-10",
        startsOn: null,
        endsOn: null,
        renewalDeadline: null,
        note: null,
      },
      createdAt: "2026-01-10T00:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects unknown partner with partner_not_found", async () => {
    const { context } = createTestContext()

    const result = await new CreateContract(context).run({
      session: makeTestSession("admin"),
      contract: {
        partnerId: 9999,
        title: "Ghost Contract",
        contractDate: "2026-01-10",
        startsOn: null,
        endsOn: null,
        renewalDeadline: null,
        note: null,
      },
      createdAt: "2026-01-10T00:00:00.000Z",
    })

    expectApplicationError(result, NotFoundError, "partner_not_found")
  })
})

describe("UpdateContract", () => {
  test("updates a contract as admin", async () => {
    const { context } = createTestContext()

    const partner = await seedPartner(context)

    const contract = await seedContract(context, partner.id ?? 0)

    if (contract.id === null) {
      throw new Error("id is null")
    }

    const result = await new UpdateContract(context).run({
      session: makeTestSession("admin"),
      id: contract.id,
      details: {
        title: "Amended Agreement",
        contractDate: "2026-01-15",
        startsOn: "2026-02-01",
        endsOn: "2027-01-31",
        renewalDeadline: "2026-11-30",
        note: "amended",
      },
    })

    expect(result).toBeInstanceOf(Contract)

    if (result instanceof Error) {
      throw new Error("update failed")
    }

    expect(result.title).toBe("Amended Agreement")
    expect(result.renewalDeadline).toBe("2026-11-30")
  })

  test("rejects member with forbidden", async () => {
    const { context } = createTestContext()

    const partner = await seedPartner(context)

    const contract = await seedContract(context, partner.id ?? 0)

    if (contract.id === null) {
      throw new Error("id is null")
    }

    const result = await new UpdateContract(context).run({
      session: makeTestSession("member"),
      id: contract.id,
      details: {
        title: "Hijacked",
        contractDate: "2026-01-15",
        startsOn: null,
        endsOn: null,
        renewalDeadline: null,
        note: null,
      },
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects unknown id with contract_not_found", async () => {
    const { context } = createTestContext()

    const result = await new UpdateContract(context).run({
      session: makeTestSession("admin"),
      id: 9999,
      details: {
        title: "Missing",
        contractDate: "2026-01-15",
        startsOn: null,
        endsOn: null,
        renewalDeadline: null,
        note: null,
      },
    })

    expectApplicationError(result, NotFoundError, "contract_not_found")
  })
})
