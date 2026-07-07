import type { BudgetRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  fiscalYear: z.number().int(),
  departmentCode: z.string().nullable(),
  title: z.string(),
  amount: z.number().int(),
  note: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 予算枠。会計年度・部署・金額（整数円）の事実のみ持ち、会計計算や支払処理はしない。 */
export class Budget implements Props {
  readonly id!: Props["id"]

  readonly fiscalYear!: Props["fiscalYear"]

  readonly departmentCode!: Props["departmentCode"]

  readonly title!: Props["title"]

  readonly amount!: Props["amount"]

  readonly note!: Props["note"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規の予算枠を組み立てる。id は未採番。 */
  static create(props: {
    fiscalYear: number
    departmentCode: string | null
    title: string
    amount: number
    note: string | null
    createdAt: string
  }): Budget {
    return new Budget({
      id: null,
      fiscalYear: props.fiscalYear,
      departmentCode: props.departmentCode,
      title: props.title,
      amount: props.amount,
      note: props.note,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: BudgetRow): Budget {
    return new Budget({
      id: row.id,
      fiscalYear: row.fiscalYear,
      departmentCode: row.departmentCode,
      title: row.title,
      amount: row.amount,
      note: row.note,
      createdAt: row.createdAt,
    })
  }

  /** 予算枠の属性（年度・部署・表題・金額・備考）を差し替える。 */
  withDetails(details: {
    fiscalYear: Props["fiscalYear"]
    departmentCode: Props["departmentCode"]
    title: Props["title"]
    amount: Props["amount"]
    note: Props["note"]
  }): Budget {
    return new Budget({
      ...this.props,
      fiscalYear: details.fiscalYear,
      departmentCode: details.departmentCode,
      title: details.title,
      amount: details.amount,
      note: details.note,
    })
  }
}
