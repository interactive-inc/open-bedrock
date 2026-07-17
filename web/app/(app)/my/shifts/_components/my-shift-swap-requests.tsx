"use client"

import type { ShiftFormState } from "@/app/(app)/my/shifts/actions"
import { cancelShiftSwapRequestAction } from "@/app/(app)/my/shifts/actions"
import { useFormAction } from "@/hooks/use-form-action"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { MyShiftSwapRequestResponse } from "@/lib/api/types/shift-types"

type Props = {
  swapRequests: Array<MyShiftSwapRequestResponse>
}

const initialState: ShiftFormState = { ok: false, error: null }

// 自分が出したシフト交代申請の一覧。保留中の申請には取り下げボタンを出す。
export function MyShiftSwapRequests(props: Props) {
  if (props.swapRequests.length === 0) {
    return <EmptyState title="交代申請はありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>対象日</TableHead>
            <TableHead>交代相手</TableHead>
            <TableHead>備考</TableHead>
            <TableHead>状態</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.swapRequests.map((swapRequest) => (
            <TableRow key={swapRequest.id}>
              <TableCell className="font-medium">{swapRequest.date}</TableCell>

              <TableCell>
                {swapRequest.target_employee_name ?? `#${swapRequest.target_employee_id}`}
              </TableCell>

              <TableCell className="text-muted-foreground">{swapRequest.note ?? "-"}</TableCell>

              <TableCell>
                {swapRequest.status === "approved" ? (
                  <Badge>承認済み</Badge>
                ) : (
                  <Badge variant="outline">保留中</Badge>
                )}
              </TableCell>

              <TableCell>
                <div className="flex justify-end gap-2">
                  {swapRequest.status === "pending" ? (
                    <CancelSwapRequestButton swapRequestId={swapRequest.id} />
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// 交代申請取り下げボタン。保留中のみ表示。承認済みはサーバーが拒否する。
function CancelSwapRequestButton(props: { swapRequestId: number | null }) {
  const [, formAction, pending] = useFormAction(
    cancelShiftSwapRequestAction,
    initialState,
    "交代申請を取り下げました",
  )

  return (
    <ConfirmActionDialog
      action={formAction}
      triggerLabel="取り下げ"
      title="このシフト交代申請を取り下げますか？"
      description="取り下げた交代申請は元に戻せません。"
      confirmLabel="交代申請を取り下げ"
      pending={pending}
    >
      <input type="hidden" name="swap_request_id" value={props.swapRequestId ?? undefined} />
    </ConfirmActionDialog>
  )
}
