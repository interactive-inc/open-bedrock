import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { ThanksRedemption } from "@/contexts/thanks/domain/entities/thanks-redemption.entity"
import { ApproveRedemption } from "@/contexts/thanks/application/thanks-points/approve-redemption"
import { RejectRedemption } from "@/contexts/thanks/application/thanks-points/reject-redemption"
import { ThanksError } from "@/contexts/thanks/domain/errors"
import { FakeThanksPoints } from "@/contexts/thanks/test/thanks-points-fakes.test-support"
import { ForbiddenError } from "@/lib/errors"
import { makeTestSession } from "@tests/api/support/make-test-session"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { describe, expect, test } from "bun:test"

function seedPendingRedemption(points: FakeThanksPoints): ThanksRedemption {
  return points.seedRedemption({
    employeeId: toWorkforceEmployeeId(5),
    rewardId: "0190002a-0000-7000-8000-000000000001",
    pointCost: 10,
    status: "pending",
  })
}

describe("ApproveRedemption / RejectRedemption", () => {
  test("returns forbidden for a member role", async () => {
    const points = new FakeThanksPoints()

    const redemption = seedPendingRedemption(points)

    const result = await new ApproveRedemption(points).execute({
      session: makeTestSession("member"),
      redemptionId: redemption.id ?? "",
      deciderId: toWorkforceEmployeeId(2),
      decidedAt: "2026-06-02T00:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("returns self_approval_forbidden when decider is the applicant", async () => {
    const points = new FakeThanksPoints()

    const redemption = seedPendingRedemption(points)

    const result = await new RejectRedemption(points).execute({
      session: makeTestSession("root"),
      redemptionId: redemption.id ?? "",
      deciderId: toWorkforceEmployeeId(5),
      decidedAt: "2026-06-02T00:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "self_approval_forbidden")
  })

  test("returns the Company authority failure without deciding", async () => {
    for (const decide of ["approve", "reject"] as const) {
      const points = new FakeThanksPoints()

      points.authorityError = new ThanksError(
        "company_authority_required",
        "company authority over the requester is required",
      )

      const redemption = seedPendingRedemption(points)

      const command = {
        session: makeTestSession("root"),
        redemptionId: redemption.id ?? "",
        deciderId: toWorkforceEmployeeId(2),
        decidedAt: "2026-06-02T00:00:00.000Z",
      }

      const result =
        decide === "approve"
          ? await new ApproveRedemption(points).execute(command)
          : await new RejectRedemption(points).execute(command)

      expectApplicationError(result, ForbiddenError, "company_authority_required")
      expect(points.redemptions.get(redemption.id ?? "")?.status).toBe("pending")
    }
  })

  test("allows admin to reject a redemption", async () => {
    const points = new FakeThanksPoints()

    const redemption = seedPendingRedemption(points)

    const result = await new RejectRedemption(points).execute({
      session: makeTestSession("root"),
      redemptionId: redemption.id ?? "",
      deciderId: toWorkforceEmployeeId(2),
      decidedAt: "2026-06-02T00:00:00.000Z",
    })

    if (!(result instanceof ThanksRedemption)) {
      throw new Error("unexpected failure")
    }

    expect(result.status).toBe("rejected")
  })

  test("allows hr to reject a redemption", async () => {
    const points = new FakeThanksPoints()

    const redemption = seedPendingRedemption(points)

    const result = await new RejectRedemption(points).execute({
      session: makeTestSession("hr"),
      redemptionId: redemption.id ?? "",
      deciderId: toWorkforceEmployeeId(2),
      decidedAt: "2026-06-02T00:00:00.000Z",
    })

    if (!(result instanceof ThanksRedemption)) {
      throw new Error("unexpected failure")
    }

    expect(result.status).toBe("rejected")
  })
})
