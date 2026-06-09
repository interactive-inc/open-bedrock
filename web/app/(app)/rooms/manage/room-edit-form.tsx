"use client"

import { useActionState, useState } from "react"
import { toast } from "sonner"
import { updateRoomAction } from "@/app/(app)/rooms/manage/actions"
import type { RoomUpdateFormState } from "@/app/(app)/rooms/manage/actions"
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

type Props = {
  // 編集対象の会議室。hidden の id と各入力の初期値に使う。
  id: number
  name: string
  capacity: number
  location: string | null
}

const initialState: RoomUpdateFormState = { ok: false, error: null }

// 会議室編集フォームを Dialog で開く。名称・定員・所在地を変更して送信する。
// 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
export function RoomEditForm(props: Props) {
  const [open, setOpen] = useState(false)

  async function reduce(
    previousState: RoomUpdateFormState,
    formData: FormData,
  ): Promise<RoomUpdateFormState> {
    const result = await updateRoomAction(previousState, formData)

    if (result.ok) {
      toast.success("会議室を更新しました")

      setOpen(false)
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>編集</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>会議室を編集</DialogTitle>

          <DialogDescription>名称・定員・所在地を変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={props.id} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit-room-name">名称</FieldLabel>

              <Input id="edit-room-name" name="name" defaultValue={props.name} required />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-room-capacity">定員</FieldLabel>

              <Input
                id="edit-room-capacity"
                name="capacity"
                type="number"
                min={1}
                defaultValue={props.capacity}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-room-location">所在地（任意）</FieldLabel>

              <Input id="edit-room-location" name="location" defaultValue={props.location ?? ""} />
            </Field>

            {state.error !== null ? (
              <p className="text-sm text-destructive">{state.error}</p>
            ) : null}

            <Button type="submit" disabled={isPending}>
              {isPending ? "更新中..." : "変更を保存"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
