import { FetchError } from "@/components/fetch-error"
import { Settings } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { MyReviewForms } from "@/app/(app)/review/_components/my-review-forms"
import { ReviewCycleList } from "@/app/(app)/review/_components/review-cycle-list"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { getMe } from "@/lib/api/get-me"
import { getMyReviewForms } from "@/lib/api/get-my-review-forms"
import { getReviewCycles } from "@/lib/api/get-review-cycles"
import { canAdministerCycle } from "@/lib/review/can-administer-cycle"

export const metadata = { title: "評価" }

/**
 * 評価のメイン画面。「評価サイクル」と「自分の評価フォーム」というオブジェクトだけを並べ、
 * サイクル作成・結果検索などの管理機能は /review/manage に分離する。
 */
export default async function ReviewPage() {
  const currentUser = await getMe()

  const canAdminister = currentUser instanceof Error ? false : canAdministerCycle(currentUser.role)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="評価"
        description="評価サイクルと自分の評価フォームを確認します。"
        actions={
          canAdminister ? (
            <Button variant="outline" render={<Link href="/review/manage" />}>
              <Settings />
              管理
            </Button>
          ) : null
        }
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">評価サイクル</h2>

        <Suspense fallback={<ListSkeleton rows={3} rowClassName="h-20 w-full" />}>
          <ReviewCycles canAdminister={canAdminister} />
        </Suspense>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">自分の評価フォーム</h2>

        <Suspense fallback={<ListSkeleton rows={3} rowClassName="h-20 w-full" />}>
          <MyForms />
        </Suspense>
      </section>
    </div>
  )
}

type ReviewCyclesProps = {
  canAdminister: boolean
}

// /review-cycles を認証付きで取得してサイクル一覧を描画する非同期 RSC。
async function ReviewCycles(props: ReviewCyclesProps) {
  const cycles = await getReviewCycles()

  if (cycles instanceof Error) {
    return <FetchError message="評価サイクル一覧の取得に失敗しました" />
  }

  return <ReviewCycleList cycles={cycles} canAdminister={props.canAdminister} />
}

// /review-forms/me を認証付きで取得して自分の評価フォームを描画する非同期 RSC。
async function MyForms() {
  const forms = await getMyReviewForms()

  if (forms instanceof Error) {
    return <FetchError message="評価フォームの取得に失敗しました" />
  }

  return <MyReviewForms forms={forms} />
}
