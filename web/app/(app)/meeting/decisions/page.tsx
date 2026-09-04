import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { DecisionList } from "@/app/(app)/meeting/decisions/_components/decision-list"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { getMe } from "@/lib/api/get-me"
import { canManageDecisions } from "@/lib/decision/can-manage-decisions"

export const metadata = { title: "意思決定記録" }

type Props = {
  searchParams: Promise<{ page?: string }>
}

/** /decisions 意思決定記録(ADR)の一覧。閲覧は全認証者、作成は decision:manage のみ導線を出す。 */
export default async function DecisionsPage(props: Props) {
  const params = await props.searchParams

  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1)

  const offset = (page - 1) * 20

  const me = await getMe()

  const canManage = me instanceof Error ? false : canManageDecisions(me.permissions)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="意思決定記録">
        {canManage ? (
          <Button nativeButton={false} render={<Link href="/meeting/decisions/new" />}>
            <Plus />
            記録を作成
          </Button>
        ) : null}
      </PageHeader>

      <Suspense key={String(page)} fallback={<ListSkeleton rows={5} rowClassName="h-16 w-full" />}>
        <DecisionList offset={offset} />
      </Suspense>
    </div>
  )
}
