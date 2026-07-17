"use client"

import { useActionState } from "react"
import {
  approveFamilyCareLeaveAction,
  cancelFamilyCareLeaveApprovalAction,
} from "@/app/(app)/my/family-care-leaves/actions"
import type { FamilyCareLeaveActionState } from "@/app/(app)/my/family-care-leaves/actions"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"

type Props = {
  familyCareLeaveId: string
}

const initialState: FamilyCareLeaveActionState = { ok: false, error: null }

// admin 一覧の行アクション。requested の申出を人事が承認/取消する。
export function FamilyCareLeaveAdminActions(props: Props) {
  const approve = useActionState(approveFamilyCareLeaveAction, initialState)

  const cancel = useActionState(cancelFamilyCareLeaveApprovalAction, initialState)

  const approveState = approve[0]

  const approveAction = approve[1]

  const isApprovePending = approve[2]

  const cancelState = cancel[0]

  const cancelAction = cancel[1]

  const isCancelPending = cancel[2]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <form action={approveAction}>
          <input type="hidden" name="family_care_leave_id" value={props.familyCareLeaveId} />

          <Button type="submit" size="sm" disabled={isApprovePending}>
            承認
          </Button>
        </form>

        <form action={cancelAction}>
          <input type="hidden" name="family_care_leave_id" value={props.familyCareLeaveId} />

          <Button type="submit" size="sm" variant="destructive" disabled={isCancelPending}>
            取消
          </Button>
        </form>
      </div>

      {approveState.error !== null ? <FieldError>{approveState.error}</FieldError> : null}

      {cancelState.error !== null ? <FieldError>{cancelState.error}</FieldError> : null}
    </div>
  )
}
