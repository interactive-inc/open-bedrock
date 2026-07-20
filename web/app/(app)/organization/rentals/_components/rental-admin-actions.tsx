"use client"

import { useActionState } from "react"
import {
  lendRentalReservationAction,
  returnRentalReservationAction,
} from "@/app/(app)/my/rentals/actions"
import type { RentalReservationActionState } from "@/app/(app)/my/rentals/actions"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"

type Props = {
  reservationId: string
  status: string
}

const initialState: RentalReservationActionState = { ok: false, error: null }

/**
 * admin 一覧の行アクション。requested は貸出、lent は返却へ進める。
 * status に応じて片方のボタンだけ表示する。
 */
export function RentalAdminActions(props: Props) {
  const lend = useActionState(lendRentalReservationAction, initialState)

  const returnState = useActionState(returnRentalReservationAction, initialState)

  const lendResult = lend[0]

  const lendAction = lend[1]

  const isLendPending = lend[2]

  const returnResult = returnState[0]

  const returnAction = returnState[1]

  const isReturnPending = returnState[2]

  if (props.status === "requested") {
    return (
      <div className="flex flex-col gap-2">
        <form action={lendAction}>
          <input type="hidden" name="reservation_id" value={props.reservationId} />

          <Button type="submit" size="sm" disabled={isLendPending}>
            貸出
          </Button>
        </form>

        {lendResult.error !== null ? <FieldError>{lendResult.error}</FieldError> : null}
      </div>
    )
  }

  if (props.status === "lent") {
    return (
      <div className="flex flex-col gap-2">
        <form action={returnAction}>
          <input type="hidden" name="reservation_id" value={props.reservationId} />

          <Button type="submit" size="sm" variant="outline" disabled={isReturnPending}>
            返却
          </Button>
        </form>

        {returnResult.error !== null ? <FieldError>{returnResult.error}</FieldError> : null}
      </div>
    )
  }

  return <span className="text-muted-foreground">—</span>
}
