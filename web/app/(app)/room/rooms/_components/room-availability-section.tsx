import { RoomAvailabilityTable } from "@/app/(app)/room/rooms/_components/room-availability-table"
import { RoomReservationCreateForm } from "@/app/(app)/room/rooms/_components/room-reservation-create-form"
import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { getRoomAvailability } from "@/lib/api/get-room-availability"
import type { RoomAvailabilitySearch } from "@/lib/api/types/room-types"

type Props = {
  search: RoomAvailabilitySearch
}

/**
 * 指定期間の空き状況を GET /rooms/availability で取得し、空きテーブルと予約フォームを描画する非同期 RSC。
 * 期間未指定のときは検索を促すだけにとどめる。
 */
export async function RoomAvailabilitySection(props: Props) {
  if (props.search.startAt === null || props.search.endAt === null) {
    return (
      <p className="text-sm text-muted-foreground">
        開始日時と終了日時を指定して空き状況を検索してください
      </p>
    )
  }

  const availabilities = await getRoomAvailability(props.search)

  if (availabilities instanceof Error) {
    return <FetchError message="空き状況の取得に失敗しました" />
  }

  if (availabilities.length === 0) {
    return <EmptyState title="条件に合う会議室がありません" />
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{availabilities.length} 件</p>

        <RoomAvailabilityTable availabilities={availabilities} />
      </div>

      <RoomReservationCreateForm
        availabilities={availabilities}
        startAt={props.search.startAt}
        endAt={props.search.endAt}
      />
    </div>
  )
}
