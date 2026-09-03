"use client"

import { formatDateTime } from "@/lib/format-date-time"
import { useActionState, useState } from "react"
import { toast } from "sonner"
import { cancelLeaveRequestAction, updateLeaveRequestAction } from "@/app/(app)/my/leaves/actions"
import type { LeaveActionState } from "@/app/(app)/my/leaves/actions"
import { LeaveStatusBadge } from "@/components/leave-status-badge"
import { LeaveTypeLabel } from "@/components/leave-type-label"
import { TableRowActions } from "@/components/table-row-actions"
import { Button } from "@/components/ui/button"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { LeaveRequestMineResponse } from "@/lib/api/types/leave-types"

type Props = {
  leaveRequests: ReadonlyArray<LeaveRequestMineResponse>
}

/** 自分の休暇申請一覧。pending の行にのみ変更（Dialog フォーム）と取り下げボタンを置く表示コンポーネント。 */
export function MyLeaveRequestsList(props: Props) {
  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>種別</TableHead>

            <TableHead>期間</TableHead>

            <TableHead>日数</TableHead>

            <TableHead>ステータス</TableHead>

            <TableHead>申請日</TableHead>

            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.leaveRequests.map((leaveRequest) => (
            <TableRow key={leaveRequest.id}>
              <TableCell>
                <LeaveTypeLabel leaveType={leaveRequest.leave_type} />
              </TableCell>

              <TableCell>
                {leaveRequest.start_date} 〜 {leaveRequest.end_date}
              </TableCell>

              <TableCell>{leaveRequest.days} 日</TableCell>

              <TableCell>
                <LeaveStatusBadge status={leaveRequest.status} />
              </TableCell>

              <TableCell>{formatDateTime(leaveRequest.created_at)}</TableCell>

              <TableCell>
                <TableRowActions>
                  {leaveRequest.status === "pending" ? (
                    <UpdateLeaveRequestDialog leaveRequest={leaveRequest} />
                  ) : null}

                  {leaveRequest.status === "pending" ? (
                    <CancelLeaveRequestButton leaveRequestId={leaveRequest.id} />
                  ) : null}
                </TableRowActions>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** 休暇申請変更フォームを Dialog で開く。種別・開始日・終了日・理由を編集して送信する。 */
function UpdateLeaveRequestDialog(props: { leaveRequest: LeaveRequestMineResponse }) {
  const [open, setOpen] = useState(false)

  async function reduce(
    previousState: LeaveActionState,
    formData: FormData,
  ): Promise<LeaveActionState> {
    const result = await updateLeaveRequestAction(previousState, formData)

    if (result.ok) {
      toast.success("休暇申請を更新しました")

      setOpen(false)
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const [state, formAction, pending] = useActionState(reduce, {
    ok: false,
    error: null,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="secondary" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>休暇申請を変更</DialogTitle>

          <DialogDescription>種別・期間・理由を変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="leave_request_id" value={props.leaveRequest.id} />

          <input type="hidden" name="unit" value={props.leaveRequest.unit} />

          <input type="hidden" name="hours" value={props.leaveRequest.hours ?? ""} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="update_leave_type">種別</FieldLabel>

              <NativeSelect
                id="update_leave_type"
                name="leave_type"
                defaultValue={props.leaveRequest.leave_type}
                className="w-full"
              >
                <NativeSelectOption value="annual">年次有給</NativeSelectOption>

                <NativeSelectOption value="special">特別休暇</NativeSelectOption>

                <NativeSelectOption value="compensatory">代休</NativeSelectOption>

                <NativeSelectOption value="summer">夏季休暇</NativeSelectOption>

                <NativeSelectOption value="child_nursing_care">子の看護等休暇</NativeSelectOption>

                <NativeSelectOption value="prenatal_checkup">妊婦通院休暇</NativeSelectOption>

                <NativeSelectOption value="menstrual">生理休暇</NativeSelectOption>

                <NativeSelectOption value="caregiving_leave">介護休暇</NativeSelectOption>
              </NativeSelect>
            </Field>

            <Field>
              <FieldLabel htmlFor="update_start_date">開始日</FieldLabel>

              <Input
                id="update_start_date"
                name="start_date"
                type="date"
                defaultValue={props.leaveRequest.start_date}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_end_date">終了日</FieldLabel>

              <Input
                id="update_end_date"
                name="end_date"
                type="date"
                defaultValue={props.leaveRequest.end_date}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_reason">理由</FieldLabel>

              <Input id="update_reason" name="reason" />
            </Field>
          </FieldGroup>

          {state.error === null ? null : <FieldError>{state.error}</FieldError>}

          <Button type="submit" disabled={pending}>
            変更を保存
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** 休暇申請取り下げボタン。成功・失敗の通知は action の結果を見て toast() で出す。 */
function CancelLeaveRequestButton(props: { leaveRequestId: number }) {
  async function reduce(
    previousState: LeaveActionState,
    formData: FormData,
  ): Promise<LeaveActionState> {
    const result = await cancelLeaveRequestAction(previousState, formData)

    if (result.ok) {
      toast.success("休暇申請を取り下げました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const [_state, formAction, pending] = useActionState(reduce, {
    ok: false,
    error: null,
  })

  return (
    <ConfirmActionDialog
      action={formAction}
      triggerLabel="取り下げ"
      title="この休暇申請を取り下げますか？"
      description="取り下げた休暇申請は元に戻せません。"
      confirmLabel="休暇申請を取り下げ"
      pending={pending}
    >
      <input type="hidden" name="leave_request_id" value={props.leaveRequestId} />
    </ConfirmActionDialog>
  )
}
