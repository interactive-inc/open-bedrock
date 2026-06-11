"use client"

import { useActionState, useState } from "react"
import { cancelRoomReservationAction, updateRoomReservationAction } from "@/app/(app)/rooms/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
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
}

// 自分の会議室予約一覧。各行に変更（Dialog フォーム）とキャンセルボタンを置く表示コンポーネント。
export function MyReservationsList(props: Props) {
  if (props.reservations.length === 0) {
    return <p className="text-sm text-muted-foreground">予約はありません</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>会議室 ID</TableHead>
          <TableHead>開始</TableHead>
          <TableHead>終了</TableHead>
          <TableHead>用途</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {props.reservations.map((reservation) => (
          <TableRow key={reservation.id}>
            <TableCell className="font-medium">{reservation.room_id}</TableCell>

            <TableCell>{reservation.start_at}</TableCell>

            <TableCell>{reservation.end_at}</TableCell>

            <TableCell>{reservation.purpose ?? "-"}</TableCell>

            <TableCell>
              <div className="flex justify-end gap-2">
                <UpdateReservationDialog reservation={reservation} />

                <CancelReservationButton reservationId={reservation.id} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// 予約変更フォームを Dialog で開く。開始・終了・用途を編集して送信する。
function UpdateReservationDialog(props: { reservation: RoomReservationResponse }) {
  const [open, setOpen] = useState(false)

  const [state, formAction, pending] = useActionState(updateRoomReservationAction, {
    ok: false,
    error: null,
  })

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

          {state.error === null ? null : <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" disabled={pending}>
            変更を保存
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// 予約キャンセルボタン。Server Action を呼び、成功時はリストが revalidate される。
function CancelReservationButton(props: { reservationId: string }) {
  const [_state, formAction, pending] = useActionState(cancelRoomReservationAction, {
    ok: false,
    error: null,
  })

  return (
    <form action={formAction}>
      <input type="hidden" name="reservation_id" value={props.reservationId} />

      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        キャンセル
      </Button>
    </form>
  )
}

// ISO 文字列を datetime-local input 用の "YYYY-MM-DDTHH:mm" へ整形する。
function toLocalInput(isoString: string): string {
  return isoString.slice(0, 16)
}
