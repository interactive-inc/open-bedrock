"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { approveExpenseAction, rejectExpenseAction } from "@/app/(app)/my/expenses/actions"
import type { ExpenseDecisionFormState } from "@/app/(app)/my/expenses/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

type Props = {
  expenseId: number
}

const initialApproveState: ExpenseDecisionFormState = {
  ok: false,
  error: null,
}

const initialRejectState: ExpenseDecisionFormState = {
  ok: false,
  error: null,
}

/**
 * 1 件の経費に対する承認・却下フォーム。承認はコメント任意、却下は理由必須。
 * 承認と却下で別フォーム・別 action を持ち、結果を toast() で通知する。
 */
export function ExpenseDecisionForm(props: Props) {
  // 承認フォームのラッパ。action を1回だけ実行し、結果を toast して次状態を返す。
  const approveAction = useActionState(
    async (previousState: ExpenseDecisionFormState, formData: FormData) => {
      const next = await approveExpenseAction(previousState, formData)

      if (next.ok) {
        toast.success("経費を承認しました")
      } else if (next.error !== null) {
        toast.error(next.error)
      }

      return next
    },
    initialApproveState,
  )

  const approveState = approveAction[0]

  const dispatchApprove = approveAction[1]

  const isApproving = approveAction[2]

  // 却下フォームのラッパ。action を1回だけ実行し、結果を toast して次状態を返す。
  const rejectAction = useActionState(
    async (previousState: ExpenseDecisionFormState, formData: FormData) => {
      const next = await rejectExpenseAction(previousState, formData)

      if (next.ok) {
        toast.success("経費を却下しました")
      } else if (next.error !== null) {
        toast.error(next.error)
      }

      return next
    },
    initialRejectState,
  )

  const rejectState = rejectAction[0]

  const dispatchReject = rejectAction[1]

  const isRejecting = rejectAction[2]

  const isDecided = approveState.ok || rejectState.ok

  if (isDecided) {
    return (
      <p className="text-sm text-muted-foreground">
        {approveState.ok ? "この経費を承認しました" : "この経費を却下しました"}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <form action={dispatchApprove}>
        <FieldGroup>
          <input type="hidden" name="expense_id" value={props.expenseId} />

          <Field>
            <FieldLabel htmlFor={`approve-comment-${props.expenseId}`}>
              承認コメント（任意）
            </FieldLabel>

            <Textarea id={`approve-comment-${props.expenseId}`} name="comment" rows={2} />
          </Field>

          {approveState.error !== null ? <FieldError>{approveState.error}</FieldError> : null}

          <Field orientation="horizontal">
            <Button type="submit" disabled={isApproving || isRejecting}>
              {isApproving ? "承認中..." : "承認する"}
            </Button>
          </Field>
        </FieldGroup>
      </form>

      <form action={dispatchReject}>
        <FieldGroup>
          <input type="hidden" name="expense_id" value={props.expenseId} />

          <Field>
            <FieldLabel htmlFor={`reject-comment-${props.expenseId}`}>却下理由（必須）</FieldLabel>

            <Textarea
              id={`reject-comment-${props.expenseId}`}
              name="comment"
              rows={2}
              placeholder="却下の理由を入力してください"
            />
          </Field>

          {rejectState.error !== null ? <FieldError>{rejectState.error}</FieldError> : null}

          <Field orientation="horizontal">
            <Button type="submit" variant="destructive" disabled={isApproving || isRejecting}>
              {isRejecting ? "却下中..." : "却下する"}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  )
}
