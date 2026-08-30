import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { expenseApprovalActionSchema } from "@/contexts/expense/domain/definitions/expense.definition"
import type { ExpenseApprovalRow } from "@/contexts/expense/infrastructure/schema/expense"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  expenseId: z.number(),
  approverId: zEmployeeId,
  action: expenseApprovalActionSchema,
  comment: z.string().nullable(),
  createdAt: z.string(),
})

type Props = z.infer<typeof zProps>

/** 経費への承認/却下アクションの記録。Expense 集約の内部エンティティ。 */
export class ExpenseApproval implements Props {
  /** 永続化前は null、DB 採番後に確定する。 */
  readonly id!: Props["id"]

  readonly expenseId!: Props["expenseId"]

  readonly approverId!: Props["approverId"]

  readonly action!: Props["action"]

  readonly comment!: Props["comment"]

  readonly createdAt!: Props["createdAt"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  /** 新規作成する承認記録を組み立てる。id は未採番。 */
  static create(props: {
    expenseId: number
    approverId: EmployeeId
    action: Props["action"]
    comment: string | null
    createdAt: string
  }): ExpenseApproval {
    return new ExpenseApproval({
      id: null,
      expenseId: props.expenseId,
      approverId: props.approverId,
      action: props.action,
      comment: props.comment,
      createdAt: props.createdAt,
    })
  }

  static fromRow(row: ExpenseApprovalRow): ExpenseApproval {
    return new ExpenseApproval({
      id: row.id,
      expenseId: row.expenseId,
      approverId: row.approverId,
      action: row.action,
      comment: row.comment,
      createdAt: row.createdAt,
    })
  }
}
