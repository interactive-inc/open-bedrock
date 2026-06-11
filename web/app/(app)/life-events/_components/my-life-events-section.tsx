import { MyLifeEventsList } from "@/app/(app)/life-events/_components/my-life-events-list"
import { listMyLifeEvents } from "@/lib/api/list-my-life-events"

// 自分のライフイベント届出を取得して一覧コンポーネントへ渡す非同期 RSC。
export async function MyLifeEventsSection() {
  const lifeEvents = await listMyLifeEvents()

  if (lifeEvents instanceof Error) {
    return <p className="text-sm text-destructive">ライフイベント届出一覧の取得に失敗しました</p>
  }

  return <MyLifeEventsList lifeEvents={lifeEvents} />
}
