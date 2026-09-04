import { notFound } from "next/navigation"
import { RewardCreateForm } from "@/app/(app)/thanks/thanks/_components/reward-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { canManageRewards } from "@/lib/thanks/can-manage-rewards"

export const metadata = { title: "景品の管理" }

/**
 * 景品の管理（特権ロールのみ）。新規登録に集中させ、交換カタログとは分離する。
 */
export default async function ThanksRewardsManagePage() {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageRewards(currentUser.permissions) === false) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="景品の管理">
        <BackButton href="/thanks/rewards" label="景品に戻る" />
      </PageHeader>

      <Card>
        <CardContent>
          <RewardCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
