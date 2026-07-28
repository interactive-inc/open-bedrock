import { FetchError } from "@/components/fetch-error"
import { getCareerPostings } from "@/lib/api/get-career-postings"
import { listMyCareerApplications } from "@/lib/api/list-my-career-applications"
import { MyApplicationsList } from "@/app/(app)/my/career/_components/my-applications-list"

/** 自分の公募応募を取得して一覧コンポーネントへ渡す非同期 RSC。 */
export async function MyApplicationsSection() {
  const applications = await listMyCareerApplications()

  if (applications instanceof Error) {
    return <FetchError message="応募一覧の取得に失敗しました" />
  }

  const postings = await getCareerPostings()

  const postingTitleMap: Record<number, string> =
    postings instanceof Error
      ? {}
      : Object.fromEntries(postings.filter((p) => p.id !== null).map((p) => [p.id, p.title]))

  return <MyApplicationsList applications={applications} postingTitleMap={postingTitleMap} />
}
