"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createRoomAction } from "@/app/(app)/organization/rooms/manage/actions"
import type { RoomCreateFormState } from "@/app/(app)/organization/rooms/manage/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const initialState: RoomCreateFormState = { ok: false, error: null }

// 会議室登録フォーム。名称・定員・任意の所在地を native form で送る。
// 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
export function RoomCreateForm() {
  const router = useRouter()

  async function reduce(
    previousState: RoomCreateFormState,
    formData: FormData,
  ): Promise<RoomCreateFormState> {
    const result = await createRoomAction(previousState, formData)

    if (result.ok) {
      toast.success("会議室を登録しました")

      router.push("/organization/rooms/manage")
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
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="room-name">名称</FieldLabel>

          <Input id="room-name" name="name" placeholder="大会議室 A" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="room-capacity">定員</FieldLabel>

          <Input
            id="room-capacity"
            name="capacity"
            type="number"
            min={1}
            placeholder="20"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="room-location">所在地（任意）</FieldLabel>

          <Input id="room-location" name="location" placeholder="5F" />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "登録中..." : "会議室を登録"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
