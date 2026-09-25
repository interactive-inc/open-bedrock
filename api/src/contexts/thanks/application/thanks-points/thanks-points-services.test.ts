import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { ThanksRedemption } from "@/contexts/thanks/domain/entities/thanks-redemption.entity"
import { ThanksReward } from "@/contexts/thanks/domain/entities/thanks-reward.entity"
import { CreateReward } from "@/contexts/thanks/application/thanks-points/create-reward"
import { ApproveRedemption } from "@/contexts/thanks/application/thanks-points/approve-redemption"
import { RejectRedemption } from "@/contexts/thanks/application/thanks-points/reject-redemption"
import { RequestRedemption } from "@/contexts/thanks/application/thanks-points/request-redemption"
import { UpdateReward } from "@/contexts/thanks/application/thanks-points/update-reward"
import { FakeThanksPoints } from "@/contexts/thanks/test/thanks-points-fakes.test-support"
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { makeTestSession } from "@tests/api/support/make-test-session"
import { describe, expect, test } from "bun:test"

// 残高・在庫・pending重複の条件付きINSERT/UPDATEは thanks-redemption.repository.d1.test.ts がローカルD1で検証する。

async function requestPending(
  points: FakeThanksPoints,
  employeeId: number,
  rewardId: string,
): Promise<ThanksRedemption> {
  const pending = await new RequestRedemption(points).run({
    employeeId: toWorkforceEmployeeId(employeeId),
    rewardId,
    createdAt: "2026-02-01T00:00:00.000Z",
  })

  if (!(pending instanceof ThanksRedemption)) {
    throw new Error("expected ThanksRedemption")
  }

  return pending
}

describe("CreateReward", () => {
  test("creates a reward with valid inputs", async () => {
    const points = new FakeThanksPoints()

    const result = await new CreateReward(points).run({
      name: "図書カード 1000 円",
      pointCost: 100,
      stock: 10,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(ThanksReward)
  })

  test("returns invalid_reward for empty name", async () => {
    const points = new FakeThanksPoints()

    const result = await new CreateReward(points).run({
      name: "",
      pointCost: 100,
      stock: 10,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expectApplicationError(result, ValidationError, "invalid_reward")
    expect(points.rewards.size).toBe(0)
  })

  test("returns invalid_reward for zero point cost", async () => {
    const points = new FakeThanksPoints()

    const result = await new CreateReward(points).run({
      name: "景品",
      pointCost: 0,
      stock: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expectApplicationError(result, ValidationError, "invalid_reward")
  })
})

describe("UpdateReward", () => {
  test("updates an existing reward", async () => {
    const points = new FakeThanksPoints()

    const rewardId = points.seedReward({ pointCost: 50, stock: 5 })

    const result = await new UpdateReward(points).run({
      rewardId,
      name: "更新後の景品",
      pointCost: 80,
      isActive: true,
    })

    expect(result).toBeInstanceOf(ThanksReward)

    if (result instanceof ThanksReward) {
      expect(result.name).toBe("更新後の景品")
      expect(result.pointCost).toBe(80)
      // stock は updateWithoutStock で触れないため seed 時の値(5)が残る
      expect(result.stock).toBe(5)
    }
  })

  test("returns reward_not_found for non-existent id", async () => {
    const points = new FakeThanksPoints()

    const result = await new UpdateReward(points).run({
      rewardId: "0190002a-0000-7000-8000-00000000270f",
      name: "景品",
      pointCost: 50,
      isActive: true,
    })

    expectApplicationError(result, NotFoundError, "reward_not_found")
  })

  test("returns invalid_reward for invalid inputs", async () => {
    const points = new FakeThanksPoints()

    const rewardId = points.seedReward({ pointCost: 50, stock: 5 })

    const result = await new UpdateReward(points).run({
      rewardId,
      name: "",
      pointCost: 50,
      isActive: true,
    })

    expectApplicationError(result, ValidationError, "invalid_reward")
  })
})

describe("RequestRedemption", () => {
  test("creates a redemption when balance and stock are sufficient", async () => {
    const points = new FakeThanksPoints()

    points.seedBalance(toWorkforceEmployeeId(5), 100)

    const rewardId = points.seedReward({ pointCost: 50, stock: 3 })

    const result = await new RequestRedemption(points).run({
      employeeId: toWorkforceEmployeeId(5),
      rewardId,
      createdAt: "2026-02-01T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(ThanksRedemption)
  })

  test("returns reward_not_found for non-existent reward", async () => {
    const points = new FakeThanksPoints()

    points.seedBalance(toWorkforceEmployeeId(5), 100)

    const result = await new RequestRedemption(points).run({
      employeeId: toWorkforceEmployeeId(5),
      rewardId: "0190002a-0000-7000-8000-00000000270f",
      createdAt: "2026-02-01T00:00:00.000Z",
    })

    expectApplicationError(result, NotFoundError, "reward_not_found")
  })

  test("returns reward_inactive for inactive reward", async () => {
    const points = new FakeThanksPoints()

    points.seedBalance(toWorkforceEmployeeId(5), 100)

    const rewardId = points.seedReward({ pointCost: 50, stock: 3, isActive: false })

    const result = await new RequestRedemption(points).run({
      employeeId: toWorkforceEmployeeId(5),
      rewardId,
      createdAt: "2026-02-01T00:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "reward_inactive")
  })

  test("returns out_of_stock when stock is zero", async () => {
    const points = new FakeThanksPoints()

    points.seedBalance(toWorkforceEmployeeId(5), 100)

    const rewardId = points.seedReward({ pointCost: 50, stock: 0 })

    const result = await new RequestRedemption(points).run({
      employeeId: toWorkforceEmployeeId(5),
      rewardId,
      createdAt: "2026-02-01T00:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "out_of_stock")
  })

  test("returns insufficient_balance when balance is short", async () => {
    const points = new FakeThanksPoints()

    points.seedBalance(toWorkforceEmployeeId(5), 30)

    const rewardId = points.seedReward({ pointCost: 50, stock: 1 })

    const result = await new RequestRedemption(points).run({
      employeeId: toWorkforceEmployeeId(5),
      rewardId,
      createdAt: "2026-02-01T00:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "insufficient_balance")
  })

  test("returns pending_exists when a pending redemption already exists", async () => {
    const points = new FakeThanksPoints()

    points.seedBalance(toWorkforceEmployeeId(5), 200)

    const rewardId = points.seedReward({ pointCost: 50, stock: 5 })

    await requestPending(points, 5, rewardId)

    const second = await new RequestRedemption(points).run({
      employeeId: toWorkforceEmployeeId(5),
      rewardId,
      createdAt: "2026-02-02T00:00:00.000Z",
    })

    expectApplicationError(second, ConflictError, "pending_exists")
  })

  // reward.isActive チェックが INSERT の WHERE に畳み込まれていることを前提に、
  // 事前チェック直後に報酬が無効化された場合も reward_inactive として返すことを検証する。
  test("rejects atomically when reward is deactivated between check and INSERT", async () => {
    const points = new FakeThanksPoints()

    points.seedBalance(toWorkforceEmployeeId(5), 100)

    const rewardId = points.seedReward({ pointCost: 50, stock: 5, isActive: true })

    const activeReward = points.rewards.get(rewardId)

    const result = await new RequestRedemption({
      // 事前チェックは有効な報酬を読み、条件付きINSERTの時点では無効化済みになる。
      rewardRepository: { findById: async () => activeReward ?? null },
      redemptionRepository: {
        createIfSufficientBalance: async () => ({ reason: "reward_inactive" as const }),
      },
    }).run({
      employeeId: toWorkforceEmployeeId(5),
      rewardId,
      createdAt: "2026-02-01T00:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "reward_inactive")
  })
})

describe("ApproveRedemption / RejectRedemption", () => {
  test("approves a pending redemption and decrements stock", async () => {
    const points = new FakeThanksPoints()

    points.seedBalance(toWorkforceEmployeeId(5), 100)

    const rewardId = points.seedReward({ pointCost: 50, stock: 3 })

    const pending = await requestPending(points, 5, rewardId)

    const result = await new ApproveRedemption(points).execute({
      session: makeTestSession("root"),
      redemptionId: pending.id ?? "",
      deciderId: toWorkforceEmployeeId(2),
      decidedAt: "2026-02-02T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(ThanksRedemption)

    if (result instanceof ThanksRedemption) {
      expect(result.status).toBe("fulfilled")
    }

    expect(points.rewards.get(rewardId)?.stock).toBe(2)
  })

  test("returns out_of_stock when stock is consumed between request and approve", async () => {
    const points = new FakeThanksPoints()

    points.seedBalance(toWorkforceEmployeeId(5), 100)
    points.seedBalance(toWorkforceEmployeeId(6), 100)

    const rewardId = points.seedReward({ pointCost: 50, stock: 1 })

    const firstPending = await requestPending(points, 5, rewardId)
    const secondPending = await requestPending(points, 6, rewardId)

    const first = await new ApproveRedemption(points).execute({
      session: makeTestSession("root"),
      redemptionId: firstPending.id ?? "",
      deciderId: toWorkforceEmployeeId(2),
      decidedAt: "2026-02-02T00:00:00.000Z",
    })

    expect(first).toBeInstanceOf(ThanksRedemption)

    const second = await new ApproveRedemption(points).execute({
      session: makeTestSession("root"),
      redemptionId: secondPending.id ?? "",
      deciderId: toWorkforceEmployeeId(2),
      decidedAt: "2026-02-02T00:01:00.000Z",
    })

    if (second instanceof Error || second instanceof ThanksRedemption) {
      throw new Error("expected a reason result")
    }

    expect(second.reason).toBe("out_of_stock")
    expect(points.rewards.get(rewardId)?.stock).toBe(0)
  })

  test("rejects a pending redemption", async () => {
    const points = new FakeThanksPoints()

    points.seedBalance(toWorkforceEmployeeId(5), 100)

    const rewardId = points.seedReward({ pointCost: 50, stock: 3 })

    const pending = await requestPending(points, 5, rewardId)

    const result = await new RejectRedemption(points).execute({
      session: makeTestSession("root"),
      redemptionId: pending.id ?? "",
      deciderId: toWorkforceEmployeeId(2),
      decidedAt: "2026-02-02T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(ThanksRedemption)

    if (result instanceof ThanksRedemption) {
      expect(result.status).toBe("rejected")
    }
  })

  test("returns self_approval_forbidden for self-decide", async () => {
    const points = new FakeThanksPoints()

    points.seedBalance(toWorkforceEmployeeId(5), 100)

    const rewardId = points.seedReward({ pointCost: 50, stock: 3 })

    const pending = await requestPending(points, 5, rewardId)

    const result = await new ApproveRedemption(points).execute({
      session: makeTestSession("root", 5),
      redemptionId: pending.id ?? "",
      deciderId: toWorkforceEmployeeId(5),
      decidedAt: "2026-02-02T00:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "self_approval_forbidden")
  })

  test("returns redemption_not_found for unknown id", async () => {
    const points = new FakeThanksPoints()

    const result = await new ApproveRedemption(points).execute({
      session: makeTestSession("root"),
      redemptionId: "0190002b-0000-7000-8000-00000000270f",
      deciderId: toWorkforceEmployeeId(2),
      decidedAt: "2026-02-02T00:00:00.000Z",
    })

    expectApplicationError(result, NotFoundError, "redemption_not_found")
  })

  test("returns already_decided for a fulfilled redemption", async () => {
    const points = new FakeThanksPoints()

    points.seedBalance(toWorkforceEmployeeId(5), 100)

    const rewardId = points.seedReward({ pointCost: 50, stock: 3 })

    const pending = await requestPending(points, 5, rewardId)

    const first = await new ApproveRedemption(points).execute({
      session: makeTestSession("root"),
      redemptionId: pending.id ?? "",
      deciderId: toWorkforceEmployeeId(2),
      decidedAt: "2026-02-02T00:00:00.000Z",
    })

    expect(first).toBeInstanceOf(ThanksRedemption)

    const second = await new RejectRedemption(points).execute({
      session: makeTestSession("root"),
      redemptionId: pending.id ?? "",
      deciderId: toWorkforceEmployeeId(2),
      decidedAt: "2026-02-03T00:00:00.000Z",
    })

    expectApplicationError(second, ConflictError, "already_decided")
  })

  test("returns insufficient_balance when balance is consumed between request and approve", async () => {
    const points = new FakeThanksPoints()

    // 残高 50 ぴったりで申請する。approve 時は自身の pending を除外して再計算する。
    points.seedBalance(toWorkforceEmployeeId(5), 50)

    const rewardId = points.seedReward({ pointCost: 50, stock: 3 })

    const pending = await requestPending(points, 5, rewardId)

    // 別の fulfilled 行で残高を食いつぶす
    points.seedRedemption({
      employeeId: toWorkforceEmployeeId(5),
      rewardId,
      pointCost: 50,
      status: "fulfilled",
    })

    const result = await new ApproveRedemption(points).execute({
      session: makeTestSession("root"),
      redemptionId: pending.id ?? "",
      deciderId: toWorkforceEmployeeId(2),
      decidedAt: "2026-02-02T00:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "insufficient_balance")
  })
})
