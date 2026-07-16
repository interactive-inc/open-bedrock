"use client"

import { useState } from "react"
import {
  cancelBusinessTripAction,
  updateBusinessTripAction,
} from "@/app/(app)/business-trips/actions"
import { useFormAction } from "@/hooks/use-form-action"
import { useIsMobile } from "@/hooks/use-mobile"
import { EmptyState } from "@/components/empty-state"
import { TableRowActions } from "@/components/table-row-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import type { BusinessTripResponse } from "@/lib/api/types/business-trip-types"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"
import { statusLabel } from "@/lib/status-label"

type Props = {
  businessTrips: ReadonlyArray<BusinessTripResponse>
}

// 自分の出張申請一覧。各行に変更（Dialog フォーム）と取消ボタンを置く表示コンポーネント。
// モバイル幅ではテーブルではなく1件1カードの label:value レイアウトに切り替える。
export function MyBusinessTripsList(props: Props) {
  const isMobile = useIsMobile()

  if (props.businessTrips.length === 0) {
    return <EmptyState title="出張申請はありません" />
  }

  if (isMobile) {
    return (
      <div className="flex flex-col gap-3">
        {props.businessTrips.map((businessTrip) => (
          <Card key={businessTrip.id}>
            <CardContent className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{businessTrip.destination}</span>
                <span className="text-muted-foreground">{statusLabel(businessTrip.status)}</span>
              </div>

              <BusinessTripField label="期間">
                {businessTrip.start_date} 〜 {businessTrip.end_date}
              </BusinessTripField>

              <BusinessTripField label="目的">{businessTrip.purpose}</BusinessTripField>

              <BusinessTripField label="概算費用">
                {businessTrip.estimated_cost ?? "-"}
              </BusinessTripField>

              <TableRowActions className="pt-2">
                <UpdateBusinessTripDialog businessTrip={businessTrip} />

                <CancelBusinessTripButton businessTripId={businessTrip.id} />
              </TableRowActions>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
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

              <TableCell>{statusLabel(businessTrip.status)}</TableCell>

              <TableCell>
                <TableRowActions>
                  <UpdateBusinessTripDialog businessTrip={businessTrip} />

                  <CancelBusinessTripButton businessTripId={businessTrip.id} />
                </TableRowActions>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// カード表示内の label:value 行。
function BusinessTripField(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{props.label}</span>
      <span>{props.children}</span>
    </div>
  )
}

// 出張申請変更フォームを Dialog で開く。行き先・期間・目的・概算費用を編集して送信する。
function UpdateBusinessTripDialog(props: { businessTrip: BusinessTripResponse }) {
  const [open, setOpen] = useState(false)

  const [state, formAction, pending] = useFormAction(
    updateBusinessTripAction,
    { ok: false, error: null },
    "出張申請を変更しました",
    { onSuccess: () => setOpen(false) },
  )

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
                maxLength={FORM_CONSTRAINTS.businessTrip.destinationMax}
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

              <Input
                id="update_purpose"
                name="purpose"
                defaultValue={props.businessTrip.purpose}
                maxLength={FORM_CONSTRAINTS.businessTrip.purposeMax}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_estimated_cost">概算費用</FieldLabel>

              <Input
                id="update_estimated_cost"
                name="estimated_cost"
                type="number"
                min={FORM_CONSTRAINTS.businessTrip.estimatedCostMin}
                step={1}
                defaultValue={props.businessTrip.estimated_cost ?? ""}
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

// 出張申請取消ボタン。Server Action を呼び、成功時はリストが revalidate される。
function CancelBusinessTripButton(props: { businessTripId: string }) {
  const [_state, formAction, pending] = useFormAction(
    cancelBusinessTripAction,
    {
      ok: false,
      error: null,
    },
    "出張申請を取り消しました",
  )

  return (
    <ConfirmActionDialog
      action={formAction}
      triggerLabel="取消"
      title="この出張申請を取り消しますか？"
      description="取り消した申請は元に戻せません。"
      confirmLabel="出張申請を取り消す"
      pending={pending}
    >
      <input type="hidden" name="business_trip_id" value={props.businessTripId} />
    </ConfirmActionDialog>
  )
}
