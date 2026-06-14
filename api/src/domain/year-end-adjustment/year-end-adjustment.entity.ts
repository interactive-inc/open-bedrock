import type { YearEndAdjustmentRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.string(),
  employeeId: z.number(),
  targetYear: z.number(),
  note: z.string().nullable(),
  status: z.string(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

// 年末調整の申告受付（対象年・備考の提出状況の記録のみ。税額の計算や判定は持たない）。集約ルート。
export class YearEndAdjustment implements Props {
  // id は UUID。新規作成時に採番する。
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly targetYear!: Props["targetYear"]

  readonly note!: Props["note"]

  readonly status!: Props["status"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  // 新規の年末調整申告を組み立てる。id は crypto.randomUUID() で採番し、status は "submitted" で作成する。
  static create(props: {
    employeeId: number
    targetYear: number
    note: string | null
    createdAt: string
  }): YearEndAdjustment {
    return new YearEndAdjustment({
      id: crypto.randomUUID(),
      employeeId: props.employeeId,
      targetYear: props.targetYear,
      note: props.note,
      status: "submitted",
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: YearEndAdjustmentRow): YearEndAdjustment {
    return new YearEndAdjustment({
      id: row.id,
      employeeId: row.employeeId,
      targetYear: row.targetYear,
      note: row.note,
      status: row.status,
      createdAt: row.createdAt,
    })
  }

  get isModifiable(): boolean {
    return this.status === "submitted"
  }

  // 申告内容を変更した新しい年末調整申告を返す。
  withDetails(props: { targetYear: number; note: string | null }): YearEndAdjustment {
    return new YearEndAdjustment({
      ...this.props,
      targetYear: props.targetYear,
      note: props.note,
    })
  }
}
