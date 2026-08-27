import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { ThanksRedemption } from "@/contexts/thanks/domain/entities/thanks-redemption.entity"
import { ApproveRedemption } from "@/contexts/thanks/application/thanks-points/approve-redemption"
import { RejectRedemption } from "@/contexts/thanks/application/thanks-points/reject-redemption"
import { ForbiddenError } from "@/lib/errors"
import { ThanksRedemptionRepository } from "@/contexts/thanks/infrastructure/repositories/thanks-points/thanks-redemption.repository"
import { createTestContext } from "@tests/api/support/create-test-context"
import { makeTestSession } from "@tests/api/support/make-test-session"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { describe, expect, test } from "bun:test"

async function seedPendingRedemption(
  repository: ThanksRedemptionRepository,
  employeeId: EmployeeId,
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

describe("ApproveRedemption / RejectRedemption", () => {
  test("returns forbidden for a member role", async () => {
    const { context } = await createTestContext()

    const repository = new ThanksRedemptionRepository(context)

    const redemption = await seedPendingRedemption(repository, toWorkforceEmployeeId(5))

    const result = await new ApproveRedemption(context).execute({
      session: makeTestSession("member"),
      redemptionId: redemption.id ?? 0,
      deciderId: toWorkforceEmployeeId(2),
      decidedAt: "2026-06-02T00:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("returns self_approval_forbidden when decider is the applicant", async () => {
    const { context } = await createTestContext()

    const repository = new ThanksRedemptionRepository(context)

    const redemption = await seedPendingRedemption(repository, toWorkforceEmployeeId(5))

    const result = await new RejectRedemption(context).execute({
      session: makeTestSession("root"),
      redemptionId: redemption.id ?? 0,
      deciderId: toWorkforceEmployeeId(5),
      decidedAt: "2026-06-02T00:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "self_approval_forbidden")
  })

  test("allows admin to reject a redemption", async () => {
    const { context } = await createTestContext()

    const repository = new ThanksRedemptionRepository(context)

    const redemption = await seedPendingRedemption(repository, toWorkforceEmployeeId(5))

    const result = await new RejectRedemption(context).execute({
      session: makeTestSession("root"),
      redemptionId: redemption.id ?? 0,
      deciderId: toWorkforceEmployeeId(2),
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
    const { context } = await createTestContext()

    const repository = new ThanksRedemptionRepository(context)

    const redemption = await seedPendingRedemption(repository, toWorkforceEmployeeId(5))

    const result = await new RejectRedemption(context).execute({
      session: makeTestSession("hr"),
      redemptionId: redemption.id ?? 0,
      deciderId: toWorkforceEmployeeId(2),
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
