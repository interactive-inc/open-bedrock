import type { HeadcountPlanRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  fiscalYear: z.number(),
  departmentCode: z.string().nullable(),
  plannedCount: z.number(),
  note: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 人員計画（年度・部署ごとの計画人数）。実在籍数との比較は API 側で添える。id は新規作成時 null。 */
export class HeadcountPlan implements Props {
  readonly id!: Props["id"]

  readonly fiscalYear!: Props["fiscalYear"]

  readonly departmentCode!: Props["departmentCode"]

  readonly plannedCount!: Props["plannedCount"]

  readonly note!: Props["note"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  static create(props: {
    fiscalYear: number
    departmentCode: string | null
    plannedCount: number
    note: string | null
    createdAt: string
  }): HeadcountPlan {
    return new HeadcountPlan({
      id: null,
      fiscalYear: props.fiscalYear,
      departmentCode: props.departmentCode,
      plannedCount: props.plannedCount,
      note: props.note,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: HeadcountPlanRow): HeadcountPlan {
    return new HeadcountPlan({
      id: row.id,
      fiscalYear: row.fiscalYear,
      departmentCode: row.departmentCode,
      plannedCount: row.plannedCount,
      note: row.note,
      createdAt: row.createdAt,
    })
  }

  /** 計画人数と備考を差し替える。年度・部署は保つ（一意キーのため変更しない）。 */
  withDetails(details: {
    plannedCount: Props["plannedCount"]
    note: Props["note"]
  }): HeadcountPlan {
    return new HeadcountPlan({
      ...this.props,
      plannedCount: details.plannedCount,
      note: details.note,
    })
  }
}
