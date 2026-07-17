"use client"

import { useActionState } from "react"
import {
  approveBusinessTripAction,
  rejectBusinessTripAction,
} from "@/app/(app)/my/business-trips/actions"
import type { BusinessTripActionState } from "@/app/(app)/my/business-trips/actions"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"

type Props = {
  businessTripId: string
}

const initialState: BusinessTripActionState = { ok: false, error: null }

// admin 一覧の行アクション。requested の出張申請を人事が承認/却下する。
export function BusinessTripAdminActions(props: Props) {
  const approve = useActionState(approveBusinessTripAction, initialState)

  const reject = useActionState(rejectBusinessTripAction, initialState)

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
          <input type="hidden" name="business_trip_id" value={props.businessTripId} />

          <Button type="submit" size="sm" disabled={isApprovePending}>
            承認
          </Button>
        </form>

        <form action={rejectAction}>
          <input type="hidden" name="business_trip_id" value={props.businessTripId} />

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
