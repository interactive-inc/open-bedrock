import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { ThanksRedemption } from "@/contexts/thanks/domain/entities/thanks-redemption.entity"
import { ThanksReward } from "@/contexts/thanks/domain/entities/thanks-reward.entity"
import type { ThanksError } from "@/contexts/thanks/domain/errors"

type RewardFields = ConstructorParameters<typeof ThanksReward>[0]

type RedemptionFields = ConstructorParameters<typeof ThanksRedemption>[0]

/** Entityの公開fieldだけから複製する。instanceをspreadすると内部のpropsまで写るため使わない。 */
function rewardWith(reward: ThanksReward, overrides: Partial<RewardFields>): ThanksReward {
  return new ThanksReward({
    id: reward.id,
    name: reward.name,
    pointCost: reward.pointCost,
    isActive: reward.isActive,
    stock: reward.stock,
    createdAt: reward.createdAt,
    ...overrides,
  })
}

function redemptionWith(
  redemption: ThanksRedemption,
  overrides: Partial<RedemptionFields>,
): ThanksRedemption {
  return new ThanksRedemption({
    id: redemption.id,
    employeeId: redemption.employeeId,
    rewardId: redemption.rewardId,
    pointCost: redemption.pointCost,
    status: redemption.status,
    createdAt: redemption.createdAt,
    decidedAt: redemption.decidedAt,
    deciderId: redemption.deciderId,
    ...overrides,
  })
}

/**
 * 交換カタログと交換申請のRepositoryを、Domain modelだけを持つ型付きfakeにする。
 * Repositoryが返す結果の契約（残高不足・在庫切れ・pending重複・決裁済み）だけを再現し、SQLは再現しない。
 * 条件付きINSERT・UPDATEのSQLは thanks-redemption.repository.d1.test.ts がローカルD1で検証する。
 */
export class FakeThanksPoints {
  readonly rewards = new Map<string, ThanksReward>()

  readonly redemptions = new Map<string, ThanksRedemption>()

  private readonly received = new Map<EmployeeId, number>()

  /** 判断者のCompany上の資格の解決結果。nullなら許可し、確定時の再検査文は持たない。 */
  authorityError: ThanksError | null = null

  readonly decisionAuthority = {
    prepare: async () => this.authorityError ?? { guards: [] },
  }

  private rewardSerial = 0

  private redemptionSerial = 0

  /** 採番順が辞書順にも一致する固定の UUID を返す。 */
  private nextRewardId(): string {
    this.rewardSerial += 1
    return `0190002a-0000-7000-8000-${this.rewardSerial.toString(16).padStart(12, "0")}`
  }

  private nextRedemptionId(): string {
    this.redemptionSerial += 1
    return `0190002b-0000-7000-8000-${this.redemptionSerial.toString(16).padStart(12, "0")}`
  }

  seedBalance(employeeId: EmployeeId, points: number): void {
    this.received.set(employeeId, (this.received.get(employeeId) ?? 0) + points)
  }

  seedReward(props: { pointCost: number; stock: number | null; isActive?: boolean }): string {
    const id = this.nextRewardId()
    this.rewards.set(
      id,
      new ThanksReward({
        id,
        name: "景品",
        pointCost: props.pointCost,
        isActive: props.isActive ?? true,
        stock: props.stock,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )
    return id
  }

  seedRedemption(props: {
    employeeId: EmployeeId
    rewardId: string
    pointCost: number
    status: "pending" | "fulfilled" | "rejected"
  }): ThanksRedemption {
    const id = this.nextRedemptionId()
    const redemption = new ThanksRedemption({
      id,
      employeeId: props.employeeId,
      rewardId: props.rewardId,
      pointCost: props.pointCost,
      status: props.status,
      createdAt: "2026-01-15T00:00:00.000Z",
      decidedAt: null,
      deciderId: null,
    })
    this.redemptions.set(id, redemption)
    return redemption
  }

  private balanceOf(employeeId: EmployeeId, excludedRedemptionId: string | null): number {
    let reserved = 0
    for (const redemption of this.redemptions.values()) {
      if (redemption.employeeId !== employeeId || redemption.id === excludedRedemptionId) continue
      if (redemption.status === "rejected") continue
      reserved += redemption.pointCost
    }
    return (this.received.get(employeeId) ?? 0) - reserved
  }

  readonly rewardRepository = {
    findById: async (rewardId: string) => this.rewards.get(rewardId) ?? null,
    create: async (reward: ThanksReward) => {
      const id = this.nextRewardId()
      const created = rewardWith(reward, { id })
      this.rewards.set(id, created)
      return created
    },
    updateWithoutStock: async (reward: ThanksReward) => {
      if (reward.id === null) return null
      const current = this.rewards.get(reward.id)
      if (current === undefined) return null
      const updated = rewardWith(reward, { stock: current.stock })
      this.rewards.set(reward.id, updated)
      return updated
    },
  }

  readonly redemptionRepository = {
    findById: async (redemptionId: string) => this.redemptions.get(redemptionId) ?? null,
    createIfSufficientBalance: async (redemption: ThanksRedemption) => {
      const reward = this.rewards.get(redemption.rewardId)
      if (reward === undefined || !reward.isActive) return { reason: "reward_inactive" as const }
      if (reward.stock !== null && reward.stock <= 0) return { reason: "out_of_stock" as const }
      const pending = [...this.redemptions.values()].some(
        (existing) =>
          existing.employeeId === redemption.employeeId && existing.status === "pending",
      )
      if (pending) return { reason: "pending_exists" as const }
      if (this.balanceOf(redemption.employeeId, null) < redemption.pointCost) {
        return { reason: "insufficient_balance" as const }
      }
      const id = this.nextRedemptionId()
      const created = redemptionWith(redemption, { id })
      this.redemptions.set(id, created)
      return created
    },
    approveFromPending: async (props: {
      redemptionId: string
      employeeId: EmployeeId
      rewardId: string
      deciderId: EmployeeId
      decidedAt: string
    }) => {
      const current = this.redemptions.get(props.redemptionId)
      const reward = this.rewards.get(props.rewardId)
      if (current === undefined || current.status !== "pending" || reward === undefined) return null
      if (reward.stock !== null && reward.stock <= 0) return null
      if (this.balanceOf(props.employeeId, props.redemptionId) < current.pointCost) return null
      if (reward.stock !== null) {
        this.rewards.set(
          reward.id ?? props.rewardId,
          rewardWith(reward, { stock: reward.stock - 1 }),
        )
      }
      const fulfilled = redemptionWith(current, {
        status: "fulfilled",
        decidedAt: props.decidedAt,
        deciderId: props.deciderId,
      })
      this.redemptions.set(props.redemptionId, fulfilled)
      return fulfilled
    },
    rejectFromPending: async (props: {
      redemptionId: string
      deciderId: EmployeeId
      decidedAt: string
    }) => {
      const current = this.redemptions.get(props.redemptionId)
      if (current === undefined || current.status !== "pending") return null
      const rejected = redemptionWith(current, {
        status: "rejected",
        decidedAt: props.decidedAt,
        deciderId: props.deciderId,
      })
      this.redemptions.set(props.redemptionId, rejected)
      return rejected
    },
  }
}
