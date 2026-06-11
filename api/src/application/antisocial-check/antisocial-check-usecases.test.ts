import { describe, expect, test } from "bun:test"
import { CancelAntisocialCheck } from "@/application/antisocial-check/cancel-antisocial-check"
import { CreateAntisocialCheck } from "@/application/antisocial-check/create-antisocial-check"
import { GetAntisocialCheck } from "@/application/antisocial-check/get-antisocial-check"
import { ListMyAntisocialChecks } from "@/application/antisocial-check/list-my-antisocial-checks"
import { UpdateAntisocialCheck } from "@/application/antisocial-check/update-antisocial-check"
import { AntisocialCheck } from "@/domain/antisocial-check/antisocial-check"
import type { Context } from "@/env"
import { createTestContext } from "@/interface/shared/test/create-test-context"

async function seedCheck(context: Context, requesterId: number): Promise<string> {
  const created = await new CreateAntisocialCheck(context).run({
    requesterId: requesterId,
    partnerName: "Example Trading Co.",
    partnerAddress: "1-2-3 Sample, Example City",
    representativeName: "Pat Example",
    createdAt: "2026-01-01T00:00:00.000Z",
  })

  if (created instanceof Error) {
    throw new Error("seed failed")
  }

  return created.id
}

describe("CreateAntisocialCheck", () => {
  test("creates an antisocial check with status requested and null result", async () => {
    const { context } = createTestContext()

    const created = await new CreateAntisocialCheck(context).run({
      requesterId: 2,
      partnerName: "Sample Logistics Inc.",
      partnerAddress: null,
      representativeName: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(created).toBeInstanceOf(AntisocialCheck)

    if (created instanceof Error) {
      throw new Error("create failed")
    }

    expect(created.status).toBe("requested")
    expect(created.result).toBe(null)
    expect(created.partnerAddress).toBe(null)
  })
})

describe("GetAntisocialCheck", () => {
  test("returns the check for its requester", async () => {
    const { context } = createTestContext()

    const checkId = await seedCheck(context, 5)

    const result = await new GetAntisocialCheck(context).run({
      antisocialCheckId: checkId,
      requesterId: 5,
    })

    expect(result).toBeInstanceOf(AntisocialCheck)
  })

  test("rejects a non requester with not_requester", async () => {
    const { context } = createTestContext()

    const checkId = await seedCheck(context, 5)

    const result = await new GetAntisocialCheck(context).run({
      antisocialCheckId: checkId,
      requesterId: 6,
    })

    expect(result).toEqual({ reason: "not_requester" })
  })

  test("returns antisocial_check_not_found for an unknown id", async () => {
    const { context } = createTestContext()

    const result = await new GetAntisocialCheck(context).run({
      antisocialCheckId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
      requesterId: 5,
    })

    expect(result).toEqual({ reason: "antisocial_check_not_found" })
  })
})

describe("ListMyAntisocialChecks", () => {
  test("returns only the requester's checks", async () => {
    const { context } = createTestContext()

    await seedCheck(context, 5)

    await seedCheck(context, 6)

    const result = await new ListMyAntisocialChecks(context).run({ requesterId: 5, limit: 50, offset: 0 })

    if (result instanceof Error) {
      throw new Error("list failed")
    }

    expect(result.length).toBe(1)
    expect(result[0].requesterId).toBe(5)
  })
})

describe("UpdateAntisocialCheck", () => {
  test("updates the details and result for the requester", async () => {
    const { context } = createTestContext()

    const checkId = await seedCheck(context, 5)

    const result = await new UpdateAntisocialCheck(context).run({
      antisocialCheckId: checkId,
      requesterId: 5,
      partnerName: "Demo Partners LLC",
      partnerAddress: "4-5-6 Placeholder, Example City",
      representativeName: "Alex Sample",
      result: "clear",
    })

    expect(result).toBeInstanceOf(AntisocialCheck)

    if (result instanceof Error || "reason" in result) {
      throw new Error("update failed")
    }

    expect(result.partnerName).toBe("Demo Partners LLC")
    expect(result.result).toBe("clear")
  })

  test("rejects a non requester with not_requester", async () => {
    const { context } = createTestContext()

    const checkId = await seedCheck(context, 5)

    const result = await new UpdateAntisocialCheck(context).run({
      antisocialCheckId: checkId,
      requesterId: 6,
      partnerName: "Demo Partners LLC",
      partnerAddress: null,
      representativeName: null,
      result: null,
    })

    expect(result).toEqual({ reason: "not_requester" })
  })
})

describe("CancelAntisocialCheck", () => {
  test("cancels the check for the requester", async () => {
    const { context } = createTestContext()

    const checkId = await seedCheck(context, 5)

    const result = await new CancelAntisocialCheck(context).run({
      antisocialCheckId: checkId,
      requesterId: 5,
    })

    expect(result).toEqual({ reason: "cancelled" })
  })

  test("rejects a non requester with not_requester", async () => {
    const { context } = createTestContext()

    const checkId = await seedCheck(context, 5)

    const result = await new CancelAntisocialCheck(context).run({
      antisocialCheckId: checkId,
      requesterId: 6,
    })

    expect(result).toEqual({ reason: "not_requester" })
  })
})
