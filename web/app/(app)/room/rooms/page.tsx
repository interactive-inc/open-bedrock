import Link from "next/link"
import { Suspense } from "react"
import { RoomAvailabilitySearchForm } from "@/app/(app)/room/rooms/_components/room-availability-search-form"
import { RoomAvailabilitySection } from "@/app/(app)/room/rooms/_components/room-availability-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import type { RoomAvailabilitySearch } from "@/lib/api/types/room-types"

export const metadata = { title: "会議室" }

type Props = {
  searchParams: Promise<{ [key: string]: string | Array<string> | undefined }>
}

/**
 * 会議室の空き状況検索と予約導線。自分の予約は /rooms/me に分離。
 */
export default async function RoomsPage(props: Props) {
  const params = await props.searchParams

  const search = toSearch(params)

  const suspenseKey = `${search.startAt ?? ""}:${search.endAt ?? ""}:${search.capacity ?? ""}`

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="会議室"
        actions={
          <Button
            variant="secondary"
            nativeButton={false}
            render={<Link href="/my/room-reservations" />}
          >
            自分の予約
          </Button>
        }
      />

      <RoomAvailabilitySearchForm search={search} />

      <Suspense key={suspenseKey} fallback={<ListSkeleton rows={4} rowClassName="h-10 w-full" />}>
        <RoomAvailabilitySection search={search} />
      </Suspense>
    </div>
  )
}

function toSearch(params: {
  [key: string]: string | Array<string> | undefined
}): RoomAvailabilitySearch {
  return {
    startAt: toSingleValue(params.start_at),
    endAt: toSingleValue(params.end_at),
    capacity: toCapacity(params.capacity),
  }
}

function toSingleValue(value: string | Array<string> | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }

  if (value === "") {
    return null
  }

  return value
}

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
