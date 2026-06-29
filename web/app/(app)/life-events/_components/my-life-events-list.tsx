"use client"

import { useActionState, useState } from "react"
import { cancelLifeEventAction, updateLifeEventAction } from "@/app/(app)/life-events/actions"
import type { LifeEventActionState } from "@/app/(app)/life-events/actions"
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
import type { LifeEventResponse } from "@/lib/api/types/life-event-types"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

type Props = {
  lifeEvents: ReadonlyArray<LifeEventResponse>
}

// 自分のライフイベント届出一覧。各行に変更（Dialog フォーム）と取消ボタンを置く表示コンポーネント。
export function MyLifeEventsList(props: Props) {
  if (props.lifeEvents.length === 0) {
    return <EmptyState title="ライフイベント届出はありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>種別</TableHead>
            <TableHead>発生日</TableHead>
            <TableHead>詳細</TableHead>
            <TableHead>状態</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.lifeEvents.map((lifeEvent) => (
            <TableRow key={lifeEvent.id}>
              <TableCell className="font-medium">{lifeEvent.event_type}</TableCell>

              <TableCell>{lifeEvent.event_date}</TableCell>

              <TableCell>{lifeEvent.detail ?? "-"}</TableCell>

              <TableCell>{lifeEvent.status}</TableCell>

              <TableCell>
                <div className="flex justify-end gap-2">
                  <UpdateLifeEventDialog lifeEvent={lifeEvent} />

                  <CancelLifeEventButton lifeEventId={lifeEvent.id} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ライフイベント届出変更フォームを Dialog で開く。種別・発生日・詳細を編集して送信する。
function UpdateLifeEventDialog(props: { lifeEvent: LifeEventResponse }) {
  const [open, setOpen] = useState(false)

  async function reduce(
    previousState: LifeEventActionState,
    formData: FormData,
  ): Promise<LifeEventActionState> {
    const result = await updateLifeEventAction(previousState, formData)

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
          <DialogTitle>ライフイベント届出を変更</DialogTitle>

          <DialogDescription>種別・発生日・詳細を変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="life_event_id" value={props.lifeEvent.id} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="update_event_type">種別</FieldLabel>

              <Input
                id="update_event_type"
                name="event_type"
                defaultValue={props.lifeEvent.event_type}
                maxLength={FORM_CONSTRAINTS.lifeEvent.eventTypeMax}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_event_date">発生日</FieldLabel>

              <Input
                id="update_event_date"
                name="event_date"
                type="date"
                defaultValue={props.lifeEvent.event_date}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_detail">詳細</FieldLabel>

              <Input
                id="update_detail"
                name="detail"
                defaultValue={props.lifeEvent.detail ?? ""}
                maxLength={FORM_CONSTRAINTS.lifeEvent.detailMax}
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

// ライフイベント届出取消ボタン。Server Action を呼び、成功時はリストが revalidate される。
function CancelLifeEventButton(props: { lifeEventId: string }) {
  const [_state, formAction, pending] = useActionState(cancelLifeEventAction, {
    ok: false,
    error: null,
  })

  return (
    <form action={formAction}>
      <input type="hidden" name="life_event_id" value={props.lifeEventId} />

      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        取消
      </Button>
    </form>
  )
}
