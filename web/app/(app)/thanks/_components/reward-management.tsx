import { RewardCreateForm } from "@/app/(app)/thanks/_components/reward-create-form"
import { getMe } from "@/lib/api/get-me"
import { canManageRewards } from "@/lib/thanks/can-manage-rewards"

// 景品の管理セクション（管理権限向け）。getMe のロールで判定し、
// 管理権限が無いユーザーには見出しごと何も描画しない（一般社員には登録 UI も見出しも出さない）。
// 閲覧と交換申請は別コンポーネント（ThanksRewards）で全社員に提供する。
export async function RewardManagement() {
  const currentUser = await getMe()

  if (currentUser instanceof Error) {
    return null
  }

  if (canManageRewards(currentUser.role) === false) {
    return null
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">景品の管理</h2>

      <p className="text-sm text-muted-foreground">景品の登録・編集ができます（管理権限者のみ）</p>

      <RewardCreateForm />
    </section>
  )
}
