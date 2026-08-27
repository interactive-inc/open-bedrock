import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { CreateAntisocialCheck } from "@/contexts/antisocial-check/application/create-antisocial-check"
import { UpdateAntisocialCheck } from "@/contexts/antisocial-check/application/update-antisocial-check"
import { AntisocialCheck } from "@/contexts/antisocial-check/domain/entities/antisocial-check.entity"
import type { Context } from "@/env"
import { ApplicationError, ForbiddenError } from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { createTestContext } from "@tests/api/support/create-test-context"
import { makeTestSession } from "@tests/api/support/make-test-session"

async function seedCheck(context: Context, requesterId: number): Promise<string> {
  const created = await new CreateAntisocialCheck(context).run({
    requesterId: toWorkforceEmployeeId(requesterId),
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
    const { context } = await createTestContext()

    const created = await new CreateAntisocialCheck(context).run({
      requesterId: toWorkforceEmployeeId(2),
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

describe("GetAntisocialCheck", () => {})

describe("ListMyAntisocialChecks", () => {})

describe("UpdateAntisocialCheck", () => {
  test("allows a manager to complete another request without changing its details", async () => {
    const { context } = await createTestContext()

    const checkId = await seedCheck(context, 5)

    const result = await new UpdateAntisocialCheck(context).run({
      antisocialCheckId: checkId,
      session: makeTestSession("manager", 6),
      partnerName: "Example Trading Co.",
      partnerAddress: "1-2-3 Sample, Example City",
      representativeName: "Pat Example",
      result: "clear",
    })

    expect(result).toBeInstanceOf(AntisocialCheck)

    if (result instanceof ApplicationError) {
      throw new Error("update failed")
    }

    expect(result.partnerName).toBe("Example Trading Co.")
    expect(result.result).toBe("clear")
    expect(result.status).toBe("completed")
  })

  test("allows a non-manager requester to update details but ignores result", async () => {
    const { context } = await createTestContext()

    const checkId = await seedCheck(context, 5)

    const result = await new UpdateAntisocialCheck(context).run({
      antisocialCheckId: checkId,
      session: makeTestSession("member", 5),
      partnerName: "Demo Partners LLC",
      partnerAddress: "4-5-6 Placeholder, Example City",
      representativeName: "Alex Sample",
      result: null,
    })

    expect(result).toBeInstanceOf(AntisocialCheck)

    if (result instanceof ApplicationError) {
      throw new Error("update failed")
    }

    expect(result.partnerName).toBe("Demo Partners LLC")
    expect(result.result).toBe(null)
  })

  test("rejects result change from a non-manager requester with result_forbidden", async () => {
    const { context } = await createTestContext()

    const checkId = await seedCheck(context, 5)

    const result = await new UpdateAntisocialCheck(context).run({
      antisocialCheckId: checkId,
      session: makeTestSession("member", 5),
      partnerName: "Demo Partners LLC",
      partnerAddress: null,
      representativeName: null,
      result: "clear",
    })

    expectApplicationError(result, ForbiddenError, "result_forbidden")
  })

  test("rejects a manager deciding their own request", async () => {
    const { context } = await createTestContext()

    const checkId = await seedCheck(context, 5)

    const result = await new UpdateAntisocialCheck(context).run({
      antisocialCheckId: checkId,
      session: makeTestSession("manager", 5),
      partnerName: "Example Trading Co.",
      partnerAddress: "1-2-3 Sample, Example City",
      representativeName: "Pat Example",
      result: "clear",
    })

    expectApplicationError(result, ForbiddenError, "result_forbidden")
  })

  test("rejects a non requester with not_requester", async () => {
    const { context } = await createTestContext()

    const checkId = await seedCheck(context, 5)

    const result = await new UpdateAntisocialCheck(context).run({
      antisocialCheckId: checkId,
      session: makeTestSession("member", 6),
      partnerName: "Demo Partners LLC",
      partnerAddress: null,
      representativeName: null,
      result: null,
    })

    expectApplicationError(result, ForbiddenError, "not_requester")
  })
})

describe("CancelAntisocialCheck", () => {})
