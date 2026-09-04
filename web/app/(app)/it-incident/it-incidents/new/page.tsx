import { notFound } from "next/navigation"
import { ItIncidentCreateForm } from "@/app/(app)/it-incident/it-incidents/_components/it-incident-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { canManageItIncidents } from "@/lib/it-incident/can-manage-it-incidents"

export const metadata = { title: "インシデント記録" }

/** インシデント記録画面。it_incident:manage が無ければ notFound。 */
export default async function ItIncidentNewPage() {
  const me = await getMe()

  if (me instanceof Error || canManageItIncidents(me.permissions) === false) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="インシデントを記録">
        <BackButton href="/it-incident/it-incidents" label="一覧に戻る" />
      </PageHeader>

      <Card className="gap-0">
        <div className="p-8">
          <ItIncidentCreateForm />
        </div>
      </Card>
    </div>
  )
}
