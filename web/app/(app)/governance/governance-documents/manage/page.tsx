import { AlertTriangle, CheckCircle2, FileWarning, UsersRound } from "lucide-react"
import Link from "next/link"
import { OrgRoleAssignmentForm } from "@/app/(app)/governance/governance-documents/manage/_components/org-role-assignment-form"
import { RevokeOrgRoleButton } from "@/app/(app)/governance/governance-documents/manage/_components/revoke-org-role-button"
import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { getGovernanceImpact } from "@/lib/api/get-governance-impact"
import { getGovernanceOrgRoles } from "@/lib/api/get-governance-org-roles"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "規程の整合性管理" }

export default async function GovernanceManagePage() {
  await requirePermission("governance:manage")
  const [impact, roles] = await Promise.all([getGovernanceImpact(), getGovernanceOrgRoles()])
  if (impact instanceof Error) throw impact
  if (roles instanceof Error) throw roles
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="規程の整合性管理" />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard title="検査文書" value={impact.document_count} icon={<FileWarning />} />
        <MetricCard
          title="エラー"
          value={impact.summary.errors}
          icon={<AlertTriangle />}
          destructive={impact.summary.errors > 0}
        />
        <MetricCard title="警告" value={impact.summary.warnings} icon={<AlertTriangle />} />
      </div>

      {impact.issues.length === 0 ? (
        <Alert>
          <CheckCircle2 />
          <AlertTitle>矛盾は見つかりませんでした</AlertTitle>
          <AlertDescription>
            組織状態、安定ID、見直し期限、権限条件は整合しています。
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>要対応</CardTitle>
            <CardDescription>
              検査日時 {impact.checked_at} · 組織データ {impact.organization_source}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>重要度</TableHead>
                  <TableHead>文書</TableHead>
                  <TableHead>内容</TableHead>
                  <TableHead>参照</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {impact.issues.map((issue) => (
                  <TableRow
                    key={`${issue.severity}:${issue.code}:${issue.document_code}:${issue.reference}:${issue.message}`}
                  >
                    <TableCell>
                      <Badge variant={issue.severity === "error" ? "destructive" : "secondary"}>
                        {issue.severity === "error" ? "エラー" : "警告"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {issue.document_code ? (
                        <Link
                          href={`/governance/governance-documents/${issue.document_code}`}
                          className="underline underline-offset-4"
                        >
                          {issue.document_code}
                        </Link>
                      ) : (
                        "全体"
                      )}
                    </TableCell>
                    <TableCell>
                      {issue.message}
                      <p className="text-xs text-muted-foreground">{issue.code}</p>
                    </TableCell>
                    <TableCell>{issue.reference ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>組織ロールを割り当てる</CardTitle>
          <CardDescription>
            システムロールではなく、会社上の責任を期間付きで従業員・部署へ結びます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrgRoleAssignmentForm roles={roles.data} today={today} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>組織ロール</CardTitle>
          <CardDescription>
            部署責任者から自動解決されるロールと、任命で割り当てるロールを同じ一覧で確認できます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ロール</TableHead>
                <TableHead>方式</TableHead>
                <TableHead>人数条件</TableHead>
                <TableHead>現在の担当者</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.data.map((role) => (
                <TableRow key={role.code}>
                  <TableCell>
                    <p className="font-medium">{role.name}</p>
                    <p className="text-xs text-muted-foreground">{role.code}</p>
                  </TableCell>
                  <TableCell>
                    {role.assignmentMode === "manual" ? "任命" : "組織図から自動"}
                  </TableCell>
                  <TableCell>{cardinalityLabel(role.cardinality)}</TableCell>
                  <TableCell>
                    {role.assignees.length === 0 ? (
                      <span className="text-destructive">未割当</span>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {role.assignees.map((assignee) => (
                          <div
                            key={`${assignee.employee_id}:${assignee.department_code ?? "company"}`}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <UsersRound className="size-4 text-muted-foreground" />
                            <span>
                              {assignee.employee_name}（{assignee.employee_code}）
                            </span>
                            {assignee.department_code ? (
                              <Badge variant="outline">{assignee.department_code}</Badge>
                            ) : null}
                            {assignee.assignment_id !== null ? (
                              <RevokeOrgRoleButton
                                assignmentId={assignee.assignment_id}
                                employeeName={assignee.employee_name}
                              />
                            ) : (
                              <Badge variant="secondary">自動</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard(props: {
  title: string
  value: number
  icon: React.ReactNode
  destructive?: boolean
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <div
          className={`flex items-center gap-2 [&_svg]:size-4 ${props.destructive ? "text-destructive" : "text-muted-foreground"}`}
        >
          {props.icon}
          <CardDescription>{props.title}</CardDescription>
        </div>
        <CardTitle>{props.value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

function cardinalityLabel(value: string) {
  return (
    (
      { one: "全社で1名", per_department: "部署ごとに1名", many: "複数可" } as Record<
        string,
        string
      >
    )[value] ?? value
  )
}
