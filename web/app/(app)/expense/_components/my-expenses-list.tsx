"use client"

import Link from "next/link"
import { useActionState, useState } from "react"
import { toast } from "sonner"
import { deleteExpenseAction, updateExpenseAction } from "@/app/(app)/expense/actions"
import type { ExpenseUpdateFormState } from "@/app/(app)/expense/actions"
import { EmptyState } from "@/components/empty-state"
import { ExpenseStatusBadge } from "@/components/expense-status-badge"
import { Button } from "@/components/ui/button"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ExpenseMineResponse } from "@/lib/api/types/expense-types"
import { toExpenseCategoryLabel } from "@/lib/expense/to-expense-category-label"

const amountFormatter = new Intl.NumberFormat("ja-JP")

type Props = {
  expenses: ReadonlyArray<ExpenseMineResponse>
}

// 自分の経費一覧。pending の行のみ変更（Dialog フォーム）と取り下げボタンを置く表示コンポーネント。
export function MyExpensesList(props: Props) {
  if (props.expenses.length === 0) {
    return <EmptyState title="申請済みの経費はまだありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>カテゴリ</TableHead>

            <TableHead>金額</TableHead>

            <TableHead>利用日</TableHead>

            <TableHead>ステータス</TableHead>

            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.expenses.map((expense) => (
            <TableRow key={expense.id}>
              <TableCell>
                <Link
                  href={`/expense/${expense.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {toExpenseCategoryLabel(expense.category)}
                </Link>
              </TableCell>

              <TableCell className="tabular-nums">
                {amountFormatter.format(expense.amount)} 円
              </TableCell>

              <TableCell className="text-muted-foreground">{expense.spent_at}</TableCell>

              <TableCell>
                <ExpenseStatusBadge status={expense.status} />
              </TableCell>

              <TableCell>
                <div className="flex justify-end gap-2">
                  {expense.status === "pending" ? <UpdateExpenseDialog expense={expense} /> : null}

                  {expense.status === "pending" ? (
                    <DeleteExpenseButton expenseId={expense.id} />
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// 経費変更フォームを Dialog で開く。カテゴリ・金額・利用日・メモを編集して送信する。
function UpdateExpenseDialog(props: { expense: ExpenseMineResponse }) {
  const [open, setOpen] = useState(false)

  async function reduce(
    previousState: ExpenseUpdateFormState,
    formData: FormData,
  ): Promise<ExpenseUpdateFormState> {
    const result = await updateExpenseAction(previousState, formData)

    if (result.ok) {
      toast.success("経費を更新しました")

      setOpen(false)
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const action = useActionState(reduce, { ok: false, error: null })

  const state = action[0]

  const formAction = action[1]

  const pending = action[2]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>経費を変更</DialogTitle>

          <DialogDescription>カテゴリ・金額・利用日・メモを変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="expense_id" value={props.expense.id} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`update_category_${props.expense.id}`}>カテゴリ</FieldLabel>

              <select
                id={`update_category_${props.expense.id}`}
                name="category"
                defaultValue={props.expense.category}
                className="h-8 w-full min-w-0 rounded-2xl border border-transparent bg-input/50 px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <option value="transport">交通費</option>

                <option value="supplies">備品</option>

                <option value="entertainment">交際費</option>

                <option value="books">書籍</option>

                <option value="other">その他</option>
              </select>
            </Field>

            <Field>
              <FieldLabel htmlFor={`update_amount_${props.expense.id}`}>金額（円）</FieldLabel>

              <Input
                id={`update_amount_${props.expense.id}`}
                name="amount"
                type="number"
                min={1}
                step={1}
                defaultValue={props.expense.amount}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor={`update_spent_at_${props.expense.id}`}>利用日</FieldLabel>

              <Input
                id={`update_spent_at_${props.expense.id}`}
                name="spent_at"
                type="date"
                defaultValue={props.expense.spent_at}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor={`update_note_${props.expense.id}`}>メモ（任意）</FieldLabel>

              <Textarea id={`update_note_${props.expense.id}`} name="note" rows={3} />
            </Field>
          </FieldGroup>

          {state.error === null ? null : <FieldError>{state.error}</FieldError>}

          <Button type="submit" disabled={pending}>
            変更を保存
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// 経費取り下げボタン。Server Action を呼び、成功時は一覧が revalidate される。
function DeleteExpenseButton(props: { expenseId: number }) {
  const action = useActionState(deleteExpenseAction, { ok: false, error: null })

  const formAction = action[1]

  const pending = action[2]

  return (
    <ConfirmActionDialog
      action={formAction}
      triggerLabel="取り下げ"
      title="この経費申請を取り下げますか？"
      description="取り下げた経費申請は元に戻せません。"
      confirmLabel="経費申請を取り下げ"
      pending={pending}
    >
      <input type="hidden" name="expense_id" value={props.expenseId} />
    </ConfirmActionDialog>
  )
}
