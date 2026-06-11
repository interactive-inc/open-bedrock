import { Suspense } from "react"
import { MyReservationsSection } from "@/app/(app)/rooms/_components/my-reservations-section"
import { RoomAvailabilitySearchForm } from "@/app/(app)/rooms/_components/room-availability-search-form"
import { RoomAvailabilitySection } from "@/app/(app)/rooms/_components/room-availability-section"
import { Skeleton } from "@/components/ui/skeleton"
import type { RoomAvailabilitySearch } from "@/lib/api/types/room-types"

export const metadata = { title: "会議室" }

type Props = {
  searchParams: Promise<{ [key: string]: string | Array<string> | undefined }>
}

// 会議室画面。searchParams（期間・定員）から空き状況を取得し、
// 検索フォーム + 非同期の空きテーブル/予約フォームを Suspense 境界で描画する RSC。
export default async function RoomsPage(props: Props) {
  const params = await props.searchParams

  const search = toSearch(params)

  const suspenseKey = `${search.startAt ?? ""}:${search.endAt ?? ""}:${search.capacity ?? ""}`

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">会議室</h1>

      <RoomAvailabilitySearchForm search={search} />

      <Suspense key={suspenseKey} fallback={<RoomsSkeleton />}>
        <RoomAvailabilitySection search={search} />
      </Suspense>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">自分の予約</h2>

        <Suspense fallback={<RoomsSkeleton />}>
          <MyReservationsSection />
        </Suspense>
      </section>
    </div>
  )
}

// searchParams の生の値を RoomAvailabilitySearch に正規化する。
function toSearch(params: {
  [key: string]: string | Array<string> | undefined
}): RoomAvailabilitySearch {
  return {
    startAt: toSingleValue(params.start_at),
    endAt: toSingleValue(params.end_at),
    capacity: toCapacity(params.capacity),
  }
}

// 配列・未定義・空文字を null に潰した単一文字列を返す。
function toSingleValue(value: string | Array<string> | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }

  if (value === "") {
    return null
  }

  return value
}

// capacity を 0 以上の整数へ。未指定や不正値は null。
function toCapacity(value: string | Array<string> | undefined): number | null {
  if (typeof value !== "string" || value === "") {
    return null
  }

  const parsed = Number(value)

  if (Number.isInteger(parsed) === false || parsed < 0) {
    return null
  }

  return parsed
}

function RoomsSkeleton() {
  const placeholders = [0, 1, 2, 3]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}
