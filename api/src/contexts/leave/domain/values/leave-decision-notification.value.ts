import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

const notificationSchema = z
  .object({
    decisionAuditId: z.string().min(1).max(200).regex(/^\S+$/),
    leaveRequestId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    recipientEmployeeId: zEmployeeId,
    outcome: z.enum(["approved", "rejected"]),
    decidedAt: z.number().int().nonnegative().max(8_640_000_000_000_000),
  })
  .strict()

type Props = Readonly<z.output<typeof notificationSchema>>

/** 確定した休暇判断の通知内容と、再送しても変わらない識別子を保持する。 */
export class LeaveDecisionNotificationValue {
  private constructor(readonly props: Props) {
    Object.freeze(this.props)
    Object.freeze(this)
  }

  static create(input: unknown): LeaveDecisionNotificationValue | Error {
    const parsed = notificationSchema.safeParse(input)
    if (!parsed.success)
      return new Error("invalid leave decision notification", { cause: parsed.error })
    return new LeaveDecisionNotificationValue(parsed.data)
  }

  get deliveryId(): string {
    return `leave-decision:${this.props.decisionAuditId}`
  }

  get title(): string {
    if (this.props.outcome === "approved") return "休暇申請が承認されました"
    return "休暇申請が却下されました"
  }

  /** 保存時と配送時に同じ内容を照合し、入力オブジェクトのキー順には依存しない。 */
  toCanonicalJson(): string {
    return JSON.stringify({
      decisionAuditId: this.props.decisionAuditId,
      leaveRequestId: this.props.leaveRequestId,
      recipientEmployeeId: this.props.recipientEmployeeId,
      outcome: this.props.outcome,
      decidedAt: this.props.decidedAt,
    })
  }
}
