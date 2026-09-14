import { ThanksList } from "@/app/(app)/thanks/thanks/_components/thanks-list"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { getMe } from "@/lib/api/get-me"
import { canViewAllRedemptions } from "@/lib/thanks/can-view-all-redemptions"
import { Gift } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"

export const metadata = { title: "サンクス" }

/**
 * 感謝メッセージと交換処理の管理画面。
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
    <div className="flex flex-col gap-8">
      <PageHeader title="サンクス">
        {canViewAll ? (
          <Button
            variant="secondary"
            nativeButton={false}
            render={<Link href="/thanks/thanks-redemptions" />}
          >
            サンクス交換の横断
          </Button>
        ) : null}

        {canApprove ? (
          <Button
            variant="secondary"
            nativeButton={false}
            render={<Link href="/inbox/thanks-redemptions" />}
          >
            交換承認
          </Button>
        ) : null}

        {!(currentUser instanceof Error) &&
        currentUser.permissions.includes("thanks_reward:manage") ? (
          <Button
            variant="secondary"
            nativeButton={false}
            render={<Link href="/thanks/rewards/manage" />}
          >
            <Gift />
            景品の管理
          </Button>
        ) : null}
      </PageHeader>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">感謝メッセージ</h2>

        <Suspense fallback={<ListSkeleton rows={3} rowClassName="h-24 w-full" />}>
          <ThanksList />
        </Suspense>
      </section>
    </div>
  )
}
