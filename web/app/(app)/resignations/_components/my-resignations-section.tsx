import { MyResignationsList } from "@/app/(app)/resignations/_components/my-resignations-list"
import { listMyResignations } from "@/lib/api/list-my-resignations"

// 自分の退職申請を取得して一覧コンポーネントへ渡す非同期 RSC。
export async function MyResignationsSection() {
  const resignations = await listMyResignations()

  if (resignations instanceof Error) {
    return <p className="text-sm text-destructive">退職申請一覧の取得に失敗しました</p>
  }

  return <MyResignationsList resignations={resignations} />
}
