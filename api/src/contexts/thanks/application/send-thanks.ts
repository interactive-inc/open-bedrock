import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { Thanks } from "@/contexts/thanks/domain/entities/thanks.entity"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  ValidationError,
} from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { periodOf } from "@/contexts/thanks/domain/definitions/thanks-period.definition"
import { toNonNegativePoints } from "@/contexts/thanks/domain/policies/non-negative-points.policy"
import type { Context as HonoContext } from "@/env"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { ThanksPointBudgetRepository } from "@/contexts/thanks/infrastructure/repositories/thanks-points/thanks-point-budget.repository"
import { ThanksRepository } from "@/contexts/thanks/infrastructure/repositories/thanks.repository"

export type Command = {
  senderEmployeeId: EmployeeId
  recipientEmployeeCode: string
  message: string
  points: number | null
  createdAt: string
}

type Context = Readonly<{
  context: HonoContext
  publishEmployeeNotification?: (notification: {
    recipientEmployeeId: EmployeeId
    kind: "thanks"
    title: string
    body: string | null
    sourceDomain: string
    sourceId: number | null
    createdAt: string
  }) => Promise<unknown>
}>

/**
 * 全従業員が他の従業員へ感謝を送る。感謝を保存し、受信者にだけ通知を作成する。
 * 既存 PublishEmployeeNotification の role gate は感謝に不適合なため Company gateway を直接使う。
 */
export class SendThanks {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Thanks | ApplicationError> {
    const employeeRepository = new CompanyEmployeeDirectoryReadAdapter(this.c.context)

    const sender = await employeeRepository.findById(command.senderEmployeeId)

    if (sender instanceof Error) {
      return new UnexpectedError("failed to find sender", { cause: sender })
    }

    // 送信者はセッションから解決済みのはずなので、不在は想定外の内部状態。
    if (sender === null) {
      return new UnexpectedError("sender not found")
    }

    if (
      sender.employment === null ||
      (sender.employment.status !== "ACTIVE" && sender.employment.status !== "ON_LEAVE")
    ) {
      return new ForbiddenError("sender is no longer active", "sender_inactive")
    }

    const recipient = await employeeRepository.findByCode(command.recipientEmployeeCode)

    if (recipient instanceof Error) {
      return new UnexpectedError("failed to find recipient", { cause: recipient })
    }

    if (recipient === null) {
      return new NotFoundError("recipient not found", "recipient_not_found")
    }

    if (
      recipient.employment === null ||
      (recipient.employment.status !== "ACTIVE" && recipient.employment.status !== "ON_LEAVE")
    ) {
      return new ConflictError("recipient is no longer active", "recipient_inactive")
    }

    if (sender.id === recipient.id) {
      return new ValidationError("cannot send thanks to yourself", "self_thanks")
    }

    const points = toNonNegativePoints(command.points)

    if (points instanceof Error) {
      return new ValidationError("invalid points", "invalid_points")
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
      return new ValidationError("invalid thanks", "invalid_thanks")
    }

    const period = periodOf(command.createdAt)

    // ポイント付きの場合は原資レコードを遅延生成しておく（batch 前に存在を保証する）。
    if (points > 0) {
      const ensured = await this.ensureBudget({
        senderEmployeeId: sender.id,
        period,
        createdAt: command.createdAt,
      })

      if (ensured instanceof Error) {
        return ensured
      }
    }

    // ポイント消費と感謝 INSERT を D1 batch でアトミックに実行する。
    // batch 内のいずれかが失敗すれば全体がロールバックされるため補償処理は不要。
    const created = await new ThanksRepository(this.c.context).consumeBudgetAndCreate({
      thanksRecord: thanks,
      period,
    })

    if (created instanceof Error) {
      return new UnexpectedError("failed to send thanks", { cause: created })
    }

    if (created === null) {
      return new ValidationError("insufficient thanks point budget", "insufficient_budget")
    }

    const notified = await this.c.publishEmployeeNotification?.({
      recipientEmployeeId: recipient.id,
      kind: "thanks",
      title: `${sender.officialName}さんから感謝が届きました`,
      body: created.message,
      sourceDomain: "thanks",
      sourceId: created.id,
      createdAt: command.createdAt,
    })

    // 通知作成はベストエフォート。感謝は保存済みなので、通知が失敗してもログのみ残して感謝を返す。
    // ここでエラーを返すと「保存済みなのに失敗応答」になり再送＝二重登録を招くため。
    if (notified instanceof Error) {
      console.error("failed to create thanks notification", notified)
    }

    return created
  }

  /** 当月の原資レコードが存在しなければ既定額で遅延生成する（batch 前に存在を保証する）。 */
  private async ensureBudget(props: {
    senderEmployeeId: EmployeeId
    period: string
    createdAt: string
  }): Promise<null | ApplicationError> {
    const budgetRepository = new ThanksPointBudgetRepository(this.c.context)

    const budget = await budgetRepository.findOrCreate({
      employeeId: props.senderEmployeeId,
      period: props.period,
      createdAt: props.createdAt,
    })

    return budget instanceof Error
      ? new UnexpectedError("failed to ensure thanks point budget", { cause: budget })
      : null
  }
}
