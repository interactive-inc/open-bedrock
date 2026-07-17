import { MyReservationsList } from "@/app/(app)/my/rentals/_components/my-reservations-list"
import { FetchError } from "@/components/fetch-error"
import { listMyRentalReservations } from "@/lib/api/list-my-rental-reservations"

// 自分のレンタル予約を取得して一覧コンポーネントへ渡す非同期 RSC。
export async function MyReservationsSection() {
  const reservations = await listMyRentalReservations()

  if (reservations instanceof Error) {
    return <FetchError message="予約一覧の取得に失敗しました" />
  }

  return <MyReservationsList reservations={reservations} />
}
