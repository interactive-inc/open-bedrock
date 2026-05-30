import { createClient } from "@/lib/api/hc-client"
import type { RoomAvailabilitySearch } from "@/lib/api/types/room-types"

// GET /rooms/availability。指定期間・最低定員で各会議室の空き状況を取得する。
// start_at / end_at は必須クエリ。capacity は 0 で全件。null のキーは送信されない。
export async function getRoomAvailability(search: RoomAvailabilitySearch) {
  const client = await createClient()

  const response = await client.rooms.availability.$get({
    query: {
      start_at: search.startAt ?? undefined,
      end_at: search.endAt ?? undefined,
      capacity: search.capacity === null ? undefined : String(search.capacity),
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load room availability")
  }

  return response.json()
}
