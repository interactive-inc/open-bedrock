import { MyReservationsList } from "@/app/(app)/organization/rooms/_components/my-reservations-list"
import { FetchError } from "@/components/fetch-error"
import { getRoomList } from "@/lib/api/get-room-list"
import { listMyRoomReservations } from "@/lib/api/list-my-room-reservations"

/** 自分の会議室予約を取得して一覧コンポーネントへ渡す非同期 RSC。 */
export async function MyReservationsSection() {
  const reservations = await listMyRoomReservations()

  if (reservations instanceof Error) {
    return <FetchError message="予約一覧の取得に失敗しました" />
  }

  const rooms = await getRoomList()

  const roomNameMap: Record<number, string> =
    rooms instanceof Error ? {} : Object.fromEntries(rooms.map((r) => [r.id, r.name]))

  return <MyReservationsList reservations={reservations} roomNameMap={roomNameMap} />
}
