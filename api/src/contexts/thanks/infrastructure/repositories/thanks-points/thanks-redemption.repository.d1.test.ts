import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { ApproveRedemption } from "@/contexts/thanks/application/thanks-points/approve-redemption"
import { RejectRedemption } from "@/contexts/thanks/application/thanks-points/reject-redemption"
import { RequestRedemption } from "@/contexts/thanks/application/thanks-points/request-redemption"
import { ThanksRedemption } from "@/contexts/thanks/domain/entities/thanks-redemption.entity"
import { ThanksRedemptionDecisionAuthorityAdapter } from "@/contexts/thanks/infrastructure/adapters/thanks-redemption-decision-authority.adapter"
import { ThanksRedemptionRepository } from "@/contexts/thanks/infrastructure/repositories/thanks-points/thanks-redemption.repository"
import { ThanksRewardRepository } from "@/contexts/thanks/infrastructure/repositories/thanks-points/thanks-reward.repository"
import {
  thanks,
  thanksRedemptions,
  thanksRewards,
} from "@/contexts/thanks/infrastructure/schema/thanks"
import type { Context } from "@/env"
import { ConflictError } from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { makeTestSession } from "@tests/api/support/make-test-session"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({ migrated: ["lifecycle", "stock-race", "balance-race"] })
})

afterAll(async () => {
  await local.dispose()
})

async function seedBalance(context: Context, employeeId: EmployeeId, points: number) {
  await context.var.database.insert(thanks).values({
    senderEmployeeId: toWorkforceEmployeeId(99),
    recipientEmployeeId: employeeId,
    message: "テスト",
    points,
    createdAt: "2026-01-01T00:00:00.000Z",
  })
}

async function seedReward(context: Context, props: { pointCost: number; stock: number | null }) {
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

  if (row === undefined) throw new Error("failed to seed reward")

  return row.id
}

function ports(context: Context) {
  return {
    rewardRepository: new ThanksRewardRepository(context),
    redemptionRepository: new ThanksRedemptionRepository(context),
    decisionAuthority: new ThanksRedemptionDecisionAuthorityAdapter(context),
  }
}

async function requestPending(context: Context, employeeId: number, rewardId: number) {
  const pending = await new RequestRedemption(ports(context)).run({
    employeeId: toWorkforceEmployeeId(employeeId),
    rewardId,
    createdAt: "2026-02-01T00:00:00.000Z",
  })

  if (!(pending instanceof ThanksRedemption)) throw new Error("expected ThanksRedemption")

  return pending
}

async function stockOf(context: Context, rewardId: number) {
  const reward = await new ThanksRewardRepository(context).findById(rewardId)

  if (reward instanceof Error || reward === null) throw new Error("reward not found")

  return reward.stock
}

describe("thanks redemption SQL on local D1", () => {
  test("rejects a duplicate pending request, decrements stock on approve and refuses a later reject", async () => {
    const { context } = await createLocalD1Context(local, "lifecycle", {
      withCompanyOrganization: true,
    })

    await seedBalance(context, toWorkforceEmployeeId(5), 200)

    const rewardId = await seedReward(context, { pointCost: 50, stock: 3 })

    const pending = await requestPending(context, 5, rewardId)

    const duplicate = await new RequestRedemption(ports(context)).run({
      employeeId: toWorkforceEmployeeId(5),
      rewardId,
      createdAt: "2026-02-02T00:00:00.000Z",
    })

    expectApplicationError(duplicate, ConflictError, "pending_exists")

    const approved = await new ApproveRedemption(ports(context)).execute({
      session: makeTestSession("root"),
      redemptionId: pending.id ?? 0,
      deciderId: toWorkforceEmployeeId(2),
      decidedAt: "2026-02-02T00:00:00.000Z",
    })

    if (!(approved instanceof ThanksRedemption)) throw new Error("expected ThanksRedemption")

    expect(approved.status).toBe("fulfilled")
    expect(await stockOf(context, rewardId)).toBe(2)

    const rejected = await new RejectRedemption(ports(context)).execute({
      session: makeTestSession("root"),
      redemptionId: pending.id ?? 0,
      deciderId: toWorkforceEmployeeId(2),
      decidedAt: "2026-02-03T00:00:00.000Z",
    })

    expectApplicationError(rejected, ConflictError, "already_decided")
  })

  test("returns out_of_stock when stock is consumed between request and approve", async () => {
    const { context } = await createLocalD1Context(local, "stock-race", {
      withCompanyOrganization: true,
    })

    await seedBalance(context, toWorkforceEmployeeId(5), 100)
    await seedBalance(context, toWorkforceEmployeeId(6), 100)

    const rewardId = await seedReward(context, { pointCost: 50, stock: 1 })

    const firstPending = await requestPending(context, 5, rewardId)
    const secondPending = await requestPending(context, 6, rewardId)

    const first = await new ApproveRedemption(ports(context)).execute({
      session: makeTestSession("root"),
      redemptionId: firstPending.id ?? 0,
      deciderId: toWorkforceEmployeeId(2),
      decidedAt: "2026-02-02T00:00:00.000Z",
    })

    expect(first).toBeInstanceOf(ThanksRedemption)

    const second = await new ApproveRedemption(ports(context)).execute({
      session: makeTestSession("root"),
      redemptionId: secondPending.id ?? 0,
      deciderId: toWorkforceEmployeeId(2),
      decidedAt: "2026-02-02T00:01:00.000Z",
    })

    if (second instanceof Error || second instanceof ThanksRedemption) {
      throw new Error("expected a reason result")
    }

    expect(second.reason).toBe("out_of_stock")
    expect(await stockOf(context, rewardId)).toBe(0)
  })

  test("re-checks balance on approve and reward activity on insert", async () => {
    const { context } = await createLocalD1Context(local, "balance-race", {
      withCompanyOrganization: true,
    })

    // 残高 50 ぴったりで申請する。approve 時は自身の pending を除外して再計算する。
    await seedBalance(context, toWorkforceEmployeeId(5), 50)

    const rewardId = await seedReward(context, { pointCost: 50, stock: 3 })

    const pending = await requestPending(context, 5, rewardId)

    // 別の fulfilled 行で残高を食いつぶす
    await context.var.database.insert(thanksRedemptions).values({
      employeeId: toWorkforceEmployeeId(5),
      rewardId,
      pointCost: 50,
      status: "fulfilled",
      createdAt: "2026-01-15T00:00:00.000Z",
      decidedAt: "2026-01-16T00:00:00.000Z",
      deciderId: toWorkforceEmployeeId(2),
    })

    const result = await new ApproveRedemption(ports(context)).execute({
      session: makeTestSession("root"),
      redemptionId: pending.id ?? 0,
      deciderId: toWorkforceEmployeeId(2),
      decidedAt: "2026-02-02T00:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "insufficient_balance")

    // 事前チェック後に無効化された報酬は、条件付きINSERTが isActive を再確認して弾く。
    await seedBalance(context, toWorkforceEmployeeId(6), 100)
    await context.var.database
      .update(thanksRewards)
      .set({ isActive: false })
      .where(eq(thanksRewards.id, rewardId))

    const inserted = await new ThanksRedemptionRepository(context).createIfSufficientBalance(
      ThanksRedemption.create({
        employeeId: toWorkforceEmployeeId(6),
        rewardId,
        pointCost: 50,
        createdAt: "2026-02-03T00:00:00.000Z",
      }),
    )

    expect(inserted).toEqual({ reason: "reward_inactive" })
  })
})
