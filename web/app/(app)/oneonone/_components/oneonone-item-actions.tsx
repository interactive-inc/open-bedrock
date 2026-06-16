"use client"

import { useActionState, useState } from "react"
import { toast } from "sonner"
import { deleteOneOnOneAction, updateOneOnOneAction } from "@/app/(app)/oneonone/actions"
import type { OneOnOneActionState } from "@/app/(app)/oneonone/actions"
import type { OneOnOne } from "@/lib/api/types/oneonone-types"
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
import { Textarea } from "@/components/ui/textarea"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

type Props = {
  oneOnOne: OneOnOne
}

const initialState: OneOnOneActionState = { ok: false, error: null }

// 1on1 カードの操作群。記録内容の変更（Dialog）と削除ボタンを横並びにする client コンポーネント。
export function OneOnOneItemActions(props: Props) {
  return (
    <div className="flex justify-end gap-2">
      <UpdateOneOnOneDialog oneOnOne={props.oneOnOne} />

      <DeleteOneOnOneButton oneOnOneId={props.oneOnOne.id} />
    </div>
  )
}

// 記録内容を変更する Dialog フォーム。topics / manager_note / next_action を編集して送信する。
function UpdateOneOnOneDialog(props: { oneOnOne: OneOnOne }) {
  const [open, setOpen] = useState(false)

  async function reduce(
    previousState: OneOnOneActionState,
    formData: FormData,
  ): Promise<OneOnOneActionState> {
    const result = await updateOneOnOneAction(previousState, formData)

    if (result.ok) {
      toast.success("1on1 を変更しました")
      setOpen(false)
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const [state, formAction, pending] = useActionState(reduce, initialState)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>1on1 を変更</DialogTitle>

          <DialogDescription>
            トピック・上長メモ・ネクストアクションを変更します。
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="one_on_one_id" value={props.oneOnOne.id} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="update-topics">トピック</FieldLabel>

              <Textarea
                id="update-topics"
                name="topics"
                defaultValue={props.oneOnOne.topics ?? ""}
                rows={3}
                maxLength={FORM_CONSTRAINTS.oneOnOne.textMax}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update-manager-note">上長メモ</FieldLabel>

              <Textarea
                id="update-manager-note"
                name="manager_note"
                defaultValue={props.oneOnOne.manager_note ?? ""}
                rows={3}
                maxLength={FORM_CONSTRAINTS.oneOnOne.textMax}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update-next-action">ネクストアクション</FieldLabel>

              <Textarea
                id="update-next-action"
                name="next_action"
                defaultValue={props.oneOnOne.next_action ?? ""}
                rows={2}
                maxLength={FORM_CONSTRAINTS.oneOnOne.textMax}
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

// 1on1 削除ボタン。Server Action を呼び、成功時はリストが revalidate される。
function DeleteOneOnOneButton(props: { oneOnOneId: string }) {
  async function reduce(
    previousState: OneOnOneActionState,
    formData: FormData,
  ): Promise<OneOnOneActionState> {
    const result = await deleteOneOnOneAction(previousState, formData)

    if (result.ok) {
      toast.success("1on1 を削除しました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const [, formAction, pending] = useActionState(reduce, initialState)

  return (
    <form action={formAction}>
      <input type="hidden" name="one_on_one_id" value={props.oneOnOneId} />

      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        削除
      </Button>
    </form>
  )
}
