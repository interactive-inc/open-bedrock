"use client"

import { useState } from "react"
import { formatDateTime } from "@/lib/format-date-time"
import {
  cancelRoomReservationAction,
  updateRoomReservationAction,
} from "@/app/(app)/organization/rooms/actions"
import type { RoomReservationActionState } from "@/app/(app)/organization/rooms/actions"
import { useFormAction } from "@/hooks/use-form-action"
import { EmptyState } from "@/components/empty-state"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { RoomReservationResponse } from "@/lib/api/types/room-types"

type Props = {
  reservations: ReadonlyArray<RoomReservationResponse>
  roomNameMap: Record<number, string>
}

/** 自分の会議室予約一覧。各行に変更（Dialog フォーム）とキャンセルボタンを置く表示コンポーネント。 */
export function MyReservationsList(props: Props) {
  if (props.reservations.length === 0) {
    return <EmptyState title="予約はありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>会議室</TableHead>
            <TableHead>開始</TableHead>
            <TableHead>終了</TableHead>
            <TableHead>用途</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.reservations.map((reservation) => (
            <TableRow key={reservation.id}>
              <TableCell className="font-medium">
                {props.roomNameMap[reservation.room_id] ?? `#${reservation.room_id}`}
              </TableCell>

              <TableCell>{formatDateTime(reservation.start_at)}</TableCell>

              <TableCell>{formatDateTime(reservation.end_at)}</TableCell>

              <TableCell>{reservation.purpose ?? "-"}</TableCell>

              <TableCell>
                <TableRowActions>
                  <UpdateReservationDialog reservation={reservation} />

                  <CancelReservationButton reservationId={reservation.id} />
                </TableRowActions>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** 予約変更フォームを Dialog で開く。開始・終了・用途を編集して送信する。 */
function UpdateReservationDialog(props: { reservation: RoomReservationResponse }) {
  const [open, setOpen] = useState(false)

  const [state, formAction, pending] = useFormAction(
    updateRoomReservationAction,
    { ok: false, error: null } satisfies RoomReservationActionState,
    "予約を変更しました",
    { onSuccess: () => setOpen(false) },
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>予約を変更</DialogTitle>

          <DialogDescription>開始・終了日時と用途を変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="reservation_id" value={props.reservation.id} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="update_start_at">開始日時</FieldLabel>

              <Input
                id="update_start_at"
                name="start_at"
                type="datetime-local"
                defaultValue={toLocalInput(props.reservation.start_at)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_end_at">終了日時</FieldLabel>

              <Input
                id="update_end_at"
                name="end_at"
                type="datetime-local"
                defaultValue={toLocalInput(props.reservation.end_at)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_purpose">用途</FieldLabel>

              <Input
                id="update_purpose"
                name="purpose"
                defaultValue={props.reservation.purpose ?? ""}
              />
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

/** 予約キャンセルボタン。Server Action を呼び、成功時はリストが revalidate される。 */
function CancelReservationButton(props: { reservationId: string }) {
  const [_state, formAction, pending] = useFormAction(
    cancelRoomReservationAction,
    {
      ok: false,
      error: null,
    },
    "予約をキャンセルしました",
  )

  return (
    <ConfirmActionDialog
      action={formAction}
      triggerLabel="キャンセル"
      title="この会議室予約をキャンセルしますか？"
      description="キャンセルした予約は元に戻せません。"
      confirmLabel="予約をキャンセル"
      pending={pending}
    >
      <input type="hidden" name="reservation_id" value={props.reservationId} />
    </ConfirmActionDialog>
  )
}

/** ISO 文字列を datetime-local input 用の "YYYY-MM-DDTHH:mm" へ整形する。 */
function toLocalInput(isoString: string): string {
  return isoString.slice(0, 16)
}
