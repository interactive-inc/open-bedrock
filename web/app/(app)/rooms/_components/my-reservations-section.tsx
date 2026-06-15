import { MyReservationsList } from "@/app/(app)/rooms/_components/my-reservations-list"
import { FetchError } from "@/components/fetch-error"
import { listMyRoomReservations } from "@/lib/api/list-my-room-reservations"

// 自分の会議室予約を取得して一覧コンポーネントへ渡す非同期 RSC。
export async function MyReservationsSection() {
  const reservations = await listMyRoomReservations()

  if (reservations instanceof Error) {
    return <FetchError message="予約一覧の取得に失敗しました" />
  }

  return <MyReservationsList reservations={reservations} />
}
