"use client"

import { useActionState } from "react"
import type { ShiftFormState } from "@/app/(app)/shift/actions"
import { cancelShiftSwapRequestAction } from "@/app/(app)/shift/actions"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ShiftSwapRequestResponse } from "@/lib/api/types/shift-types"

type Props = {
  swapRequests: Array<ShiftSwapRequestResponse>
}

const initialState: ShiftFormState = { ok: false, error: null }

// 自分が出したシフト交代申請の一覧。保留中の申請には取り下げボタンを出す。
export function MyShiftSwapRequests(props: Props) {
  if (props.swapRequests.length === 0) {
    return <EmptyState title="交代申請はありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>対象日</TableHead>
            <TableHead>交代相手 ID</TableHead>
            <TableHead>備考</TableHead>
            <TableHead>状態</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.swapRequests.map((swapRequest) => (
            <TableRow key={swapRequest.id}>
              <TableCell className="font-medium">{swapRequest.date}</TableCell>

              <TableCell className="tabular-nums">{swapRequest.target_employee_id}</TableCell>

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
  const [, formAction, pending] = useActionState(cancelShiftSwapRequestAction, initialState)

  return (
    <form action={formAction}>
      <input type="hidden" name="swap_request_id" value={props.swapRequestId ?? undefined} />

      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        取り下げ
      </Button>
    </form>
  )
}
