import type { ResignationRow } from "@/contexts/resignation/infrastructure/schema/resignation"
import { z } from "zod"

const zProps = z.object({
  id: z.string(),
  employeeId: z.number(),
  resignationDate: z.string(),
  lastWorkingDate: z.string().nullable(),
  reason: z.string().nullable(),
  status: z.string(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 退職申請（退職希望日・最終出社日・理由の記録。法的判定は持たず記録のみ）。集約ルート。 */
export class Resignation implements Props {
  /** id は UUID。新規作成時に採番する。 */
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly resignationDate!: Props["resignationDate"]

  readonly lastWorkingDate!: Props["lastWorkingDate"]

  readonly reason!: Props["reason"]

  readonly status!: Props["status"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規退職申請を組み立てる。id は crypto.randomUUID() で採番し、status は "requested" で作成する。 */
  static create(props: {
    employeeId: number
    resignationDate: string
    lastWorkingDate: string | null
    reason: string | null
    createdAt: string
  }): Resignation {
    return new Resignation({
      id: crypto.randomUUID(),
      employeeId: props.employeeId,
      resignationDate: props.resignationDate,
      lastWorkingDate: props.lastWorkingDate,
      reason: props.reason,
      status: "requested",
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: ResignationRow): Resignation {
    return new Resignation({
      id: row.id,
      employeeId: row.employeeId,
      resignationDate: row.resignationDate,
      lastWorkingDate: row.lastWorkingDate,
      reason: row.reason,
      status: row.status,
      createdAt: row.createdAt,
    })
  }

  get isModifiable(): boolean {
    return this.status === "requested"
  }

  /** 申請内容を変更した新しい退職申請を返す。 */
  withDetails(props: {
    resignationDate: string
    lastWorkingDate: string | null
    reason: string | null
  }): Resignation {
    return new Resignation({
      ...this.props,
      resignationDate: props.resignationDate,
      lastWorkingDate: props.lastWorkingDate,
      reason: props.reason,
    })
  }

  /** requested のときだけ accepted へ進めた新しい退職申請を返す。それ以外は遷移不可を返す。 */
  withAccepted(): Resignation | { reason: "invalid_transition" } {
    if (this.status !== "requested") {
      return { reason: "invalid_transition" }
    }

    return new Resignation({ ...this.props, status: "accepted" })
  }

  /** requested のときだけ rejected へ進めた新しい退職申請を返す。それ以外は遷移不可を返す。 */
  withRejected(): Resignation | { reason: "invalid_transition" } {
    if (this.status !== "requested") {
      return { reason: "invalid_transition" }
    }

    return new Resignation({ ...this.props, status: "rejected" })
  }
}
