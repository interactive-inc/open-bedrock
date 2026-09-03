import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { RoomAvailabilitySearch } from "@/lib/api/types/room-types"

type Props = {
  search: RoomAvailabilitySearch
}

/**
 * 会議室の空き状況絞り込みフォーム。
 * method=get で /rooms に submit し、searchParams を更新する（クライアント JS 不要）。
 */
export function RoomAvailabilitySearchForm(props: Props) {
  return (
    <form method="get" action="/room/rooms">
      <FieldSet>
        <FieldGroup className="flex-row flex-wrap items-end gap-4">
          <Field className="w-full sm:w-60">
            <FieldLabel htmlFor="room-search-start">開始日時</FieldLabel>

            <Input
              id="room-search-start"
              name="start_at"
              type="datetime-local"
              defaultValue={props.search.startAt ?? ""}
            />
          </Field>

          <Field className="w-full sm:w-60">
            <FieldLabel htmlFor="room-search-end">終了日時</FieldLabel>

            <Input
              id="room-search-end"
              name="end_at"
              type="datetime-local"
              defaultValue={props.search.endAt ?? ""}
            />
          </Field>

          <Field className="w-full sm:w-32">
            <FieldLabel htmlFor="room-search-capacity">最低定員</FieldLabel>

            <Input
              id="room-search-capacity"
              name="capacity"
              type="number"
              min={0}
              defaultValue={props.search.capacity ?? ""}
              placeholder="0"
            />
          </Field>

          <Button type="submit">空きを検索</Button>
        </FieldGroup>
      </FieldSet>
    </form>
  )
}
