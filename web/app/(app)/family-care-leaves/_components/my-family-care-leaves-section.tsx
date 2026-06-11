import { MyFamilyCareLeavesList } from "@/app/(app)/family-care-leaves/_components/my-family-care-leaves-list"
import { listMyFamilyCareLeaves } from "@/lib/api/list-my-family-care-leaves"

// 自分の休業申出を取得して一覧コンポーネントへ渡す非同期 RSC。
export async function MyFamilyCareLeavesSection() {
  const familyCareLeaves = await listMyFamilyCareLeaves()

  if (familyCareLeaves instanceof Error) {
    return <p className="text-sm text-destructive">休業申出一覧の取得に失敗しました</p>
  }

  return <MyFamilyCareLeavesList familyCareLeaves={familyCareLeaves} />
}
