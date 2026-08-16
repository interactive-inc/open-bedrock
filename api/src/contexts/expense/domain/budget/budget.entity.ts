import type { BudgetRow } from "@/contexts/expense/infrastructure/schema/budget"
import { z } from "zod"

/** D1 batch の結果行を安全にパースする。fromRow の引数型に対応する。 */
export const budgetRowSchema = z.object({
  id: z.number(),
  departmentId: z.number(),
  fiscalPeriod: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  amount: z.number(),
  name: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
})

const zProps = z.object({
  id: z.number().nullable(),
  departmentId: z.number(),
  fiscalPeriod: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  amount: z.number(),
  name: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/**
 * 部署予算（部署・会計期間ごとの予算額の記録）。消化額は保持せず、承認済み経費の読み取り集計で算出する
 */
export class Budget implements Props {
  readonly id!: Props["id"]

  readonly departmentId!: Props["departmentId"]

  readonly fiscalPeriod!: Props["fiscalPeriod"]

  readonly periodStart!: Props["periodStart"]

  readonly periodEnd!: Props["periodEnd"]

  readonly amount!: Props["amount"]

  readonly name!: Props["name"]

  readonly note!: Props["note"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規作成する部署予算を組み立てる。id は未採番。 */
  static create(props: {
    departmentId: number
    fiscalPeriod: string
    periodStart: string
    periodEnd: string
    amount: number
    name: string
    note: string | null
    createdAt: string
  }): Budget {
    return new Budget({
      id: null,
      departmentId: props.departmentId,
      fiscalPeriod: props.fiscalPeriod,
      periodStart: props.periodStart,
      periodEnd: props.periodEnd,
      amount: props.amount,
      name: props.name,
      note: props.note,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: BudgetRow): Budget {
    return new Budget({
      id: row.id,
      departmentId: row.departmentId,
      fiscalPeriod: row.fiscalPeriod,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      amount: row.amount,
      name: row.name,
      note: row.note,
      createdAt: row.createdAt,
    })
  }

  /** 金額・名称・メモを変更した新しい予算を返す。部署・会計期間は変更しない。 */
  withDetails(props: { amount: number; name: string; note: string | null }): Budget {
    return new Budget({
      ...this.props,
      amount: props.amount,
      name: props.name,
      note: props.note,
    })
  }
}
