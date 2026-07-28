"use client"

import { useActionState } from "react"
import { approveLifeEventAction, rejectLifeEventAction } from "@/app/(app)/my/life-events/actions"
import type { LifeEventActionState } from "@/app/(app)/my/life-events/actions"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"

type Props = {
  lifeEventId: string
}

const initialState: LifeEventActionState = { ok: false, error: null }

/** admin 一覧の行アクション。submitted の届出を人事が承認/却下する。 */
export function LifeEventAdminActions(props: Props) {
  const approve = useActionState(approveLifeEventAction, initialState)

  const reject = useActionState(rejectLifeEventAction, initialState)

  const approveState = approve[0]

  const approveAction = approve[1]

  const isApprovePending = approve[2]

  const rejectState = reject[0]

  const rejectAction = reject[1]

  const isRejectPending = reject[2]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <form action={approveAction}>
          <input type="hidden" name="life_event_id" value={props.lifeEventId} />

          <Button type="submit" size="sm" disabled={isApprovePending}>
            承認
          </Button>
        </form>

        <form action={rejectAction}>
          <input type="hidden" name="life_event_id" value={props.lifeEventId} />

          <Button type="submit" size="sm" variant="destructive" disabled={isRejectPending}>
            却下
          </Button>
        </form>
      </div>

      {approveState.error !== null ? <FieldError>{approveState.error}</FieldError> : null}

      {rejectState.error !== null ? <FieldError>{rejectState.error}</FieldError> : null}
    </div>
  )
}
