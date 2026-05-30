import type { ExpenseRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  employeeId: z.number(),
  category: z.enum(["transport", "supplies", "entertainment", "books", "other"]),
  amount: z.number(),
  spentAt: z.string(),
  note: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected", "settled"]),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

// 経費申請（社員ごとの立替・経費の記録と承認状態）。集約ルート。
export class Expense implements Props {
  // 永続化前は null、DB 採番後に確定する。
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly category!: Props["category"]

  readonly amount!: Props["amount"]

  readonly spentAt!: Props["spentAt"]

  readonly note!: Props["note"]

  readonly status!: Props["status"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  // 新規作成する経費申請を組み立てる。id は未採番、初期状態は pending。
  static create(props: {
    employeeId: number
    category: Props["category"]
    amount: number
    spentAt: string
    note: string | null
    createdAt: string
  }): Expense {
    return new Expense({
      id: null,
      employeeId: props.employeeId,
      category: props.category,
      amount: props.amount,
      spentAt: props.spentAt,
      note: props.note,
      status: "pending",
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: ExpenseRow): Expense {
    return new Expense({
      id: row.id,
      employeeId: row.employeeId,
      category: row.category,
      amount: row.amount,
      spentAt: row.spentAt,
      note: row.note,
      status: row.status,
      createdAt: row.createdAt,
    })
  }

  withStatus(status: Props["status"]) {
    return new Expense({ ...this.props, status })
  }
}
