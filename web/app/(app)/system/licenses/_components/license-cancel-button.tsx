"use client"

import { useActionState } from "react"
import { cancelLicenseAction } from "@/app/(app)/system/licenses/actions"
import type { LicenseActionState } from "@/app/(app)/system/licenses/actions"
import { Button } from "@/components/ui/button"

const initialState: LicenseActionState = { ok: false, error: null }

type Props = {
  id: number
  name: string
}

/**
 * ライセンスを解約するボタン。hidden input で id を渡し、Server Action を form action で呼ぶ。
 * useEffect / useCallback を使わず、useActionState の pending だけで二重送信を防ぐ。
 */
export function LicenseCancelButton(props: Props) {
  const action = useActionState(cancelLicenseAction, initialState)

  const state = action[0]

  const formAction = action[1]

  const pending = action[2]

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={props.id} />

      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "解約中..." : "解約"}
      </Button>

      {state.error !== null ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  )
}
