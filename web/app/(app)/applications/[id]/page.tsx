import Link from "next/link"
import { notFound } from "next/navigation"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getApplicationDetail } from "@/lib/api/get-application-detail"

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
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{application.template_name}</h1>

          <ApplicationStatusBadge status={application.status} />
        </div>

        <Button variant="outline" render={<Link href="/applications" />}>
          一覧へ戻る
        </Button>
      </div>

      <Card className="p-0 gap-0">
        <dl className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">申請者</dt>

            <dd className="text-sm font-medium">{application.applicant_name}</dd>
          </div>

          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">テンプレートコード</dt>

            <dd className="text-sm font-medium">{application.template_code}</dd>
          </div>

          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">現在のステップ</dt>

            <dd className="text-sm font-medium">{application.current_step ?? "-"}</dd>
          </div>

          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">申請日</dt>

            <dd className="text-sm font-medium">{application.created_at}</dd>
          </div>
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
