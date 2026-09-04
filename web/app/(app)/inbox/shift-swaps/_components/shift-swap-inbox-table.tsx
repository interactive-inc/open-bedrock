"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { approveShiftSwapRequestAction, type ShiftFormState } from "@/app/(app)/my/shifts/actions"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"
import { EmptyState } from "@/components/empty-state"
import { FieldError } from "@/components/ui/field"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ShiftSwapRequestInboxResponse } from "@/lib/api/types/shift-types"

const initialState: ShiftFormState = { ok: false, error: null }

export function ShiftSwapInboxTable(props: {
  requests: ReadonlyArray<ShiftSwapRequestInboxResponse>
}) {
  if (props.requests.length === 0) {
    return <EmptyState title="承認待ちのシフト交代申請はありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="承認待ちのシフト交代申請">
        <TableHeader>
          <TableRow>
            <TableHead>対象日</TableHead>
            <TableHead>申請者</TableHead>
            <TableHead>交代相手</TableHead>
            <TableHead>メモ</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.requests.map((request) => (
            <TableRow key={request.id}>
              <TableCell>{request.date}</TableCell>
              <TableCell>{request.requester_employee_code}</TableCell>
              <TableCell>{request.target_employee_code}</TableCell>
              <TableCell>{request.note ?? "-"}</TableCell>
              <TableCell>
                <ApproveButton request={request} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ApproveButton(props: { request: ShiftSwapRequestInboxResponse }) {
  async function reduce(previousState: ShiftFormState, formData: FormData) {
    const result = await approveShiftSwapRequestAction(previousState, formData)

    if (result.ok) {
      toast.success("シフト交代を承認しました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const [state, formAction, pending] = useActionState(reduce, initialState)

  return (
    <div className="flex flex-col gap-2">
      <ConfirmActionDialog
        action={formAction}
        triggerLabel="承認"
        title="このシフト交代を承認しますか？"
        description="承認すると対象日の2人のシフト割当が入れ替わります。"
        confirmLabel="交代を承認"
        pending={pending}
        variant="default"
      >
        <input type="hidden" name="swap_request_id" value={props.request.id} />
      </ConfirmActionDialog>

      {state.error === null ? null : <FieldError>{state.error}</FieldError>}
    </div>
  )
}
