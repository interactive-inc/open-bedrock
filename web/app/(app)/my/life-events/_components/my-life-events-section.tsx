import { MyLifeEventsList } from "@/app/(app)/my/life-events/_components/my-life-events-list"
import { FetchError } from "@/components/fetch-error"
import { getMe } from "@/lib/api/get-me"
import { listMyLifeEvents } from "@/lib/api/list-my-life-events"

/** 自分のライフイベント届出を取得して一覧コンポーネントへ渡す非同期 RSC。 */
export async function MyLifeEventsSection() {
  const lifeEvents = await listMyLifeEvents()

  if (lifeEvents instanceof Error) {
    return <FetchError message="ライフイベント届出一覧の取得に失敗しました" />
  }

  const me = await getMe()

  return <MyLifeEventsList lifeEvents={lifeEvents} phone={me.phone} />
}
