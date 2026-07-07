"use client"

import { useActionState } from "react"
import { acceptResignationAction, rejectResignationAction } from "@/app/(app)/resignations/actions"
import type { ResignationActionState } from "@/app/(app)/resignations/actions"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"

type Props = {
  resignationId: string
}

const initialState: ResignationActionState = { ok: false, error: null }

// admin 一覧の行アクション。requested の退職申請を人事が受理/却下する。
export function ResignationAdminActions(props: Props) {
  const accept = useActionState(acceptResignationAction, initialState)

  const reject = useActionState(rejectResignationAction, initialState)

  const acceptState = accept[0]

  const acceptAction = accept[1]

  const isAcceptPending = accept[2]

  const rejectState = reject[0]

  const rejectAction = reject[1]

  const isRejectPending = reject[2]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <form action={acceptAction}>
          <input type="hidden" name="resignation_id" value={props.resignationId} />

          <Button type="submit" size="sm" disabled={isAcceptPending}>
            受理
          </Button>
        </form>

        <form action={rejectAction}>
          <input type="hidden" name="resignation_id" value={props.resignationId} />

          <Button type="submit" size="sm" variant="destructive" disabled={isRejectPending}>
            却下
          </Button>
        </form>
      </div>

      {acceptState.error !== null ? <FieldError>{acceptState.error}</FieldError> : null}

      {rejectState.error !== null ? <FieldError>{rejectState.error}</FieldError> : null}
    </div>
  )
}
