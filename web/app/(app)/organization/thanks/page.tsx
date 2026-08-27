import { Gift, Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { ThanksList } from "@/app/(app)/organization/thanks/_components/thanks-list"
import { ThanksSummary } from "@/app/(app)/organization/thanks/_components/thanks-summary"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getMe } from "@/lib/api/get-me"
import { canViewAllRedemptions } from "@/lib/thanks/can-view-all-redemptions"

export const metadata = { title: "感謝" }

/**
 * 感謝（サンクス）のメイン画面。サマリと公開タイムラインだけを並べる読み取り専用画面。
 * 送付は /thanks/send、景品は /thanks/rewards に分離。
 */
export default async function ThanksPage() {
  const currentUser = await getMe()

  const canViewAll =
    currentUser instanceof Error ? false : canViewAllRedemptions(currentUser.permissions)

  const canApprove =
    currentUser instanceof Error
      ? false
      : currentUser.permissions.includes("thanks_redemption:approve")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="感謝"
        description="サンクスポイントの残量と、社内の感謝を見渡す。"
        actions={
          <>
            {canViewAll ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/organization/thanks-redemptions" />}
              >
                交換申請管理
              </Button>
            ) : null}

            {canApprove ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/company/inbox/thanks-redemptions" />}
              >
                交換承認
              </Button>
            ) : null}

            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/organization/rewards" />}
            >
              <Gift />
              景品を見る
            </Button>

            <Button nativeButton={false} render={<Link href="/organization/thanks/send" />}>
              <Plus />
              感謝を送る
            </Button>
          </>
        }
      />

      <Suspense fallback={<SummarySkeleton />}>
        <ThanksSummary />
      </Suspense>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">みんなの感謝</h2>

        <Suspense fallback={<ListSkeleton rows={3} rowClassName="h-24 w-full" />}>
          <ThanksList />
        </Suspense>
      </section>
    </div>
  )
}

function SummarySkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Skeleton className="h-24 w-full" />

      <Skeleton className="h-24 w-full" />
    </div>
  )
}
