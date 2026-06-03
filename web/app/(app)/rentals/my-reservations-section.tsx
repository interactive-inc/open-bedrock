import { MyReservationsList } from "@/app/(app)/rentals/my-reservations-list"
import { listMyRentalReservations } from "@/lib/api/list-my-rental-reservations"

// 自分のレンタル予約を取得して一覧コンポーネントへ渡す非同期 RSC。
export async function MyReservationsSection() {
  const reservations = await listMyRentalReservations()

  if (reservations instanceof Error) {
    return <p className="text-sm text-destructive">予約一覧の取得に失敗しました</p>
  }

  return <MyReservationsList reservations={reservations} />
}
