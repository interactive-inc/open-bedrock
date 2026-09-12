"use client"

import { useActionState } from "react"
import { cancelLeaveRequestAction } from "@/app/(app)/my/leaves/actions"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"

/** 本人の未提出の内容だけを削除する。提出済みの案件は履歴を残す取消を使う。 */
export function LeaveDraftDiscardForm(props: { id: number }) {
  const [state, action, pending] = useActionState(cancelLeaveRequestAction, {
    ok: false,
    error: null,
  })
  return (
    <form action={action}>
      <input type="hidden" name="leave_request_id" value={props.id} />
      <Button type="submit" variant="secondary" disabled={pending}>
        未提出の内容を削除
      </Button>
      {state.error === null ? null : <FieldError role="alert">{state.error}</FieldError>}
    </form>
  )
}
