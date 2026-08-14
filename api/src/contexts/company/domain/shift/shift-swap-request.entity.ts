import type { ShiftSwapRequestRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  requesterEmployeeId: z.number(),
  targetEmployeeId: z.number(),
  date: z.string(),
  note: z.string().nullable(),
  status: z.string(),
  approvedAt: z.string().nullable(),
})

type Props = z.infer<typeof zProps>

/** シフト交代申請（申請者と交代相手・対象日・承認状態）。集約ルート。 */
export class ShiftSwapRequest implements Props {
  /** 永続化前は null、DB 採番後に確定する。 */
  readonly id!: Props["id"]

  readonly requesterEmployeeId!: Props["requesterEmployeeId"]

  readonly targetEmployeeId!: Props["targetEmployeeId"]

  readonly date!: Props["date"]

  readonly note!: Props["note"]

  readonly status!: Props["status"]

  readonly approvedAt!: Props["approvedAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規作成する交代申請を組み立てる。id は未採番、初期状態は pending。 */
  static create(props: {
    requesterEmployeeId: number
    targetEmployeeId: number
    date: string
    note: string | null
  }): ShiftSwapRequest | { reason: "self_reference" } {
    if (props.requesterEmployeeId === props.targetEmployeeId) {
      return { reason: "self_reference" }
    }

    return new ShiftSwapRequest({
      id: null,
      requesterEmployeeId: props.requesterEmployeeId,
      targetEmployeeId: props.targetEmployeeId,
      date: props.date,
      note: props.note,
      status: "pending",
      approvedAt: null,
    })
  }

  static fromRow(row: ShiftSwapRequestRow): ShiftSwapRequest {
    return new ShiftSwapRequest({
      id: row.id,
      requesterEmployeeId: row.requesterEmployeeId,
      targetEmployeeId: row.targetEmployeeId,
      date: row.date,
      note: row.note,
      status: row.status,
      approvedAt: row.approvedAt,
    })
  }

  withApproved(approvedAt: string) {
    return new ShiftSwapRequest({ ...this.props, status: "approved", approvedAt })
  }
}
