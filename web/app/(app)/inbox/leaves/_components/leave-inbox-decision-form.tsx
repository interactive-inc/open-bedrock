"use client"

import { FieldError } from "@/components/ui/field"
import { decideLeaveRequestAction } from "@/app/(app)/inbox/leaves/actions"
import type { LeaveDecisionState } from "@/app/(app)/inbox/leaves/actions"
import { useFormAction } from "@/hooks/use-form-action"
import { TableRowActions } from "@/components/table-row-actions"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type Props = {
  leaveRequestId: number
}

const initialState: LeaveDecisionState = { ok: false, error: null }

/**
 * inbox 行の承認/却下フォーム。1 つの form 内で 2 つの送信ボタンを decision 値で分岐する。
 * 却下時のみコメント必須。useActionState の state でエラーを表示する。
 */
export function LeaveInboxDecisionForm(props: Props) {
  const action = useFormAction(decideLeaveRequestAction, initialState, (_state, formData) =>
    formData.get("decision") === "approve" ? "休暇申請を承認しました" : "休暇申請を却下しました",
  )

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="leave_request_id" value={props.leaveRequestId} />

      <Textarea
        name="comment"
        rows={2}
        placeholder="コメント (却下時は必須)"
        aria-label="コメント (却下時は必須)"
        aria-invalid={state.error !== null}
      />

      <TableRowActions>
        <Button type="submit" name="decision" value="approve" size="sm" disabled={isPending}>
          承認
        </Button>

        <Button
          type="submit"
          name="decision"
          value="reject"
          size="sm"
          variant="destructive"
          disabled={isPending}
        >
          却下
        </Button>
      </TableRowActions>

      {state.error !== null ? <FieldError>{state.error}</FieldError> : null}
    </form>
  )
}
