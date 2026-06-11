"use client"

import { useActionState } from "react"
import { removeSkillAction } from "@/app/(app)/skills/me/actions"
import { Button } from "@/components/ui/button"

type Props = {
  skillCode: string
}

// 登録スキルの削除ボタン。Server Action を呼び、成功時は一覧が revalidate される。
export function RemoveSkillButton(props: Props) {
  const [state, formAction, pending] = useActionState(removeSkillAction, {
    ok: false,
    error: null,
  })

  return (
    <form action={formAction}>
      <input type="hidden" name="skill_code" value={props.skillCode} />

      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        削除
      </Button>

      {state.error === null ? null : <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  )
}
