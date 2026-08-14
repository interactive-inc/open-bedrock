import { Thanks, thanksRowSchema } from "@/contexts/company/domain/thanks/thanks.entity"
import { parseD1Row } from "@/contexts/company/infrastructure/shared/parse-d1-row"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  ValidationError,
} from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { periodOf } from "@/lib/thanks-points/period-of"
import { toNonNegativePoints } from "@/contexts/company/application/thanks/to-non-negative-points"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/contexts/company/infrastructure/employee/employee-repository"
import { EmployeeNotificationGateway } from "@/contexts/company/infrastructure/company/notifications/employee-notification.gateway"
import { ThanksPointBudgetRepository } from "@/contexts/company/infrastructure/thanks-points/thanks-point-budget-repository"

export type Command = {
  senderEmployeeId: number
  recipientEmployeeCode: string
  message: string
  points: number | null
  createdAt: string
}

/**
 * 全従業員が他の従業員へ感謝を送る。感謝を保存し、受信者にだけ通知を作成する。
 * 既存 SendNotification の role gate は感謝に不適合なため Company gateway を直接使う。
 */
export class SendThanks {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Thanks | ApplicationError> {
    const employeeRepository = new EmployeeRepository(this.c)

    const notificationGateway = new EmployeeNotificationGateway(this.c)

    const sender = await employeeRepository.findById(command.senderEmployeeId)

    if (sender instanceof Error) {
      return new UnexpectedError("failed to find sender", { cause: sender })
    }

    // 送信者はセッションから解決済みのはずなので、不在は想定外の内部状態。
    if (sender === null) {
      return new UnexpectedError("sender not found")
    }

    if (sender.status === "retired") {
      return new ForbiddenError("sender is no longer active", "sender_inactive")
    }

    const recipient = await employeeRepository.findByCode(command.recipientEmployeeCode)

    if (recipient instanceof Error) {
      return new UnexpectedError("failed to find recipient", { cause: recipient })
    }

    if (recipient === null) {
      return new NotFoundError("recipient not found", "recipient_not_found")
    }

    if (recipient.status === "retired") {
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
    const created = await this.consumeAndInsert({
      thanks,
      senderEmployeeId: sender.id,
      points,
      period,
    })

    if (created instanceof Error) {
      return created
    }

    if (created === null) {
      return new ValidationError("insufficient thanks point budget", "insufficient_budget")
    }

    const notified = await notificationGateway.create({
      recipientEmployeeId: recipient.id,
      kind: "thanks",
      title: `${sender.name}さんから感謝が届きました`,
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
    senderEmployeeId: number
    period: string
    createdAt: string
  }): Promise<null | ApplicationError> {
    const budgetRepository = new ThanksPointBudgetRepository(this.c)

    const budget = await budgetRepository.findOrCreate({
      employeeId: props.senderEmployeeId,
      period: props.period,
      createdAt: props.createdAt,
    })

    return budget instanceof Error
      ? new UnexpectedError("failed to ensure thanks point budget", { cause: budget })
      : null
  }

  /**
   * ポイント消費（points > 0 の場合）と感謝 INSERT を D1 batch でアトミックに実行する。
   * batch は暗黙のトランザクションで包まれるため、INSERT が失敗しても consume は自動ロールバックされる。
   * ポイント付きの場合、INSERT は「consume UPDATE が 1 行以上更新した」ことを条件に実行する
   * （INSERT ... SELECT + EXISTS で条件分岐し、残量不足なら 0 行挿入で済ませる）。
   */
  private async consumeAndInsert(props: {
    thanks: Thanks
    senderEmployeeId: number
    points: number
    period: string
  }): Promise<Thanks | null | ApplicationError> {
    try {
      const db = this.c.env.DB

      // ポイントなし（メッセージのみの感謝）は consume 不要なので INSERT だけを batch に入れる。
      if (props.points === 0) {
        const results = await db.batch([
          db
            .prepare(
              "INSERT INTO thanks_messages (sender_employee_id, recipient_employee_id, message, points, created_at) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id, sender_employee_id AS senderEmployeeId, recipient_employee_id AS recipientEmployeeId, message, points, created_at AS createdAt",
            )
            .bind(
              props.thanks.senderEmployeeId,
              props.thanks.recipientEmployeeId,
              props.thanks.message,
              props.thanks.points,
              props.thanks.createdAt,
            ),
        ])

        const row = parseD1Row(results[0], thanksRowSchema)

        if (row instanceof Error) {
          return new UnexpectedError("failed to parse thanks row", { cause: row })
        }

        if (row === undefined) {
          return new UnexpectedError("failed to insert thanks")
        }

        return Thanks.fromRow(row)
      }

      // ポイント付き: consume UPDATE → 条件付き INSERT を 1 トランザクションで実行する。
      // INSERT は SQLite の changes() で「直前の UPDATE が 1 行以上更新した」ことを確認してから
      // 挿入する。consume が 0 行更新（残量不足）なら INSERT も 0 行になり、ポイント消失を防ぐ。
      const results = await db.batch([
        db
          .prepare(
            "UPDATE thanks_point_budgets SET consumed_points = consumed_points + ?1 WHERE employee_id = ?2 AND period = ?3 AND granted_points - consumed_points >= ?1",
          )
          .bind(props.points, props.senderEmployeeId, props.period),
        db
          .prepare(
            "INSERT INTO thanks_messages (sender_employee_id, recipient_employee_id, message, points, created_at) SELECT ?1, ?2, ?3, ?4, ?5 WHERE changes() > 0 RETURNING id, sender_employee_id AS senderEmployeeId, recipient_employee_id AS recipientEmployeeId, message, points, created_at AS createdAt",
          )
          .bind(
            props.thanks.senderEmployeeId,
            props.thanks.recipientEmployeeId,
            props.thanks.message,
            props.thanks.points,
            props.thanks.createdAt,
          ),
      ])

      // INSERT 結果が空なら consume が 0 行 = 残量不足。
      const insertResult = results[1]

      if ((insertResult.results?.length ?? 0) === 0) {
        return null
      }

      const row = parseD1Row(insertResult, thanksRowSchema)

      if (row instanceof Error) {
        return new UnexpectedError("failed to parse thanks row", { cause: row })
      }

      if (row === undefined) {
        return new UnexpectedError("failed to insert thanks")
      }

      return Thanks.fromRow(row)
    } catch (error) {
      return error instanceof Error
        ? new UnexpectedError("failed to send thanks", { cause: error })
        : new UnexpectedError("failed to send thanks")
    }
  }
}
