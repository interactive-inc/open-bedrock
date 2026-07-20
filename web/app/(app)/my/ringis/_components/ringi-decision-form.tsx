"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { approveRingiAction, rejectRingiAction } from "@/app/(app)/my/ringis/actions"
import type { RingiDecisionFormState } from "@/app/(app)/my/ringis/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

type Props = {
  ringiId: number
}

const initialApproveState: RingiDecisionFormState = {
  ok: false,
  error: null,
}

const initialRejectState: RingiDecisionFormState = {
  ok: false,
  error: null,
}

/**
 * 1 件の稟議に対する承認・却下フォーム。承認・却下どちらもコメントは任意。
 * 承認と却下で別フォーム・別 action を持ち、結果を toast() で通知する。
 */
export function RingiDecisionForm(props: Props) {
  // 承認フォームのラッパ。action を1回だけ実行し、結果を toast して次状態を返す。
  const approveAction = useActionState(
    async (previousState: RingiDecisionFormState, formData: FormData) => {
      const next = await approveRingiAction(previousState, formData)

      if (next.ok) {
        toast.success("稟議を承認しました")
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
    async (previousState: RingiDecisionFormState, formData: FormData) => {
      const next = await rejectRingiAction(previousState, formData)

      if (next.ok) {
        toast.success("稟議を却下しました")
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
        {approveState.ok ? "この稟議を承認しました" : "この稟議を却下しました"}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={dispatchApprove}>
        <FieldGroup>
          <input type="hidden" name="ringi_id" value={props.ringiId} />

          <Field>
            <FieldLabel htmlFor={`ringi-approve-comment-${props.ringiId}`}>
              承認コメント（任意）
            </FieldLabel>

            <Textarea id={`ringi-approve-comment-${props.ringiId}`} name="comment" rows={2} />
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

      <form action={dispatchReject}>
        <FieldGroup>
          <input type="hidden" name="ringi_id" value={props.ringiId} />

          <Field>
            <FieldLabel htmlFor={`ringi-reject-comment-${props.ringiId}`}>
              却下コメント（任意）
            </FieldLabel>

            <Textarea id={`ringi-reject-comment-${props.ringiId}`} name="comment" rows={2} />
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
