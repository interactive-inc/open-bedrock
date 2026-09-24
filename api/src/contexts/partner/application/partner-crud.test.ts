import { describe, expect, test } from "bun:test"
import { Partner } from "@/contexts/partner/domain/entities/partner.entity"
import { RegisterPartner } from "@/contexts/partner/application/register-partner"
import { UpdatePartner } from "@/contexts/partner/application/update-partner"
import { ArchivePartner } from "@/contexts/partner/application/archive-partner"
import {
  createFakeContractRepository,
  createFakePartnerRepository,
} from "@/contexts/partner/test/partner-repository-fakes.test-support"
import { makeTestSession } from "@tests/api/support/make-test-session"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors"
import { UniqueConstraintError } from "@/lib/d1/errors"

type PartnerTestContext = ReturnType<typeof createPartnerTestContext>

/** 取引先と契約のRepositoryを型付きfakeにして、DBなしで業務判断を検証する。 */
function createPartnerTestContext() {
  return {
    partnerRepository: createFakePartnerRepository(),
    contractRepository: createFakeContractRepository(),
  }
}

async function seedPartner(context: PartnerTestContext, code: string): Promise<Partner> {
  const result = await new RegisterPartner(context).run({
    session: makeTestSession("root"),
    partner: {
      code: code,
      name: "Test Partner",
      category: "supplier",
      corporateNumber: null,
      note: null,
    },
    createdAt: "2026-01-01T00:00:00.000Z",
  })

  if (result instanceof Error) {
    throw new Error("seed partner failed")
  }

  return result
}

describe("RegisterPartner", () => {
  test("creates a partner as admin", async () => {
    const context = createPartnerTestContext()

    const result = await new RegisterPartner(context).run({
      session: makeTestSession("root"),
      partner: {
        code: "P0001",
        name: "Acme Supplies",
        category: "supplier",
        corporateNumber: "1234567890123",
        note: null,
      },
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(Partner)

    if (result instanceof Error) {
      throw new Error("create failed")
    }

    expect(result.code).toBe("P0001")
    expect(result.status).toBe("active")
    expect(result.id).not.toBeNull()
  })

  test("rejects member with forbidden", async () => {
    const context = createPartnerTestContext()

    const result = await new RegisterPartner(context).run({
      session: makeTestSession("member"),
      partner: {
        code: "P0001",
        name: "Acme Supplies",
        category: null,
        corporateNumber: null,
        note: null,
      },
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects duplicate code with partner_code_conflict", async () => {
    const context = createPartnerTestContext()

    await seedPartner(context, "P0001")

    const result = await new RegisterPartner(context).run({
      session: makeTestSession("root"),
      partner: {
        code: "P0001",
        name: "Another Partner",
        category: null,
        corporateNumber: null,
        note: null,
      },
      createdAt: "2026-01-02T00:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "partner_code_conflict")
  })

  test("maps a unique constraint race on create to partner_code_conflict", async () => {
    const context = createPartnerTestContext()

    const result = await new RegisterPartner({
      partnerRepository: {
        ...context.partnerRepository,
        create: async () => new UniqueConstraintError("partner code already exists"),
      },
    }).run({
      session: makeTestSession("root"),
      partner: { code: "P0001", name: "Racing", category: null, corporateNumber: null, note: null },
      createdAt: "2026-01-02T00:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "partner_code_conflict")
  })
})

describe("UpdatePartner", () => {
  test("updates a partner as admin", async () => {
    const context = createPartnerTestContext()

    const partner = await seedPartner(context, "P0001")

    if (partner.id === null) {
      throw new Error("id is null")
    }

    const result = await new UpdatePartner(context).run({
      session: makeTestSession("root"),
      id: partner.id,
      details: {
        name: "Renamed Partner",
        category: "customer",
        corporateNumber: "9999999999999",
        note: "updated",
      },
    })

    expect(result).toBeInstanceOf(Partner)

    if (result instanceof Error) {
      throw new Error("update failed")
    }

    expect(result.name).toBe("Renamed Partner")
    expect(result.category).toBe("customer")
    expect(result.corporateNumber).toBe("9999999999999")
  })

  test("rejects member with forbidden", async () => {
    const context = createPartnerTestContext()

    const partner = await seedPartner(context, "P0001")

    if (partner.id === null) {
      throw new Error("id is null")
    }

    const result = await new UpdatePartner(context).run({
      session: makeTestSession("member"),
      id: partner.id,
      details: { name: "Hijacked", category: null, corporateNumber: null, note: null },
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects unknown id with partner_not_found", async () => {
    const context = createPartnerTestContext()

    const result = await new UpdatePartner(context).run({
      session: makeTestSession("root"),
      id: 9999,
      details: { name: "Missing", category: null, corporateNumber: null, note: null },
    })

    expectApplicationError(result, NotFoundError, "partner_not_found")
  })
})

describe("ArchivePartner", () => {
  test("archives a partner as admin", async () => {
    const context = createPartnerTestContext()

    const partner = await seedPartner(context, "P0001")

    if (partner.id === null) {
      throw new Error("id is null")
    }

    const result = await new ArchivePartner(context).run({
      session: makeTestSession("root"),
      id: partner.id,
    })

    expect(result).toEqual({ reason: "archived" })
  })

  test("rejects member with forbidden", async () => {
    const context = createPartnerTestContext()

    const partner = await seedPartner(context, "P0001")

    if (partner.id === null) {
      throw new Error("id is null")
    }

    const result = await new ArchivePartner(context).run({
      session: makeTestSession("member"),
      id: partner.id,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects unknown id with partner_not_found", async () => {
    const context = createPartnerTestContext()

    const result = await new ArchivePartner(context).run({
      session: makeTestSession("root"),
      id: 9999,
    })

    expectApplicationError(result, NotFoundError, "partner_not_found")
  })
})
