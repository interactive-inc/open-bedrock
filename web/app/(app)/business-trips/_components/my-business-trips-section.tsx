import { MyBusinessTripsList } from "@/app/(app)/business-trips/_components/my-business-trips-list"
import { listMyBusinessTrips } from "@/lib/api/list-my-business-trips"

// 自分の出張申請を取得して一覧コンポーネントへ渡す非同期 RSC。
export async function MyBusinessTripsSection() {
  const businessTrips = await listMyBusinessTrips()

  if (businessTrips instanceof Error) {
    return <p className="text-sm text-destructive">出張申請一覧の取得に失敗しました</p>
  }

  return <MyBusinessTripsList businessTrips={businessTrips} />
}
