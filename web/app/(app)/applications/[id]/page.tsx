import { notFound } from "next/navigation"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { BackButton } from "@/components/back-button"
import { DetailField } from "@/components/detail-field"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { getApplicationDetail } from "@/lib/api/get-application-detail"
import { handleDetailError } from "@/lib/api/handle-detail-error"

export const metadata = { title: "申請詳細" }

type Props = {
  params: Promise<{ id: string }>
}

// id 文字列を正の整数へ変換する。無効なら null。
function toApplicationId(rawId: string): number | null {
  const parsed = Number(rawId)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

// 申請詳細画面。RSC で 1 件取得し、ステータスと payload を表示する。
export default async function ApplicationDetailPage(props: Props) {
  const params = await props.params

  const applicationId = toApplicationId(params.id)

  if (applicationId === null) {
    notFound()
  }

  const application = await getApplicationDetail(applicationId)

  if (application instanceof Error) {
    handleDetailError(application)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={application.template_name}
        breadcrumbs={[
          { label: "申請", href: "/applications" },
          { label: application.template_name },
        ]}
        actions={<BackButton href="/applications" label="一覧に戻る" />}
      />

      <ApplicationStatusBadge status={application.status} />

      <Card className="p-0 gap-0">
        <dl className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <DetailField label="申請者">{application.applicant_name}</DetailField>

          <DetailField label="テンプレートコード">{application.template_code}</DetailField>

          <DetailField label="現在のステップ">{application.current_step ?? "-"}</DetailField>

          <DetailField label="申請日">{application.created_at}</DetailField>
        </dl>
      </Card>

      <Card className="p-0 gap-0">
        <div className="flex flex-col gap-2 p-4">
          <span className="text-sm font-medium">申請内容</span>

          <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(application.payload, null, 2)}
          </pre>
        </div>
      </Card>
    </div>
  )
}
