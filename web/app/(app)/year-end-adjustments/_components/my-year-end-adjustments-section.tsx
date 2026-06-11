import { MyYearEndAdjustmentsList } from "@/app/(app)/year-end-adjustments/_components/my-year-end-adjustments-list"
import { listMyYearEndAdjustments } from "@/lib/api/list-my-year-end-adjustments"

// 自分の年末調整申告を取得して一覧コンポーネントへ渡す非同期 RSC。
export async function MyYearEndAdjustmentsSection() {
  const yearEndAdjustments = await listMyYearEndAdjustments()

  if (yearEndAdjustments instanceof Error) {
    return <p className="text-sm text-destructive">年末調整申告一覧の取得に失敗しました</p>
  }

  return <MyYearEndAdjustmentsList yearEndAdjustments={yearEndAdjustments} />
}
