import { MyBusinessTripsList } from "@/app/(app)/my/business-trips/_components/my-business-trips-list"
import { FetchError } from "@/components/fetch-error"
import { listMyBusinessTrips } from "@/lib/api/list-my-business-trips"

/** 自分の出張申請を取得して一覧コンポーネントへ渡す非同期 RSC。 */
export async function MyBusinessTripsSection() {
  const businessTrips = await listMyBusinessTrips()

  if (businessTrips instanceof Error) {
    return <FetchError message="出張申請一覧の取得に失敗しました" />
  }

  return <MyBusinessTripsList businessTrips={businessTrips} />
}
