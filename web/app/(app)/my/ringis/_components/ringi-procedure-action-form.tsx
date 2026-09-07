"use client"

import { useActionState } from "react"
import { advanceRingiAction } from "@/app/(app)/my/ringis/actions"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import type { RingiDecisionTarget } from "@/lib/api/types/ringi-types"

type Props = {
  ringiId: number
  decisionTarget: RingiDecisionTarget
  operation: "cancel" | "execute"
}

/** 稟議の取消と確定待ちの再試行を表示する。 */
export function RingiProcedureActionForm(props: Props) {
  const action = useActionState(advanceRingiAction, { ok: false, error: null })
  return (
    <form action={action[1]} className="flex flex-col gap-2">
      <input type="hidden" name="ringi_id" value={props.ringiId} />
      <input type="hidden" name="decision_target" value={JSON.stringify(props.decisionTarget)} />
      <input type="hidden" name="operation" value={props.operation} />
      <Button
        type="submit"
        variant={props.operation === "cancel" ? "secondary" : "default"}
        disabled={action[2] || action[0].ok}
      >
        {action[0].ok
          ? "完了しました"
          : props.operation === "cancel"
            ? "稟議を取り消す"
            : "決裁を確定する"}
      </Button>
      {action[0].error !== null ? <FieldError>{action[0].error}</FieldError> : null}
    </form>
  )
}
