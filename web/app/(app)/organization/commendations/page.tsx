import { Suspense } from "react"
import { CommendationList } from "@/app/(app)/organization/commendations/_components/commendation-list"
import { CommendationNewForm } from "@/app/(app)/organization/commendations/_components/commendation-new-form"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { getMe } from "@/lib/api/get-me"
import { canManageCommendations } from "@/lib/commendation/can-manage-commendations"

export const metadata = { title: "表彰" }

type Props = {
  searchParams: Promise<{ page?: string }>
}

// /commendations 表彰の記録。閲覧は全認証者（社内公開）、記録・削除は commendation:manage のみ。
export default async function CommendationsPage(props: Props) {
  const params = await props.searchParams

  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1)

  const offset = (page - 1) * 20

  const me = await getMe()

  const canManage = me instanceof Error ? false : canManageCommendations(me.permissions)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="表彰"
        description="社内で共有される表彰の記録です。閲覧は全員、記録の追加・削除は担当者のみ行えます。"
      />

      {canManage ? <CommendationNewForm /> : null}

      <Suspense key={String(page)} fallback={<ListSkeleton rows={5} rowClassName="h-16 w-full" />}>
        <CommendationList offset={offset} canManage={canManage} />
      </Suspense>
    </div>
  )
}
