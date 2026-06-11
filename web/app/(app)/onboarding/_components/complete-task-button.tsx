"use client"

import { useActionState } from "react"
import { completeOnboardingTaskAction } from "@/app/(app)/onboarding/actions"
import type { CompleteState } from "@/app/(app)/onboarding/actions"
import { Button } from "@/components/ui/button"

type Props = {
  taskId: number
}

const initialState: CompleteState = { ok: false, message: null }

// 自分のタスクを完了にするボタン。taskId を hidden input で Server Action へ送る。
// 失敗時のみインラインでエラーを出す（成功時はサーバ再検証で行が更新される）。
export function CompleteTaskButton(props: Props) {
  const action = useActionState(completeOnboardingTaskAction, initialState)

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="task_id" value={props.taskId} />

      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? "処理中..." : "完了にする"}
      </Button>

      {state.ok === false && state.message !== null ? (
        <span className="text-xs text-destructive">{state.message}</span>
      ) : null}
    </form>
  )
}
