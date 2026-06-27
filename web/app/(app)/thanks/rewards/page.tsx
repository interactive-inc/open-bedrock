import { Settings } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { ThanksExchangeBalance } from "@/app/(app)/thanks/_components/thanks-exchange-balance"
import { ThanksRewards } from "@/app/(app)/thanks/_components/thanks-rewards"
import { BackButton } from "@/components/back-button"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getMe } from "@/lib/api/get-me"
import { canManageRewards } from "@/lib/thanks/can-manage-rewards"

export const metadata = { title: "感謝の景品" }

/**
 * 景品の交換（一般 + 管理者の両方が同じ閲覧体験）に集中させ、登録・編集の管理機能は /thanks/rewards/manage に分離する。
 */
export default async function ThanksRewardsPage() {
  const currentUser = await getMe()

  const canManage = currentUser instanceof Error ? false : canManageRewards(currentUser.role)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="景品"
        description="受領残高でカタログから景品を交換する"
        actions={
          <>
            <BackButton href="/thanks" label="感謝に戻る" />

            {canManage ? (
              <Button variant="outline" nativeButton={false} render={<Link href="/thanks/rewards/manage" />}>
                <Settings />
                景品の管理
              </Button>
            ) : null}
          </>
        }
      />

      <Suspense fallback={<Skeleton className="h-20 w-full" />}>
        <ThanksExchangeBalance />
      </Suspense>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">交換する景品を選ぶ</h2>

        <Suspense fallback={<ListSkeleton rows={3} rowClassName="h-20 w-full" />}>
          <ThanksRewards />
        </Suspense>
      </section>
    </div>
  )
}
