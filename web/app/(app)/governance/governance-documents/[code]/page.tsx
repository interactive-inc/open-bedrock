import { CalendarCheck2, FileCode2, GitPullRequest, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { DocumentWorkflowActions } from "@/app/(app)/governance/governance-documents/[code]/_components/document-workflow-actions"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getGovernanceDocument } from "@/lib/api/get-governance-document"
import { handleDetailError } from "@/lib/api/handle-detail-error"
import { requireAuth } from "@/lib/auth/require-auth"

export const metadata = { title: "規程・手続き詳細" }

type Props = { params: Promise<{ code: string }> }

export default async function GovernanceDetailPage(props: Props) {
  const { code } = await props.params
  if (!/^[a-z0-9][a-z0-9._-]{1,119}$/.test(code)) notFound()
  const [me, document] = await Promise.all([requireAuth(), getGovernanceDocument(code)])
  if (document instanceof Error) handleDetailError(document)
  const metadata = document.metadata

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={document.title}
        actions={<BackButton href="/governance/governance-documents" label="一覧に戻る" />}
      />

      <div className="flex flex-wrap gap-2">
        <StateBadge state={document.version_state} />
        <Badge variant="outline">{kindLabel(document.kind)}</Badge>
        <Badge variant="outline">{classificationLabel(document.classification)}</Badge>
        {metadata.tags.map((tag) => (
          <Badge key={tag} variant="secondary">
            {tag}
          </Badge>
        ))}
      </div>

      <DocumentWorkflowActions
        code={document.code}
        version={document.version}
        versionState={document.version_state}
        publicationMode={metadata.publication.mode}
        acknowledgementRequired={metadata.acknowledgement.required}
        acknowledged={document.acknowledged}
        permissions={me.permissions}
        approvals={document.approvals}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={<ShieldCheck />} title="主管能力" value={document.owner_capability} />
        <SummaryCard
          icon={<GitPullRequest />}
          title="責任ロール"
          value={document.steward_org_role ?? "未設定"}
        />
        <SummaryCard
          icon={<CalendarCheck2 />}
          title="施行日"
          value={document.effective_from ?? "未確定"}
        />
        <SummaryCard
          icon={<FileCode2 />}
          title="Markdown原本"
          value={document.source_path ?? "非表示"}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="gap-0">
          <article className="whitespace-pre-wrap p-5 text-sm leading-7 sm:p-8">
            {document.body_md}
          </article>
        </Card>
        <div className="flex flex-col gap-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle>適用と更新</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <KeyValue label="適用対象" value={audienceLabel(metadata.audience)} />
              <KeyValue
                label="公開方式"
                value={
                  metadata.publication.mode === "approval"
                    ? "組織ロールの承認後"
                    : "承認なしで直接公開"
                }
              />
              <KeyValue
                label="確認記録"
                value={metadata.acknowledgement.required ? "必要" : "不要"}
              />
              <KeyValue label="見直し期限" value={document.review_due_on ?? "未設定"} />
              <KeyValue label="内容ハッシュ" value={document.content_hash.slice(0, 12)} />
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>参照</CardTitle>
              <CardDescription>安定IDでつながる関係</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {document.references.length === 0 ? (
                <span className="text-sm text-muted-foreground">参照なし</span>
              ) : (
                document.references.map((reference) => (
                  <ReferenceBadge
                    key={`${reference.kind}:${reference.code}`}
                    kind={reference.kind}
                    code={reference.code}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {metadata.procedure !== null ? <ProcedureSection procedure={metadata.procedure} /> : null}
      {metadata.authority_rules.length > 0 ? (
        <AuthoritySection rules={metadata.authority_rules} />
      ) : null}
      {metadata.controls.length > 0 ? <ControlSection controls={metadata.controls} /> : null}
      {document.approvals.length > 0 ? <ApprovalSection approvals={document.approvals} /> : null}
    </div>
  )
}

function SummaryCard(props: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-center gap-2 text-muted-foreground [&_svg]:size-4">
          {props.icon}
          <CardDescription>{props.title}</CardDescription>
        </div>
        <CardTitle className="break-all">{props.value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

function KeyValue(props: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd className="mt-0.5 font-medium">{props.value}</dd>
    </div>
  )
}

function ReferenceBadge(props: { kind: string; code: string }) {
  if (
    props.kind === "policy" ||
    props.kind === "procedure" ||
    props.kind === "guideline" ||
    props.kind === "control"
  ) {
    return (
      <Badge
        variant="outline"
        render={<Link href={`/governance/governance-documents/${props.code}`} />}
      >
        {props.kind}:{props.code}
      </Badge>
    )
  }
  return (
    <Badge variant="outline">
      {props.kind}:{props.code}
    </Badge>
  )
}

type DocumentResponse = Exclude<Awaited<ReturnType<typeof getGovernanceDocument>>, Error>
type Metadata = DocumentResponse["metadata"]
type Procedure = NonNullable<Metadata["procedure"]>

function ProcedureSection(props: { procedure: Procedure }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>実行手順</CardTitle>
        <CardDescription>
          承認の有無にかかわらず、実施順・担当・証跡を構造化しています。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>順序</TableHead>
              <TableHead>手順</TableHead>
              <TableHead>種類</TableHead>
              <TableHead>担当</TableHead>
              <TableHead>期限</TableHead>
              <TableHead>証跡</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.procedure.steps.map((step, index) => (
              <TableRow key={step.key}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>
                  <p className="font-medium">{step.name}</p>
                  <p className="text-xs text-muted-foreground">{step.key}</p>
                </TableCell>
                <TableCell>{step.kind}</TableCell>
                <TableCell>{assigneeLabel(step.assignee)}</TableCell>
                <TableCell>{step.due_days === null ? "—" : `${step.due_days}日`}</TableCell>
                <TableCell>{step.evidence_required ? "必須" : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function AuthoritySection(props: { rules: Metadata["authority_rules"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>権限ルール</CardTitle>
        <CardDescription>何を、誰が起案し、どの組織責任が決定するか。</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>操作</TableHead>
              <TableHead>効果</TableHead>
              <TableHead>決定ロール</TableHead>
              <TableHead>金額条件</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.rules.map((rule) => (
              <TableRow key={rule.key}>
                <TableCell>
                  <p className="font-medium">{rule.action}</p>
                  <p className="text-xs text-muted-foreground">{rule.capability}</p>
                </TableCell>
                <TableCell>{rule.effect}</TableCell>
                <TableCell>{rule.decider_org_roles.join(", ") || "—"}</TableCell>
                <TableCell>
                  {amountRange(rule.amount_min, rule.amount_max, rule.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function ControlSection(props: { controls: Metadata["controls"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>統制と証跡</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>統制</TableHead>
              <TableHead>責任ロール</TableHead>
              <TableHead>契機</TableHead>
              <TableHead>証跡</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.controls.map((control) => (
              <TableRow key={control.key}>
                <TableCell>{control.key}</TableCell>
                <TableCell>{control.owner_org_role}</TableCell>
                <TableCell>
                  {control.trigger}
                  {control.cadence ? ` / ${control.cadence}` : ""}
                </TableCell>
                <TableCell>{control.evidence}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

type Approval = Exclude<
  Awaited<ReturnType<typeof getGovernanceDocument>>,
  Error
>["approvals"][number]

function ApprovalSection(props: { approvals: ReadonlyArray<Approval> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>公開レビュー</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>組織ロール</TableHead>
              <TableHead>状態</TableHead>
              <TableHead>判断日時</TableHead>
              <TableHead>コメント</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.approvals.map((approval) => (
              <TableRow key={approval.org_role_code}>
                <TableCell>{approval.org_role_code}</TableCell>
                <TableCell>{approval.status}</TableCell>
                <TableCell>{approval.decided_at ?? "—"}</TableCell>
                <TableCell>{approval.comment ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function kindLabel(kind: string) {
  return (
    (
      { policy: "規程", procedure: "手続き", guideline: "ガイドライン", control: "統制" } as Record<
        string,
        string
      >
    )[kind] ?? kind
  )
}
function classificationLabel(value: string) {
  return (
    (
      { public: "公開", internal: "社内", confidential: "機密", restricted: "限定" } as Record<
        string,
        string
      >
    )[value] ?? value
  )
}
function StateBadge(props: { state: string }) {
  const label =
    (
      {
        draft: "下書き",
        in_review: "レビュー中",
        published: "公開中",
        superseded: "旧版",
        rejected: "差し戻し",
      } as Record<string, string>
    )[props.state] ?? props.state
  return <Badge variant={props.state === "published" ? "default" : "secondary"}>{label}</Badge>
}
function audienceLabel(audience: Metadata["audience"]) {
  if (audience.all_employees) return "全従業員"
  return (
    [
      ...audience.department_codes.map((code) => `部署:${code}`),
      ...audience.org_roles.map((code) => `ロール:${code}`),
    ].join("、") || "対象なし"
  )
}
function assigneeLabel(assignee: Procedure["steps"][number]["assignee"]) {
  if (assignee === null) return "指定なし"
  return assignee.type === "org_role"
    ? `組織ロール:${assignee.code}`
    : ((
        {
          starter: "開始者",
          subject_employee: "対象従業員",
          direct_manager: "直属上司",
          department_manager: "部門責任者",
        } as Record<string, string>
      )[assignee.type] ?? assignee.type)
}
function amountRange(min: number | null, max: number | null, currency: string | null) {
  if (min === null && max === null) return "—"
  const unit = currency ?? ""
  if (min !== null && max !== null)
    return `${min.toLocaleString()}〜${max.toLocaleString()} ${unit}`
  if (min !== null) return `${min.toLocaleString()} ${unit}以上`
  return `${max?.toLocaleString()} ${unit}以下`
}
