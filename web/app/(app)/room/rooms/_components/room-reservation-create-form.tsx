"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { createRoomReservationAction } from "@/app/(app)/room/rooms/actions"
import type { RoomReservationActionState } from "@/app/(app)/room/rooms/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { RoomAvailability } from "@/lib/api/types/room-types"

type Props = {
  availabilities: ReadonlyArray<RoomAvailability>
  startAt: string
  endAt: string
}

const initialState: RoomReservationActionState = { ok: false, error: null }

/**
 * 会議室予約フォーム。native form + Server Action を useActionState で呼び、結果を sonner で通知する。
 * 検索した期間を開始/終了の初期値にし、空いている会議室のみを選択肢に出す。
 * reducer 内で Server Action を 1 回だけ実行し、その結果で toast() する（useEffect は使わない）。
 */
export function RoomReservationCreateForm(props: Props) {
  /** useActionState の reducer。Server Action を実行し結果をそのまま次の state にする。 */
  async function reduce(
    previousState: RoomReservationActionState,
    formData: FormData,
  ): Promise<RoomReservationActionState> {
    const result = await createRoomReservationAction(previousState, formData)

    if (result.ok) {
      toast.success("会議室を予約しました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  const availableRooms = props.availabilities.filter((availability) => availability.available)

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl bg-card border p-4">
      <h2 className="text-lg font-medium">会議室を予約</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="room-reserve-room">会議室</FieldLabel>

          <select
            id="room-reserve-room"
            name="room_id"
            className="border-input bg-transparent flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {availableRooms.map((availability) => (
              <option key={availability.room.id} value={availability.room.id}>
                {availability.room.name}（{availability.room.capacity} 名）
              </option>
            ))}
          </select>
        </Field>

        <Field>
          <FieldLabel htmlFor="room-reserve-purpose">用途</FieldLabel>

          <Input id="room-reserve-purpose" name="purpose" placeholder="任意" />
        </Field>

        <Field>
          <FieldLabel htmlFor="room-reserve-start">開始日時</FieldLabel>

          <Input
            id="room-reserve-start"
            name="start_at"
            type="datetime-local"
            defaultValue={props.startAt}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="room-reserve-end">終了日時</FieldLabel>

          <Input
            id="room-reserve-end"
            name="end_at"
            type="datetime-local"
            defaultValue={props.endAt}
            required
          />
        </Field>
      </div>

      <FieldDescription>
        空いている会議室のみ選択できます。重複する時間帯は予約できません
      </FieldDescription>

      {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

      <div>
        <Button type="submit" disabled={isPending || availableRooms.length === 0}>
          {isPending ? "予約中..." : "予約する"}
        </Button>
      </div>
    </form>
  )
}
