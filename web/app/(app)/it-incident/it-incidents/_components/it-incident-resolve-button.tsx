"use client"

import { useActionState } from "react"
import { resolveItIncidentAction } from "@/app/(app)/it-incident/it-incidents/actions"
import type { ItIncidentActionState } from "@/app/(app)/it-incident/it-incidents/actions"
import { Button } from "@/components/ui/button"

const initialState: ItIncidentActionState = { ok: false, error: null }

type Props = {
  id: number
}

/**
 * インシデントを解消済みに倒すボタン。hidden input で id を渡し Server Action を form action で呼ぶ。
 */
export function ItIncidentResolveButton(props: Props) {
  const action = useActionState(resolveItIncidentAction, initialState)

  const state = action[0]

  const formAction = action[1]

  const pending = action[2]

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={props.id} />

      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "解消中..." : "解消済みにする"}
      </Button>

      {state.error !== null ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  )
}
