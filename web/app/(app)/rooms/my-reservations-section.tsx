import { MyReservationsList } from "@/app/(app)/rooms/my-reservations-list"
import { listMyRoomReservations } from "@/lib/api/list-my-room-reservations"

// 自分の会議室予約を取得して一覧コンポーネントへ渡す非同期 RSC。
export async function MyReservationsSection() {
  const reservations = await listMyRoomReservations()

  if (reservations instanceof Error) {
    return <p className="text-sm text-destructive">予約一覧の取得に失敗しました</p>
  }

  return <MyReservationsList reservations={reservations} />
}
