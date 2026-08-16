import { ThanksRedemption } from "@/contexts/thanks/domain/thanks-points/thanks-redemption.entity"
import { DecideRedemption } from "@/contexts/thanks/application/thanks-points/decide-redemption"
import { ForbiddenError } from "@/lib/errors"
import { ThanksRedemptionRepository } from "@/contexts/thanks/infrastructure/thanks-points/thanks-redemption-repository"
import { createTestContext } from "@/api/test/support/create-test-context"
import { makeTestSession } from "@/api/test/support/make-test-session"
import { expectApplicationError } from "@/api/test/support/expect-application-error"
import { describe, expect, test } from "bun:test"

async function seedPendingRedemption(
  repository: ThanksRedemptionRepository,
  employeeId: number,
): Promise<ThanksRedemption> {
  const created = await repository.create(
    ThanksRedemption.create({
      employeeId,
      rewardId: 1,
      pointCost: 10,
      createdAt: "2026-06-01T00:00:00.000Z",
    }),
  )

  if (created instanceof Error) {
    throw new Error("seed failed")
  }

  if ("reason" in created) {
    throw new Error(`seed failed: ${created.reason}`)
  }

  return created
}

describe("DecideRedemption", () => {
  test("returns forbidden for a member role", async () => {
    const { context } = createTestContext()

    const repository = new ThanksRedemptionRepository(context)

    const redemption = await seedPendingRedemption(repository, 5)

    const result = await new DecideRedemption(context).run({
      session: makeTestSession("member"),
      redemptionId: redemption.id ?? 0,
      deciderId: 2,
      action: "approve",
      decidedAt: "2026-06-02T00:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("returns self_approval_forbidden when decider is the applicant", async () => {
    const { context } = createTestContext()

    const repository = new ThanksRedemptionRepository(context)

    const redemption = await seedPendingRedemption(repository, 5)

    const result = await new DecideRedemption(context).run({
      session: makeTestSession("root"),
      redemptionId: redemption.id ?? 0,
      deciderId: 5,
      action: "reject",
      decidedAt: "2026-06-02T00:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "self_approval_forbidden")
  })

  test("allows admin to reject a redemption", async () => {
    const { context } = createTestContext()

    const repository = new ThanksRedemptionRepository(context)

    const redemption = await seedPendingRedemption(repository, 5)

    const result = await new DecideRedemption(context).run({
      session: makeTestSession("root"),
      redemptionId: redemption.id ?? 0,
      deciderId: 2,
      action: "reject",
      decidedAt: "2026-06-02T00:00:00.000Z",
    })

    if (result instanceof Error) {
      throw result
    }

    if (!(result instanceof ThanksRedemption)) {
      throw new Error("unexpected failure")
    }

    expect(result.status).toBe("rejected")
  })

  test("allows hr to reject a redemption", async () => {
    const { context } = createTestContext()

    const repository = new ThanksRedemptionRepository(context)

    const redemption = await seedPendingRedemption(repository, 5)

    const result = await new DecideRedemption(context).run({
      session: makeTestSession("hr"),
      redemptionId: redemption.id ?? 0,
      deciderId: 2,
      action: "reject",
      decidedAt: "2026-06-02T00:00:00.000Z",
    })

    if (result instanceof Error) {
      throw result
    }

    if (!(result instanceof ThanksRedemption)) {
      throw new Error("unexpected failure")
    }

    expect(result.status).toBe("rejected")
  })
})
