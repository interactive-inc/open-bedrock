import { Notification } from "@/domain/notification/notification"
import { Thanks } from "@/domain/thanks/thanks"
import { periodOf } from "@/domain/thanks-points/period-of"
import { remainingBudgetPoints } from "@/domain/thanks-points/remaining-budget-points"
import { toNonNegativePoints } from "@/domain/thanks-points/to-non-negative-points"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { NotificationRepository } from "@/infrastructure/notification/notification-repository"
import { ThanksPointBudgetRepository } from "@/infrastructure/thanks-points/thanks-point-budget-repository"
import { ThanksRepository } from "@/infrastructure/thanks/thanks-repository"

export type Command = {
  senderEmployeeId: number
  recipientEmployeeCode: string
  message: string
  points: number | null
  createdAt: string
}

export type SenderNotFound = { reason: "sender_not_found" }

export type RecipientNotFound = { reason: "recipient_not_found" }

export type InvalidThanks = { reason: "invalid_thanks" }

export type InvalidPoints = { reason: "invalid_points" }

export type InsufficientBudget = { reason: "insufficient_budget" }

/**
 * 全従業員が他の従業員へ感謝を送る。感謝を保存し、受信者にだけ通知を作成する。
 * 既存 SendNotification の role gate は感謝に不適合なため NotificationRepository を直接使う。
 */
export class SendThanks {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<
    | Thanks
    | SenderNotFound
    | RecipientNotFound
    | InvalidThanks
    | InvalidPoints
    | InsufficientBudget
    | Error
  > {
    const employeeRepository = new EmployeeRepository(this.c)

    const thanksRepository = new ThanksRepository(this.c)

    const notificationRepository = new NotificationRepository(this.c)

    const sender = await employeeRepository.findById(command.senderEmployeeId)

    if (sender instanceof Error) {
      return sender
    }

    if (sender === null) {
      return { reason: "sender_not_found" }
    }

    const recipient = await employeeRepository.findByCode(command.recipientEmployeeCode)

    if (recipient instanceof Error) {
      return recipient
    }

    if (recipient === null) {
      return { reason: "recipient_not_found" }
    }

    const points = toNonNegativePoints(command.points)

    if (points instanceof Error) {
      return { reason: "invalid_points" }
    }

    const budgetCheck = await this.assertBudget({
      senderEmployeeId: sender.id,
      points,
      createdAt: command.createdAt,
    })

    if (budgetCheck instanceof Error) {
      return budgetCheck
    }

    if (budgetCheck !== null) {
      return budgetCheck
    }

    const thanks = Thanks.create({
      senderEmployeeId: sender.id,
      recipientEmployeeId: recipient.id,
      message: command.message,
      points,
      createdAt: command.createdAt,
    })

    if (thanks instanceof Error) {
      return { reason: "invalid_thanks" }
    }

    const created = await thanksRepository.create(thanks)

    if (created instanceof Error) {
      return created
    }

    const notification = Notification.create({
      recipientEmployeeId: recipient.id,
      kind: "thanks",
      title: `${sender.name}さんから感謝が届きました`,
      body: created.message,
      sourceDomain: "thanks",
      sourceId: created.id,
      createdAt: command.createdAt,
    })

    const notified = await notificationRepository.create(notification)

    // 通知作成はベストエフォート。感謝は保存済みなので、通知が失敗してもログのみ残して感謝を返す。
    // ここでエラーを返すと「保存済みなのに失敗応答」になり再送＝二重登録を招くため。
    if (notified instanceof Error) {
      console.error("failed to create thanks notification", notified)
    }

    return created
  }

  // 当月の贈与原資の残量を確認する。points が 0 ならチェック不要で null。
  // 残量不足は InsufficientBudget、取得失敗は Error、問題なければ null を返す。
  // budget は当月分が無ければ既定額で遅延生成する（月初バッチに依存しない）。
  private async assertBudget(props: {
    senderEmployeeId: number
    points: number
    createdAt: string
  }): Promise<InsufficientBudget | Error | null> {
    if (props.points === 0) {
      return null
    }

    const budgetRepository = new ThanksPointBudgetRepository(this.c)

    const period = periodOf(props.createdAt)

    const budget = await budgetRepository.findOrCreate({
      employeeId: props.senderEmployeeId,
      period,
      createdAt: props.createdAt,
    })

    if (budget instanceof Error) {
      return budget
    }

    const grantedThisMonth = await budgetRepository.getGrantedThisMonth({
      employeeId: props.senderEmployeeId,
      period,
    })

    if (grantedThisMonth instanceof Error) {
      return grantedThisMonth
    }

    const remaining = remainingBudgetPoints({
      grantedPoints: budget.grantedPoints,
      grantedThisMonth,
    })

    if (props.points > remaining) {
      return { reason: "insufficient_budget" }
    }

    return null
  }
}
