import { listMyCareerApplications } from "@/lib/api/list-my-career-applications"
import { MyApplicationsList } from "@/app/(app)/career/my-applications-list"

// 自分の公募応募を取得して一覧コンポーネントへ渡す非同期 RSC。
export async function MyApplicationsSection() {
  const applications = await listMyCareerApplications()

  if (applications instanceof Error) {
    return <p className="text-sm text-destructive">応募一覧の取得に失敗しました</p>
  }

  return <MyApplicationsList applications={applications} />
}
