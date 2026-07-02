"use client"

import { useActionState, useState } from "react"
import {
  cancelRentalReservationAction,
  updateRentalReservationAction,
} from "@/app/(app)/rentals/actions"
import type { RentalReservationActionState } from "@/app/(app)/rentals/actions"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
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
import type { RentalReservationResponse } from "@/lib/api/types/rental-types"
import { statusLabel } from "@/lib/status-label"

type Props = {
  reservations: ReadonlyArray<RentalReservationResponse>
}

// 自分のレンタル予約一覧。各行に変更（Dialog フォーム）と取消ボタンを置く表示コンポーネント。
export function MyReservationsList(props: Props) {
  if (props.reservations.length === 0) {
    return <EmptyState title="予約はありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>品名</TableHead>
            <TableHead>開始日</TableHead>
            <TableHead>終了日</TableHead>
            <TableHead>用途</TableHead>
            <TableHead>状態</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.reservations.map((reservation) => (
            <TableRow key={reservation.id}>
              <TableCell className="font-medium">{reservation.item_name}</TableCell>

              <TableCell>{reservation.start_date}</TableCell>

              <TableCell>{reservation.end_date}</TableCell>

              <TableCell>{reservation.purpose ?? "-"}</TableCell>

              <TableCell>{statusLabel(reservation.status)}</TableCell>

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
    </div>
  )
}

// 予約変更フォームを Dialog で開く。品名・期間・用途を編集して送信する。
function UpdateReservationDialog(props: { reservation: RentalReservationResponse }) {
  const [open, setOpen] = useState(false)

  async function reduce(
    previousState: RentalReservationActionState,
    formData: FormData,
  ): Promise<RentalReservationActionState> {
    const result = await updateRentalReservationAction(previousState, formData)

    if (result.ok) {
      setOpen(false)
    }

    return result
  }

  const [state, formAction, pending] = useActionState(reduce, {
    ok: false,
    error: null,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>予約を変更</DialogTitle>

          <DialogDescription>品名・期間・用途を変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="reservation_id" value={props.reservation.id} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="update_item_name">品名</FieldLabel>

              <Input
                id="update_item_name"
                name="item_name"
                defaultValue={props.reservation.item_name}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_start_date">開始日</FieldLabel>

              <Input
                id="update_start_date"
                name="start_date"
                type="date"
                defaultValue={props.reservation.start_date}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_end_date">終了日</FieldLabel>

              <Input
                id="update_end_date"
                name="end_date"
                type="date"
                defaultValue={props.reservation.end_date}
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

// 予約取消ボタン。Server Action を呼び、成功時はリストが revalidate される。
function CancelReservationButton(props: { reservationId: string }) {
  const [, formAction, pending] = useActionState(cancelRentalReservationAction, {
    ok: false,
    error: null,
  })

  return (
    <form action={formAction}>
      <input type="hidden" name="reservation_id" value={props.reservationId} />

      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        取消
      </Button>
    </form>
  )
}
