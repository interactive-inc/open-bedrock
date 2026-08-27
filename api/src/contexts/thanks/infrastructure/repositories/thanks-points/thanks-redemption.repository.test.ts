import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { ThanksRedemption } from "@/contexts/thanks/domain/entities/thanks-redemption.entity"
import { ThanksRedemptionRepository } from "@/contexts/thanks/infrastructure/repositories/thanks-points/thanks-redemption.repository"
import { createTestContext } from "@tests/api/support/create-test-context"
import { thanks, thanksRewards } from "@/contexts/thanks/infrastructure/schema/thanks"
import { describe, expect, test } from "bun:test"

/** 受領残高を作る（recipient に points を贈る thanks 行を直接挿入する）。 */
async function seedBalance(
  context: Awaited<ReturnType<typeof createTestContext>>["context"],
  recipientEmployeeId: EmployeeId,
  points: number,
): Promise<void> {
  await context.var.database.insert(thanks).values({
    senderEmployeeId: toWorkforceEmployeeId(99),
    recipientEmployeeId,
    message: "テスト",
    points,
    createdAt: "2026-01-01T00:00:00.000Z",
  })
}

async function seedReward(
  context: Awaited<ReturnType<typeof createTestContext>>["context"],
  props: { pointCost: number; stock: number | null },
): Promise<number> {
  const rows = await context.var.database
    .insert(thanksRewards)
    .values({
      name: "景品",
      pointCost: props.pointCost,
      stock: props.stock,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    })
    .returning()

  const row = rows.at(0)

  if (row === undefined) {
    throw new Error("failed to seed reward")
  }

  return row.id
}

describe("ThanksRedemptionRepository.createIfSufficientBalance", () => {
  test("creates a pending redemption when balance and stock are sufficient", async () => {
    const { context } = await createTestContext()

    await seedBalance(context, toWorkforceEmployeeId(5), 100)

    const rewardId = await seedReward(context, { pointCost: 50, stock: 1 })

    const repository = new ThanksRedemptionRepository(context)

    const created = await repository.createIfSufficientBalance(
      ThanksRedemption.create({
        employeeId: toWorkforceEmployeeId(5),
        rewardId,
        pointCost: 50,
        createdAt: "2026-01-02T00:00:00.000Z",
      }),
    )

    expect(created).toBeInstanceOf(ThanksRedemption)
  })

  // 在庫チェックは service の事前 SELECT だけでなく INSERT の WHERE にも畳み込まれている（TOCTOU 対策）。
  // 事前チェックを通過した後に在庫が 0 になった競合状況を、リポジトリ直叩きで再現する。
  test("rejects with out_of_stock when the reward stock is zero at INSERT time", async () => {
    const { context } = await createTestContext()

    await seedBalance(context, toWorkforceEmployeeId(5), 100)

    const rewardId = await seedReward(context, { pointCost: 50, stock: 0 })

    const repository = new ThanksRedemptionRepository(context)

    const created = await repository.createIfSufficientBalance(
      ThanksRedemption.create({
        employeeId: toWorkforceEmployeeId(5),
        rewardId,
        pointCost: 50,
        createdAt: "2026-01-02T00:00:00.000Z",
      }),
    )

    expect(created).toEqual({ reason: "out_of_stock" })
  })

  test("treats null stock as unlimited", async () => {
    const { context } = await createTestContext()

    await seedBalance(context, toWorkforceEmployeeId(5), 100)

    const rewardId = await seedReward(context, { pointCost: 50, stock: null })

    const repository = new ThanksRedemptionRepository(context)

    const created = await repository.createIfSufficientBalance(
      ThanksRedemption.create({
        employeeId: toWorkforceEmployeeId(5),
        rewardId,
        pointCost: 50,
        createdAt: "2026-01-02T00:00:00.000Z",
      }),
    )

    expect(created).toBeInstanceOf(ThanksRedemption)
  })

  test("rejects with insufficient_balance when the balance is short", async () => {
    const { context } = await createTestContext()

    await seedBalance(context, toWorkforceEmployeeId(5), 30)

    const rewardId = await seedReward(context, { pointCost: 50, stock: 1 })

    const repository = new ThanksRedemptionRepository(context)

    const created = await repository.createIfSufficientBalance(
      ThanksRedemption.create({
        employeeId: toWorkforceEmployeeId(5),
        rewardId,
        pointCost: 50,
        createdAt: "2026-01-02T00:00:00.000Z",
      }),
    )

    expect(created).toEqual({ reason: "insufficient_balance" })
  })
})
