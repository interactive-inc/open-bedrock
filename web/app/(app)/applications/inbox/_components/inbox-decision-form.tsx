"use client"

import { useActionState } from "react"
import { decideApplicationAction } from "@/app/(app)/applications/inbox/actions"
import type { DecisionState } from "@/app/(app)/applications/inbox/actions"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type Props = {
  applicationId: number
}

const initialState: DecisionState = { ok: false, error: null }

// inbox 行の承認/却下フォーム。1 つの form 内で 2 つの送信ボタンを decision 値で分岐する。
// 却下時のみコメント必須。useActionState の state でエラーを表示する。
export function InboxDecisionForm(props: Props) {
  const action = useActionState(decideApplicationAction, initialState)

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="application_id" value={props.applicationId} />

      <Textarea
        name="comment"
        rows={2}
        placeholder="コメント (却下時は必須)"
        className="min-w-64"
        aria-invalid={state.error !== null}
      />

      <div className="flex gap-2">
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
      </div>

      {state.error !== null ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  )
}
