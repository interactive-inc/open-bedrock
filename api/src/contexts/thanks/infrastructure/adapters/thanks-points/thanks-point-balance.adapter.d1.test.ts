import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { ThanksPointBalanceAdapter } from "@/contexts/thanks/infrastructure/adapters/thanks-points/thanks-point-balance.adapter"
import {
  thanks,
  thanksPointBudgets,
  thanksRedemptions,
  thanksRewards,
} from "@/contexts/thanks/infrastructure/schema/thanks"
import type { RedemptionStatus } from "@/contexts/thanks/domain/definitions/redemption-status.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import type { Context } from "@/env"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { startLocalD1, type LocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: [
      "returns-0-when-nothing-has-been-received",
      "sums-received-points",
      "counts-only-points-received-by-the-given",
      "deducts-fulfilled-redemptions",
      "deducts-pending-redemptions-so-reserved-points",
      "does-not-deduct-rejected-redemptions",
      "deducts-only-the-given-employee",
      "ignores-the-monthly-sending-budget-entirely",
    ],
  })
})

afterAll(async () => {
  await local.dispose()
})

/** 受領を作る（recipient に points を贈る thanks 行を直接挿入する）。 */
async function seedReceived(
  context: Context,
  recipientEmployeeId: EmployeeId,
  points: number,
): Promise<void> {
  await context.var.database.insert(thanks).values({
    id: crypto.randomUUID(),
    senderEmployeeId: toWorkforceEmployeeId(99),
    recipientEmployeeId,
    message: "テスト",
    points,
    createdAt: "2026-01-01T00:00:00.000Z",
  })
}

/** 任意のステータスの交換を作る。差し引き対象の判定を確かめるために使う。 */
async function seedRedemption(
  context: Context,
  props: { employeeId: number; pointCost: number; status: RedemptionStatus },
): Promise<void> {
  const rewardRows = await context.var.database
    .insert(thanksRewards)
    .values({
      id: crypto.randomUUID(),
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
    id: crypto.randomUUID(),
    employeeId: toWorkforceEmployeeId(props.employeeId),
    rewardId,
    pointCost: props.pointCost,
    status: props.status,
    createdAt: "2026-01-01T00:00:00.000Z",
    decidedAt: null,
    deciderId: null,
  })
}

describe("ThanksPointBalanceAdapter.getBalance", () => {
  test("returns 0 when nothing has been received", async () => {
    const { context } = await createLocalD1Context(
      local,
      "returns-0-when-nothing-has-been-received",
    )

    const balance = await new ThanksPointBalanceAdapter(context).getBalance(
      toWorkforceEmployeeId(5),
    )

    expect(balance).toBe(0)
  })

  test("sums received points", async () => {
    const { context } = await createLocalD1Context(local, "sums-received-points")

    await seedReceived(context, toWorkforceEmployeeId(5), 100)
    await seedReceived(context, toWorkforceEmployeeId(5), 20)

    const balance = await new ThanksPointBalanceAdapter(context).getBalance(
      toWorkforceEmployeeId(5),
    )

    expect(balance).toBe(120)
  })

  test("counts only points received by the given employee", async () => {
    const { context } = await createLocalD1Context(
      local,
      "counts-only-points-received-by-the-given",
    )

    await seedReceived(context, toWorkforceEmployeeId(5), 100)
    await seedReceived(context, toWorkforceEmployeeId(6), 999)

    const balance = await new ThanksPointBalanceAdapter(context).getBalance(
      toWorkforceEmployeeId(5),
    )

    expect(balance).toBe(100)
  })

  test("deducts fulfilled redemptions", async () => {
    const { context } = await createLocalD1Context(local, "deducts-fulfilled-redemptions")

    await seedReceived(context, toWorkforceEmployeeId(5), 100)
    await seedRedemption(context, { employeeId: 5, pointCost: 30, status: "fulfilled" })

    const balance = await new ThanksPointBalanceAdapter(context).getBalance(
      toWorkforceEmployeeId(5),
    )

    expect(balance).toBe(70)
  })

  test("deducts pending redemptions so reserved points cannot be spent twice", async () => {
    const { context } = await createLocalD1Context(
      local,
      "deducts-pending-redemptions-so-reserved-points",
    )

    await seedReceived(context, toWorkforceEmployeeId(5), 100)
    await seedRedemption(context, { employeeId: 5, pointCost: 30, status: "pending" })

    const balance = await new ThanksPointBalanceAdapter(context).getBalance(
      toWorkforceEmployeeId(5),
    )

    expect(balance).toBe(70)
  })

  test("does not deduct rejected redemptions", async () => {
    const { context } = await createLocalD1Context(local, "does-not-deduct-rejected-redemptions")

    await seedReceived(context, toWorkforceEmployeeId(5), 100)
    await seedRedemption(context, { employeeId: 5, pointCost: 30, status: "rejected" })

    const balance = await new ThanksPointBalanceAdapter(context).getBalance(
      toWorkforceEmployeeId(5),
    )

    expect(balance).toBe(100)
  })

  test("deducts only the given employee's redemptions", async () => {
    const { context } = await createLocalD1Context(local, "deducts-only-the-given-employee")

    await seedReceived(context, toWorkforceEmployeeId(5), 100)
    await seedRedemption(context, { employeeId: 6, pointCost: 30, status: "fulfilled" })

    const balance = await new ThanksPointBalanceAdapter(context).getBalance(
      toWorkforceEmployeeId(5),
    )

    expect(balance).toBe(100)
  })

  // 受領残高は当月原資と別概念。原資をいくら積んでも受領残高は動かない。
  test("ignores the monthly sending budget entirely", async () => {
    const { context } = await createLocalD1Context(
      local,
      "ignores-the-monthly-sending-budget-entirely",
    )

    await context.var.database.insert(thanksPointBudgets).values({
      id: crypto.randomUUID(),
      employeeId: toWorkforceEmployeeId(5),
      period: "2026-01",
      grantedPoints: 400,
      consumedPoints: 250,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    const balance = await new ThanksPointBalanceAdapter(context).getBalance(
      toWorkforceEmployeeId(5),
    )

    expect(balance).toBe(0)
  })
})
