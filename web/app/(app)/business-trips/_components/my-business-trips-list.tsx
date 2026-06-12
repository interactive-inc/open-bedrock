"use client"

import { useActionState, useState } from "react"
import {
  cancelBusinessTripAction,
  updateBusinessTripAction,
} from "@/app/(app)/business-trips/actions"
import type { BusinessTripActionState } from "@/app/(app)/business-trips/actions"
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
import type { BusinessTripResponse } from "@/lib/api/types/business-trip-types"

type Props = {
  businessTrips: ReadonlyArray<BusinessTripResponse>
}

// 自分の出張申請一覧。各行に変更（Dialog フォーム）と取消ボタンを置く表示コンポーネント。
export function MyBusinessTripsList(props: Props) {
  if (props.businessTrips.length === 0) {
    return <p className="text-sm text-muted-foreground">出張申請はありません</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>行き先</TableHead>
          <TableHead>開始</TableHead>
          <TableHead>終了</TableHead>
          <TableHead>目的</TableHead>
          <TableHead>概算費用</TableHead>
          <TableHead>状態</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {props.businessTrips.map((businessTrip) => (
          <TableRow key={businessTrip.id}>
            <TableCell className="font-medium">{businessTrip.destination}</TableCell>

            <TableCell>{businessTrip.start_date}</TableCell>

            <TableCell>{businessTrip.end_date}</TableCell>

            <TableCell>{businessTrip.purpose}</TableCell>

            <TableCell>{businessTrip.estimated_cost ?? "-"}</TableCell>

            <TableCell>{businessTrip.status}</TableCell>

            <TableCell>
              <div className="flex justify-end gap-2">
                <UpdateBusinessTripDialog businessTrip={businessTrip} />

                <CancelBusinessTripButton businessTripId={businessTrip.id} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// 出張申請変更フォームを Dialog で開く。行き先・期間・目的・概算費用を編集して送信する。
function UpdateBusinessTripDialog(props: { businessTrip: BusinessTripResponse }) {
  const [open, setOpen] = useState(false)

  async function reduce(
    previousState: BusinessTripActionState,
    formData: FormData,
  ): Promise<BusinessTripActionState> {
    const result = await updateBusinessTripAction(previousState, formData)

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
          <DialogTitle>出張申請を変更</DialogTitle>

          <DialogDescription>行き先・期間・目的・概算費用を変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="business_trip_id" value={props.businessTrip.id} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="update_destination">行き先</FieldLabel>

              <Input
                id="update_destination"
                name="destination"
                defaultValue={props.businessTrip.destination}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_start_date">開始日</FieldLabel>

              <Input
                id="update_start_date"
                name="start_date"
                type="date"
                defaultValue={props.businessTrip.start_date}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_end_date">終了日</FieldLabel>

              <Input
                id="update_end_date"
                name="end_date"
                type="date"
                defaultValue={props.businessTrip.end_date}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_purpose">目的</FieldLabel>

              <Input id="update_purpose" name="purpose" defaultValue={props.businessTrip.purpose} />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_estimated_cost">概算費用</FieldLabel>

              <Input
                id="update_estimated_cost"
                name="estimated_cost"
                type="number"
                min="0"
                defaultValue={props.businessTrip.estimated_cost ?? ""}
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

// 出張申請取消ボタン。Server Action を呼び、成功時はリストが revalidate される。
function CancelBusinessTripButton(props: { businessTripId: string }) {
  const [_state, formAction, pending] = useActionState(cancelBusinessTripAction, {
    ok: false,
    error: null,
  })

  return (
    <form action={formAction}>
      <input type="hidden" name="business_trip_id" value={props.businessTripId} />

      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        取消
      </Button>
    </form>
  )
}
