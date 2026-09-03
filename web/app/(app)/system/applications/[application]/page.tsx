import { CheckCircle2, Circle, Clock3, RotateCcw, XCircle } from "lucide-react"
import { notFound } from "next/navigation"
import { formatDateTime } from "@/lib/format-date-time"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { BackButton } from "@/components/back-button"
import { DetailField } from "@/components/detail-field"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { getApplicationDetail } from "@/lib/api/get-application-detail"
import { handleDetailError } from "@/lib/api/handle-detail-error"
import type { ApplicationApprovalEntry } from "@/lib/api/types/application-types"
import type { ApplicationWorkflowProgress } from "@/lib/api/types/application-types"

export const metadata = { title: "申請詳細" }

type Props = {
  params: Promise<{ application: string }>
}

/** id 文字列を正の整数へ変換する。無効なら null。 */
function toApplicationId(rawId: string): number | null {
  const parsed = Number(rawId)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

/** 申請詳細画面。RSC で 1 件取得し、ステータスと payload を表示する。 */
export default async function ApplicationDetailPage(props: Props) {
  const params = await props.params

  const applicationId = toApplicationId(params.application)

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
          { label: "申請", href: "/my/applications" },
          { label: application.template_name },
        ]}
        actions={<BackButton href="/my/applications" label="一覧に戻る" />}
      />

      <ApplicationStatusBadge
        status={application.status}
        returned={application.workflow?.returned === true}
      />

      <Card className="p-0 gap-0">
        <dl className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <DetailField label="申請者">{application.applicant_name}</DetailField>

          <DetailField label="テンプレートコード">{application.template_code}</DetailField>

          <DetailField label="現在のステップ">{application.current_step ?? "-"}</DetailField>

          <DetailField label="申請日">{formatDateTime(application.created_at)}</DetailField>
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

      {application.status === "pending" && application.approver_roles.length > 0 ? (
        <Card className="p-0 gap-0">
          <div className="flex flex-col gap-2 p-4">
            <span className="text-sm font-medium">次の承認者</span>

            <div className="flex flex-wrap gap-2">
              {application.approver_roles.map((role) => (
                <Badge key={role} variant="secondary">
                  {role}
                </Badge>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              上記いずれかのロールを持つ人が承認できます。
            </p>
          </div>
        </Card>
      ) : null}

      <ApprovalHistory approvals={application.approvals} />

      {application.workflow === null ? null : <WorkflowProgress workflow={application.workflow} />}
    </div>
  )
}

function WorkflowProgress(props: { workflow: ApplicationWorkflowProgress }) {
  return (
    <Card className="p-0 gap-0">
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">承認フロー</span>
          <span className="text-xs text-muted-foreground">
            ラウンド {props.workflow.current_round}
            {props.workflow.due_at === null
              ? ""
              : `・期限 ${formatDateTime(props.workflow.due_at)}`}
          </span>
        </div>
        <ol className="grid gap-3 md:grid-cols-2">
          {props.workflow.steps.map((step, index) => {
            const Icon =
              step.status === "approved"
                ? CheckCircle2
                : step.status === "returned"
                  ? RotateCcw
                  : step.status === "rejected"
                    ? XCircle
                    : step.status === "pending"
                      ? Clock3
                      : Circle
            return (
              <li key={step.key} className="flex items-center gap-3 rounded-lg bg-card border p-3">
                <Icon className="size-4 shrink-0" aria-hidden />
                <div>
                  <div className="text-xs text-muted-foreground">ステップ {index + 1}</div>
                  <div className="text-sm font-medium">{step.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {workflowStatusLabel(step.status)}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
        {props.workflow.approvals.length === 0 ? null : (
          <ol className="flex flex-col gap-2 border-t pt-4">
            {props.workflow.approvals.map((approval) => (
              <li key={approval.id} className="text-sm">
                <span className="font-medium">{approval.approver_name}</span>
                {approval.approver_name === approval.represented_approver_name ? null : (
                  <span className="text-muted-foreground">
                    （{approval.represented_approver_name} の代理）
                  </span>
                )}
                <span className="text-muted-foreground">
                  {" "}
                  が{" "}
                  {approval.action === "approve"
                    ? "承認"
                    : approval.action === "return"
                      ? "差戻し"
                      : "却下"}
                  ・ラウンド {approval.round}・{formatDateTime(approval.created_at)}
                </span>
                {approval.comment === null ? null : (
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                    {approval.comment}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  )
}

function workflowStatusLabel(status: ApplicationWorkflowProgress["steps"][number]["status"]) {
  return {
    waiting: "待機中",
    pending: "承認待ち",
    approved: "承認済み",
    rejected: "却下",
    returned: "差戻し",
  }[status]
}

/** 申請への承認/却下アクションの履歴。古い順に並べる。 */
function ApprovalHistory(props: { approvals: ReadonlyArray<ApplicationApprovalEntry> }) {
  if (props.approvals.length === 0) {
    return null
  }

  return (
    <Card className="p-0 gap-0">
      <div className="flex flex-col gap-3 p-4">
        <span className="text-sm font-medium">承認履歴</span>

        <ol className="flex flex-col gap-3">
          {props.approvals.map((approval) => {
            const Icon = approval.action === "approve" ? CheckCircle2 : XCircle

            const colorClass =
              approval.action === "approve" ? "text-emerald-600" : "text-destructive"

            const label = approval.action === "approve" ? "承認" : "却下"

            return (
              <li
                key={approval.id}
                className="flex items-start gap-3 rounded-md border bg-muted/30 p-3"
              >
                <Icon className={`mt-0.5 size-4 shrink-0 ${colorClass}`} aria-hidden />

                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-medium">{approval.approver_name}</span>

                    <span className={`text-xs ${colorClass}`}>が{label}</span>

                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(approval.created_at)}
                    </span>
                  </div>

                  {approval.comment !== null && approval.comment !== "" ? (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {approval.comment}
                    </p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </Card>
  )
}
