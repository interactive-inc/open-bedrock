import { Notification } from "@/domain/notification/notification"
import { Thanks } from "@/domain/thanks/thanks"
import { periodOf } from "@/domain/thanks-points/period-of"
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

    // メッセージ等の不変条件は原資の予約より前に検証し、不正入力で原資を消費しないようにする。
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

    const period = periodOf(command.createdAt)

    const reserved = await this.reserveBudget({
      senderEmployeeId: sender.id,
      points,
      period,
      createdAt: command.createdAt,
    })

    if (reserved instanceof Error) {
      return reserved
    }

    if (reserved !== null) {
      return reserved
    }

    const created = await thanksRepository.create(thanks)

    if (created instanceof Error) {
      // 感謝の保存に失敗したら予約した原資を戻す（消費だけ進む不整合を避ける）。
      if (points > 0) {
        await new ThanksPointBudgetRepository(this.c).release({
          employeeId: sender.id,
          period,
          points,
        })
      }

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

  // 当月の贈与原資を原子的に予約する。points が 0 ならチェック不要で null。
  // budget が無ければ既定額で遅延生成し、残量を確定 UPDATE の WHERE に畳み込んで消費する。
  // 残量不足は InsufficientBudget、取得失敗は Error、予約できたら null を返す。
  private async reserveBudget(props: {
    senderEmployeeId: number
    points: number
    period: string
    createdAt: string
  }): Promise<InsufficientBudget | Error | null> {
    if (props.points === 0) {
      return null
    }

    const budgetRepository = new ThanksPointBudgetRepository(this.c)

    const budget = await budgetRepository.findOrCreate({
      employeeId: props.senderEmployeeId,
      period: props.period,
      createdAt: props.createdAt,
    })

    if (budget instanceof Error) {
      return budget
    }

    const outcome = await budgetRepository.consume({
      employeeId: props.senderEmployeeId,
      period: props.period,
      points: props.points,
    })

    if (outcome instanceof Error) {
      return outcome
    }

    return outcome === "insufficient" ? { reason: "insufficient_budget" } : null
  }
}
