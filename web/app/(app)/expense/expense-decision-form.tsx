"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { approveExpenseAction, rejectExpenseAction } from "@/app/(app)/expense/actions"
import type { ExpenseDecisionFormState } from "@/app/(app)/expense/actions"
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

// 1 件の経費に対する承認・却下フォーム。承認はコメント任意、却下は理由必須。
// 承認と却下で別フォーム・別 action を持ち、結果を toast() で通知する。
export function ExpenseDecisionForm(props: Props) {
  const approveAction = useActionState(approveExpenseAction, initialApproveState)

  const approveState = approveAction[0]

  const dispatchApprove = approveAction[1]

  const isApproving = approveAction[2]

  const rejectAction = useActionState(rejectExpenseAction, initialRejectState)

  const rejectState = rejectAction[0]

  const dispatchReject = rejectAction[1]

  const isRejecting = rejectAction[2]

  const isDecided = approveState.ok || rejectState.ok

  // 承認フォームのラッパ。結果を toast し action へ反映する。
  async function handleApprove(formData: FormData): Promise<void> {
    const result = await approveExpenseAction(approveState, formData)

    if (result.ok) {
      toast.success("経費を承認しました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    dispatchApprove(formData)
  }

  // 却下フォームのラッパ。結果を toast し action へ反映する。
  async function handleReject(formData: FormData): Promise<void> {
    const result = await rejectExpenseAction(rejectState, formData)

    if (result.ok) {
      toast.success("経費を却下しました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    dispatchReject(formData)
  }

  if (isDecided) {
    return (
      <p className="text-sm text-muted-foreground">
        {approveState.ok ? "この経費を承認しました" : "この経費を却下しました"}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={handleApprove}>
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
            <Button
              type="submit"
              disabled={isApproving || isRejecting}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {isApproving ? "承認中..." : "承認する"}
            </Button>
          </Field>
        </FieldGroup>
      </form>

      <form action={handleReject}>
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
