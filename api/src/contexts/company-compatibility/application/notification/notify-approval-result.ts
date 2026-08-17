import type { Notification } from "@/api/legacy-system/model/notifications/legacy-notification.entity"
import type { Context } from "@/env"
import { EmployeeNotificationGateway } from "@/contexts/company-compatibility/infrastructure/company/notifications/employee-notification.gateway"

export type Command = {
  recipientEmployeeId: number
  action: "approve" | "reject"
  subjectLabel: string
  sourceDomain: string
  sourceId: number | null
  createdAt: string
}

/**
 * 承認・却下の結果を申請者へ通知する。決定の確定後に best-effort で呼ぶ前提で、
 * 通知の失敗は Error を返すだけにし、決定そのものは巻き戻さない。
 */
export class NotifyApprovalResult {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Notification | Error> {
    const title =
      command.action === "approve"
        ? `${command.subjectLabel}が承認されました`
        : `${command.subjectLabel}が却下されました`

    return await new EmployeeNotificationGateway(this.c).create({
      recipientEmployeeId: command.recipientEmployeeId,
      kind: "approval_result",
      title,
      body: null,
      sourceDomain: command.sourceDomain,
      sourceId: command.sourceId,
      createdAt: command.createdAt,
    })
  }
}
