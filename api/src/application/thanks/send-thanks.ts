import { Notification } from "@/domain/notification/notification"
import { Thanks } from "@/domain/thanks/thanks"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { NotificationRepository } from "@/infrastructure/notification/notification-repository"
import { ThanksRepository } from "@/infrastructure/thanks/thanks-repository"

export type Command = {
  senderEmployeeId: number
  recipientEmployeeCode: string
  message: string
  createdAt: string
}

export type SenderNotFound = { reason: "sender_not_found" }

export type RecipientNotFound = { reason: "recipient_not_found" }

export type InvalidThanks = { reason: "invalid_thanks" }

/**
 * 全従業員が他の従業員へ感謝を送る。感謝を保存し、受信者にだけ通知を作成する。
 * 既存 SendNotification の role gate は感謝に不適合なため NotificationRepository を直接使う。
 */
export class SendThanks {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Thanks | SenderNotFound | RecipientNotFound | InvalidThanks | Error> {
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

    const thanks = Thanks.create({
      senderEmployeeId: sender.id,
      recipientEmployeeId: recipient.id,
      message: command.message,
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
}
