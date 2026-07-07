import type { BudgetConsumptionRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  budgetId: z.number().int(),
  amount: z.number().int(),
  note: z.string().nullable(),
  recordedOn: z.string(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 予算枠の消化記録。枠に対していついくら使ったかの手動記録。稟議・経費との自動連動はしない。 */
export class BudgetConsumption implements Props {
  readonly id!: Props["id"]

  readonly budgetId!: Props["budgetId"]

  readonly amount!: Props["amount"]

  readonly note!: Props["note"]

  readonly recordedOn!: Props["recordedOn"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規の消化記録を組み立てる。id は未採番。 */
  static create(props: {
    budgetId: number
    amount: number
    note: string | null
    recordedOn: string
    createdAt: string
  }): BudgetConsumption {
    return new BudgetConsumption({
      id: null,
      budgetId: props.budgetId,
      amount: props.amount,
      note: props.note,
      recordedOn: props.recordedOn,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: BudgetConsumptionRow): BudgetConsumption {
    return new BudgetConsumption({
      id: row.id,
      budgetId: row.budgetId,
      amount: row.amount,
      note: row.note,
      recordedOn: row.recordedOn,
      createdAt: row.createdAt,
    })
  }
}
