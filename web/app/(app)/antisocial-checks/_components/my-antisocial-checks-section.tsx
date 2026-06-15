import { MyAntisocialChecksList } from "@/app/(app)/antisocial-checks/_components/my-antisocial-checks-list"
import { FetchError } from "@/components/fetch-error"
import { listMyAntisocialChecks } from "@/lib/api/list-my-antisocial-checks"

// 自分の反社チェック申請を取得して一覧コンポーネントへ渡す非同期 RSC。
export async function MyAntisocialChecksSection() {
  const antisocialChecks = await listMyAntisocialChecks()

  if (antisocialChecks instanceof Error) {
    return <FetchError message="反社チェック申請一覧の取得に失敗しました" />
  }

  return <MyAntisocialChecksList antisocialChecks={antisocialChecks} />
}
