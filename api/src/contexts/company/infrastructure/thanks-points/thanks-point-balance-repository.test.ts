import { ThanksPointBalanceRepository } from "@/contexts/company/infrastructure/thanks-points/thanks-point-balance-repository"
import { createTestContext } from "@/contexts/company/interface/test-helpers/create-test-context"
import { thanks, thanksPointBudgets, thanksRedemptions, thanksRewards } from "@/schema"
import type { RedemptionStatus } from "@/lib/schemas"
import { describe, expect, test } from "bun:test"

/** 受領を作る（recipient に points を贈る thanks 行を直接挿入する）。 */
async function seedReceived(
  context: ReturnType<typeof createTestContext>["context"],
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

/** 任意のステータスの交換を作る。差し引き対象の判定を確かめるために使う。 */
async function seedRedemption(
  context: ReturnType<typeof createTestContext>["context"],
  props: { employeeId: number; pointCost: number; status: RedemptionStatus },
): Promise<void> {
  const rewardRows = await context.var.database
    .insert(thanksRewards)
    .values({
      name: "景品",
      pointCost: props.pointCost,
      stock: null,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    })
    .returning()

  const rewardId = rewardRows.at(0)?.id

  if (rewardId === undefined) {
    throw new Error("failed to seed reward")
  }

  await context.var.database.insert(thanksRedemptions).values({
    employeeId: props.employeeId,
    rewardId,
    pointCost: props.pointCost,
    status: props.status,
    createdAt: "2026-01-01T00:00:00.000Z",
    decidedAt: null,
    deciderId: null,
  })
}

describe("ThanksPointBalanceRepository.getBalance", () => {
  test("returns 0 when nothing has been received", async () => {
    const { context } = createTestContext()

    const balance = await new ThanksPointBalanceRepository(context).getBalance(5)

    expect(balance).toBe(0)
  })

  test("sums received points", async () => {
    const { context } = createTestContext()

    await seedReceived(context, 5, 100)
    await seedReceived(context, 5, 20)

    const balance = await new ThanksPointBalanceRepository(context).getBalance(5)

    expect(balance).toBe(120)
  })

  test("counts only points received by the given employee", async () => {
    const { context } = createTestContext()

    await seedReceived(context, 5, 100)
    await seedReceived(context, 6, 999)

    const balance = await new ThanksPointBalanceRepository(context).getBalance(5)

    expect(balance).toBe(100)
  })

  test("deducts fulfilled redemptions", async () => {
    const { context } = createTestContext()

    await seedReceived(context, 5, 100)
    await seedRedemption(context, { employeeId: 5, pointCost: 30, status: "fulfilled" })

    const balance = await new ThanksPointBalanceRepository(context).getBalance(5)

    expect(balance).toBe(70)
  })

  test("deducts pending redemptions so reserved points cannot be spent twice", async () => {
    const { context } = createTestContext()

    await seedReceived(context, 5, 100)
    await seedRedemption(context, { employeeId: 5, pointCost: 30, status: "pending" })

    const balance = await new ThanksPointBalanceRepository(context).getBalance(5)

    expect(balance).toBe(70)
  })

  test("does not deduct rejected redemptions", async () => {
    const { context } = createTestContext()

    await seedReceived(context, 5, 100)
    await seedRedemption(context, { employeeId: 5, pointCost: 30, status: "rejected" })

    const balance = await new ThanksPointBalanceRepository(context).getBalance(5)

    expect(balance).toBe(100)
  })

  test("deducts only the given employee's redemptions", async () => {
    const { context } = createTestContext()

    await seedReceived(context, 5, 100)
    await seedRedemption(context, { employeeId: 6, pointCost: 30, status: "fulfilled" })

    const balance = await new ThanksPointBalanceRepository(context).getBalance(5)

    expect(balance).toBe(100)
  })

  // 受領残高は当月原資と別概念。原資をいくら積んでも受領残高は動かない。
  test("ignores the monthly sending budget entirely", async () => {
    const { context } = createTestContext()

    await context.var.database.insert(thanksPointBudgets).values({
      employeeId: 5,
      period: "2026-01",
      grantedPoints: 400,
      consumedPoints: 250,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    const balance = await new ThanksPointBalanceRepository(context).getBalance(5)

    expect(balance).toBe(0)
  })
})
