import { RewardCreateForm } from "@/app/(app)/thanks/reward-create-form"
import { getMe } from "@/lib/api/get-me"
import { canManageRewards } from "@/lib/thanks/can-manage-rewards"

// 景品の登録・管理エリア（管理権限向け）。getMe のロールで判定し、
// 管理権限が無いユーザーには何も描画しない（一般社員には登録 UI を出さない）。
// 閲覧と交換申請は別コンポーネント（ThanksRewards）で全社員に提供する。
export async function RewardManagement() {
  const currentUser = await getMe()

  if (currentUser instanceof Error) {
    return null
  }

  if (canManageRewards(currentUser.role) === false) {
    return null
  }

  return <RewardCreateForm />
}
