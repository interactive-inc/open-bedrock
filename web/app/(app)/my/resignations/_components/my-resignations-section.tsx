import { MyResignationsList } from "@/app/(app)/my/resignations/_components/my-resignations-list"
import { FetchError } from "@/components/fetch-error"
import { listMyResignations } from "@/lib/api/list-my-resignations"

/** 自分の退職申請を取得して一覧コンポーネントへ渡す非同期 RSC。 */
export async function MyResignationsSection() {
  const resignations = await listMyResignations()

  if (resignations instanceof Error) {
    return <FetchError message="退職申請一覧の取得に失敗しました" />
  }

  return <MyResignationsList resignations={resignations} />
}
