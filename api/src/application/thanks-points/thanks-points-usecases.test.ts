import { ThanksRedemption } from "@/domain/thanks-points/thanks-redemption.entity"
import { ThanksReward } from "@/domain/thanks-points/thanks-reward.entity"
import { CreateReward } from "@/application/thanks-points/create-reward"
import { DecideRedemption } from "@/application/thanks-points/decide-redemption"
import { ListMyRedemptions } from "@/application/thanks-points/list-my-redemptions"
import { ListPendingRedemptions } from "@/application/thanks-points/list-pending-redemptions"
import { ListRewards } from "@/application/thanks-points/list-rewards"
import { RequestRedemption } from "@/application/thanks-points/request-redemption"
import { UpdateReward } from "@/application/thanks-points/update-reward"
import { ViewMyBalance } from "@/application/thanks-points/view-my-balance"
import { ViewMyBudget } from "@/application/thanks-points/view-my-budget"
import { ThanksRewardRepository } from "@/infrastructure/thanks-points/thanks-reward-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { thanks, thanksRedemptions, thanksRewards } from "@/schema"
import { eq } from "drizzle-orm"
import { describe, expect, test } from "bun:test"

type TestContext = ReturnType<typeof createTestContext>["context"]

// 受領残高を作る。
async function seedBalance(
  context: TestContext,
  recipientEmployeeId: number,
  points: number,
): Promise<void> {
  await context.var.database.insert(thanks).values({
    senderEmployeeId: 99,
    recipientEmployeeId,
    message: "テスト",
    points,
    createdAt: "2026-01-01T00:00:00.000Z",
  })
}

// アクティブな報酬を作る。
async function seedReward(
  context: TestContext,
  props: { pointCost: number; stock: number | null; isActive?: boolean },
): Promise<number> {
  const rows = await context.var.database
    .insert(thanksRewards)
    .values({
      name: "景品",
      pointCost: props.pointCost,
      stock: props.stock,
      isActive: props.isActive ?? true,
      createdAt: "2026-01-01T00:00:00.000Z",
    })
    .returning()

  const row = rows.at(0)

  if (row === undefined) {
    throw new Error("failed to seed reward")
  }

  return row.id
}

// --- CreateReward ---

describe("CreateReward", () => {
  test("creates a reward with valid inputs", async () => {
    const { context } = createTestContext()

    const result = await new CreateReward(context).run({
      name: "図書カード 1000 円",
      pointCost: 100,
      stock: 10,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(ThanksReward)
  })

  test("returns invalid_reward for empty name", async () => {
    const { context } = createTestContext()

    const result = await new CreateReward(context).run({
      name: "",
      pointCost: 100,
      stock: 10,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    if (result instanceof Error || result instanceof ThanksReward) {
      throw new Error("expected a reason result")
    }

    expect(result.reason).toBe("invalid_reward")
  })

  test("returns invalid_reward for zero point cost", async () => {
    const { context } = createTestContext()

    const result = await new CreateReward(context).run({
      name: "景品",
      pointCost: 0,
      stock: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    if (result instanceof Error || result instanceof ThanksReward) {
      throw new Error("expected a reason result")
    }

    expect(result.reason).toBe("invalid_reward")
  })
})

// --- UpdateReward ---

describe("UpdateReward", () => {
  test("updates an existing reward", async () => {
    const { context } = createTestContext()

    const rewardId = await seedReward(context, { pointCost: 50, stock: 5 })

    const result = await new UpdateReward(context).run({
      rewardId,
      name: "更新後の景品",
      pointCost: 80,
      stock: 3,
      isActive: true,
    })

    expect(result).toBeInstanceOf(ThanksReward)

    if (result instanceof ThanksReward) {
      expect(result.name).toBe("更新後の景品")
      expect(result.pointCost).toBe(80)
      expect(result.stock).toBe(3)
    }
  })

  test("returns reward_not_found for non-existent id", async () => {
    const { context } = createTestContext()

    const result = await new UpdateReward(context).run({
      rewardId: 9999,
      name: "景品",
      pointCost: 50,
      stock: null,
      isActive: true,
    })

    if (result instanceof Error || result instanceof ThanksReward) {
      throw new Error("expected a reason result")
    }

    expect(result.reason).toBe("reward_not_found")
  })

  test("returns invalid_reward for invalid inputs", async () => {
    const { context } = createTestContext()

    const rewardId = await seedReward(context, { pointCost: 50, stock: 5 })

    const result = await new UpdateReward(context).run({
      rewardId,
      name: "",
      pointCost: 50,
      stock: null,
      isActive: true,
    })

    if (result instanceof Error || result instanceof ThanksReward) {
      throw new Error("expected a reason result")
    }

    expect(result.reason).toBe("invalid_reward")
  })
})

// --- ListRewards ---

describe("ListRewards", () => {
  test("returns all rewards", async () => {
    const { context } = createTestContext()

    await seedReward(context, { pointCost: 50, stock: 5 })
    await seedReward(context, { pointCost: 100, stock: null, isActive: false })

    const result = await new ListRewards(context).run({
      activeOnly: false,
      limit: 10,
      offset: 0,
    })

    if (result instanceof Error) {
      throw result
    }

    expect(result.length).toBe(2)
  })

  test("filters to active only", async () => {
    const { context } = createTestContext()

    await seedReward(context, { pointCost: 50, stock: 5 })
    await seedReward(context, { pointCost: 100, stock: null, isActive: false })

    const result = await new ListRewards(context).run({
      activeOnly: true,
      limit: 10,
      offset: 0,
    })

    if (result instanceof Error) {
      throw result
    }

    expect(result.length).toBe(1)
  })
})

// --- RequestRedemption ---

describe("RequestRedemption", () => {
  test("creates a redemption when balance and stock are sufficient", async () => {
    const { context } = createTestContext()

    await seedBalance(context, 5, 100)

    const rewardId = await seedReward(context, { pointCost: 50, stock: 3 })

    const result = await new RequestRedemption(context).run({
      employeeId: 5,
      rewardId,
      createdAt: "2026-02-01T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(ThanksRedemption)
  })

  test("returns reward_not_found for non-existent reward", async () => {
    const { context } = createTestContext()

    await seedBalance(context, 5, 100)

    const result = await new RequestRedemption(context).run({
      employeeId: 5,
      rewardId: 9999,
      createdAt: "2026-02-01T00:00:00.000Z",
    })

    if (result instanceof Error || result instanceof ThanksRedemption) {
      throw new Error("expected a reason result")
    }

    expect(result.reason).toBe("reward_not_found")
  })

  test("returns reward_inactive for inactive reward", async () => {
    const { context } = createTestContext()

    await seedBalance(context, 5, 100)

    const rewardId = await seedReward(context, { pointCost: 50, stock: 3, isActive: false })

    const result = await new RequestRedemption(context).run({
      employeeId: 5,
      rewardId,
      createdAt: "2026-02-01T00:00:00.000Z",
    })

    if (result instanceof Error || result instanceof ThanksRedemption) {
      throw new Error("expected a reason result")
    }

    expect(result.reason).toBe("reward_inactive")
  })

  test("returns out_of_stock when stock is zero", async () => {
    const { context } = createTestContext()

    await seedBalance(context, 5, 100)

    const rewardId = await seedReward(context, { pointCost: 50, stock: 0 })

    const result = await new RequestRedemption(context).run({
      employeeId: 5,
      rewardId,
      createdAt: "2026-02-01T00:00:00.000Z",
    })

    if (result instanceof Error || result instanceof ThanksRedemption) {
      throw new Error("expected a reason result")
    }

    expect(result.reason).toBe("out_of_stock")
  })

  test("returns insufficient_balance when balance is short", async () => {
    const { context } = createTestContext()

    await seedBalance(context, 5, 30)

    const rewardId = await seedReward(context, { pointCost: 50, stock: 1 })

    const result = await new RequestRedemption(context).run({
      employeeId: 5,
      rewardId,
      createdAt: "2026-02-01T00:00:00.000Z",
    })

    if (result instanceof Error || result instanceof ThanksRedemption) {
      throw new Error("expected a reason result")
    }

    expect(result.reason).toBe("insufficient_balance")
  })

  test("returns pending_exists when a pending redemption already exists", async () => {
    const { context } = createTestContext()

    await seedBalance(context, 5, 200)

    const rewardId = await seedReward(context, { pointCost: 50, stock: 5 })

    const first = await new RequestRedemption(context).run({
      employeeId: 5,
      rewardId,
      createdAt: "2026-02-01T00:00:00.000Z",
    })

    expect(first).toBeInstanceOf(ThanksRedemption)

    const second = await new RequestRedemption(context).run({
      employeeId: 5,
      rewardId,
      createdAt: "2026-02-02T00:00:00.000Z",
    })

    if (second instanceof Error || second instanceof ThanksRedemption) {
      throw new Error("expected a reason result")
    }

    expect(second.reason).toBe("pending_exists")
  })

  // #744: reward.isActive チェックが INSERT の WHERE に畳み込まれているかを検証する。
  // 事前チェック直後に報酬が無効化された場合のアトミック検知。
  test("rejects atomically when reward is deactivated between check and INSERT", async () => {
    const { context } = createTestContext()

    await seedBalance(context, 5, 100)

    // 報酬は active で作成するが、直後に DB 上で無効化する。
    // RequestRedemption の app 層チェックは isActive=true を見るが、
    // createIfSufficientBalance の INSERT WHERE が isActive=1 を再確認して弾く。
    const rewardId = await seedReward(context, { pointCost: 50, stock: 5, isActive: true })

    // INSERT 前に無効化をシミュレーション
    await context.var.database
      .update(thanksRewards)
      .set({ isActive: false })
      .where(eq(thanksRewards.id, rewardId))

    const result = await new RequestRedemption(context).run({
      employeeId: 5,
      rewardId,
      createdAt: "2026-02-01T00:00:00.000Z",
    })

    if (result instanceof Error || result instanceof ThanksRedemption) {
      throw new Error("expected a reason result")
    }

    // app 層の事前チェックで reward_inactive になる（DB を直接更新したため app 層の findById が拾う）
    expect(result.reason).toBe("reward_inactive")
  })
})

// --- DecideRedemption ---

describe("DecideRedemption", () => {
  test("approves a pending redemption and decrements stock", async () => {
    const { context } = createTestContext()

    await seedBalance(context, 5, 100)

    const rewardId = await seedReward(context, { pointCost: 50, stock: 3 })

    const pending = await new RequestRedemption(context).run({
      employeeId: 5,
      rewardId,
      createdAt: "2026-02-01T00:00:00.000Z",
    })

    if (!(pending instanceof ThanksRedemption)) {
      throw new Error("expected ThanksRedemption")
    }

    const result = await new DecideRedemption(context).run({
      redemptionId: pending.id ?? 0,
      deciderId: 2,
      action: "approve",
      decidedAt: "2026-02-02T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(ThanksRedemption)

    if (result instanceof ThanksRedemption) {
      expect(result.status).toBe("fulfilled")
    }

    // 在庫が 1 減っているか確認
    const reward = await new ThanksRewardRepository(context).findById(rewardId)

    if (reward instanceof Error || reward === null) {
      throw new Error("reward not found after approve")
    }

    expect(reward.stock).toBe(2)
  })

  test("rejects a pending redemption", async () => {
    const { context } = createTestContext()

    await seedBalance(context, 5, 100)

    const rewardId = await seedReward(context, { pointCost: 50, stock: 3 })

    const pending = await new RequestRedemption(context).run({
      employeeId: 5,
      rewardId,
      createdAt: "2026-02-01T00:00:00.000Z",
    })

    if (!(pending instanceof ThanksRedemption)) {
      throw new Error("expected ThanksRedemption")
    }

    const result = await new DecideRedemption(context).run({
      redemptionId: pending.id ?? 0,
      deciderId: 2,
      action: "reject",
      decidedAt: "2026-02-02T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(ThanksRedemption)

    if (result instanceof ThanksRedemption) {
      expect(result.status).toBe("rejected")
    }
  })

  test("returns self_approval_forbidden for self-decide", async () => {
    const { context } = createTestContext()

    await seedBalance(context, 5, 100)

    const rewardId = await seedReward(context, { pointCost: 50, stock: 3 })

    const pending = await new RequestRedemption(context).run({
      employeeId: 5,
      rewardId,
      createdAt: "2026-02-01T00:00:00.000Z",
    })

    if (!(pending instanceof ThanksRedemption)) {
      throw new Error("expected ThanksRedemption")
    }

    const result = await new DecideRedemption(context).run({
      redemptionId: pending.id ?? 0,
      deciderId: 5,
      action: "approve",
      decidedAt: "2026-02-02T00:00:00.000Z",
    })

    if (result instanceof Error || result instanceof ThanksRedemption) {
      throw new Error("expected a reason result")
    }

    expect(result.reason).toBe("self_approval_forbidden")
  })

  test("returns redemption_not_found for unknown id", async () => {
    const { context } = createTestContext()

    const result = await new DecideRedemption(context).run({
      redemptionId: 9999,
      deciderId: 2,
      action: "approve",
      decidedAt: "2026-02-02T00:00:00.000Z",
    })

    if (result instanceof Error || result instanceof ThanksRedemption) {
      throw new Error("expected a reason result")
    }

    expect(result.reason).toBe("redemption_not_found")
  })

  test("returns already_decided for a fulfilled redemption", async () => {
    const { context } = createTestContext()

    await seedBalance(context, 5, 100)

    const rewardId = await seedReward(context, { pointCost: 50, stock: 3 })

    const pending = await new RequestRedemption(context).run({
      employeeId: 5,
      rewardId,
      createdAt: "2026-02-01T00:00:00.000Z",
    })

    if (!(pending instanceof ThanksRedemption)) {
      throw new Error("expected ThanksRedemption")
    }

    const first = await new DecideRedemption(context).run({
      redemptionId: pending.id ?? 0,
      deciderId: 2,
      action: "approve",
      decidedAt: "2026-02-02T00:00:00.000Z",
    })

    expect(first).toBeInstanceOf(ThanksRedemption)

    const second = await new DecideRedemption(context).run({
      redemptionId: pending.id ?? 0,
      deciderId: 2,
      action: "reject",
      decidedAt: "2026-02-03T00:00:00.000Z",
    })

    if (second instanceof Error || second instanceof ThanksRedemption) {
      throw new Error("expected a reason result")
    }

    expect(second.reason).toBe("already_decided")
  })

  test("returns insufficient_balance when balance is consumed between request and approve", async () => {
    const { context } = createTestContext()

    // 残高 50 ぴったりで申請（申請の pending で 50 が引かれる）
    await seedBalance(context, 5, 50)

    const rewardId = await seedReward(context, { pointCost: 50, stock: 3 })

    const pending = await new RequestRedemption(context).run({
      employeeId: 5,
      rewardId,
      createdAt: "2026-02-01T00:00:00.000Z",
    })

    if (!(pending instanceof ThanksRedemption)) {
      throw new Error("expected ThanksRedemption")
    }

    // pending が引かれた残高は 0。approve 時は自身の pending を除外して再計算するため残高は 50。
    // しかし、別の fulfilled/pending を追加して残高を 0 にする。
    // 直接 DB に別の fulfilled 行を挿入して残高を食いつぶす
    await context.var.database.insert(thanksRedemptions).values({
      employeeId: 5,
      rewardId,
      pointCost: 50,
      status: "fulfilled",
      createdAt: "2026-01-15T00:00:00.000Z",
      decidedAt: "2026-01-16T00:00:00.000Z",
      deciderId: 2,
    })

    const result = await new DecideRedemption(context).run({
      redemptionId: pending.id ?? 0,
      deciderId: 2,
      action: "approve",
      decidedAt: "2026-02-02T00:00:00.000Z",
    })

    if (result instanceof Error || result instanceof ThanksRedemption) {
      throw new Error("expected a reason result")
    }

    expect(result.reason).toBe("insufficient_balance")
  })
})

// --- ListMyRedemptions ---

describe("ListMyRedemptions", () => {
  test("returns only the employee's redemptions", async () => {
    const { context } = createTestContext()

    await seedBalance(context, 5, 200)
    await seedBalance(context, 6, 200)

    const rewardId = await seedReward(context, { pointCost: 50, stock: 10 })

    const first = await new RequestRedemption(context).run({
      employeeId: 5,
      rewardId,
      createdAt: "2026-02-01T00:00:00.000Z",
    })

    expect(first).toBeInstanceOf(ThanksRedemption)

    // employee 6 の申請
    const second = await new RequestRedemption(context).run({
      employeeId: 6,
      rewardId,
      createdAt: "2026-02-02T00:00:00.000Z",
    })

    expect(second).toBeInstanceOf(ThanksRedemption)

    const result = await new ListMyRedemptions(context).run({
      employeeId: 5,
      limit: 10,
      offset: 0,
    })

    if (result instanceof Error) {
      throw result
    }

    expect(result.length).toBe(1)
  })
})

// --- ListPendingRedemptions ---

describe("ListPendingRedemptions", () => {
  test("returns only pending redemptions", async () => {
    const { context } = createTestContext()

    await seedBalance(context, 5, 200)

    const rewardId = await seedReward(context, { pointCost: 50, stock: 10 })

    const pending = await new RequestRedemption(context).run({
      employeeId: 5,
      rewardId,
      createdAt: "2026-02-01T00:00:00.000Z",
    })

    if (!(pending instanceof ThanksRedemption)) {
      throw new Error("expected ThanksRedemption")
    }

    // approve して fulfilled にする
    await new DecideRedemption(context).run({
      redemptionId: pending.id ?? 0,
      deciderId: 2,
      action: "approve",
      decidedAt: "2026-02-02T00:00:00.000Z",
    })

    const result = await new ListPendingRedemptions(context).run({ limit: 10, offset: 0 })

    if (result instanceof Error) {
      throw result
    }

    // fulfilled 済みなので pending は 0 件
    expect(result.length).toBe(0)
  })
})

// --- ViewMyBalance ---

describe("ViewMyBalance", () => {
  test("returns the correct balance after receiving thanks", async () => {
    const { context } = createTestContext()

    await seedBalance(context, 5, 100)

    const result = await new ViewMyBalance(context).run({ employeeId: 5 })

    if (result instanceof Error) {
      throw result
    }

    expect(result).toBe(100)
  })

  test("returns 0 for employee with no thanks", async () => {
    const { context } = createTestContext()

    const result = await new ViewMyBalance(context).run({ employeeId: 5 })

    if (result instanceof Error) {
      throw result
    }

    expect(result).toBe(0)
  })

  test("deducts pending and fulfilled redemptions from balance", async () => {
    const { context } = createTestContext()

    await seedBalance(context, 5, 100)

    const rewardId = await seedReward(context, { pointCost: 30, stock: 5 })

    const pending = await new RequestRedemption(context).run({
      employeeId: 5,
      rewardId,
      createdAt: "2026-02-01T00:00:00.000Z",
    })

    expect(pending).toBeInstanceOf(ThanksRedemption)

    const balance = await new ViewMyBalance(context).run({ employeeId: 5 })

    if (balance instanceof Error) {
      throw balance
    }

    expect(balance).toBe(70)
  })
})

// --- ViewMyBudget ---

describe("ViewMyBudget", () => {
  test("creates budget on first access", async () => {
    const { context } = createTestContext()

    const result = await new ViewMyBudget(context).run({
      employeeId: 5,
      now: "2026-06-15T00:00:00.000Z",
    })

    if (result instanceof Error) {
      throw result
    }

    expect(result.period).toBe("2026-06")
    expect(result.grantedPoints).toBeGreaterThan(0)
    expect(result.consumedPoints).toBe(0)
    expect(result.remainingPoints).toBe(result.grantedPoints)
  })
})
