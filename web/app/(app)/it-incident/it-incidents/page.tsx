import { Plus } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { ItIncidentList } from "@/app/(app)/it-incident/it-incidents/_components/it-incident-list"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { getMe } from "@/lib/api/get-me"
import { canManageItIncidents } from "@/lib/it-incident/can-manage-it-incidents"
import { canViewAllItIncidents } from "@/lib/it-incident/can-view-all-it-incidents"

export const metadata = { title: "インシデント記録" }

type Props = {
  searchParams: Promise<{ page?: string }>
}

/** /it-incidents インシデント記録の一覧。it_incident:read:all が無ければ notFound。 */
export default async function ItIncidentsPage(props: Props) {
  const me = await getMe()

  if (me instanceof Error || canViewAllItIncidents(me.permissions) === false) {
    notFound()
  }

  const params = await props.searchParams

  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1)

  const offset = (page - 1) * 20

  const canManage = canManageItIncidents(me.permissions)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="インシデント記録"
        description="発生した障害・事故を記録します。原因分析や再発防止の判定は持ちません。"
        actions={
          canManage ? (
            <Button nativeButton={false} render={<Link href="/it-incident/it-incidents/new" />}>
              <Plus />
              インシデントを記録
            </Button>
          ) : null
        }
      />

      <Suspense key={String(page)} fallback={<ListSkeleton rows={5} rowClassName="h-12 w-full" />}>
        <ItIncidentList offset={offset} canManage={canManage} />
      </Suspense>
    </div>
  )
}
