import { TemplateManagement } from "@/app/(app)/organization/onboarding-assignments/_components/template-management"
import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { Badge } from "@/components/ui/badge"
import { getOnboardingTemplates } from "@/lib/api/get-onboarding-templates"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/** GET /onboarding-templates を取得してテンプレート一覧テーブルを描画する非同期 RSC。 */
export async function OnboardingTemplatesTable() {
  const templates = await getOnboardingTemplates(null)

  if (templates instanceof Error) {
    return <FetchError message="テンプレートの取得に失敗しました" />
  }

  if (templates.length === 0) {
    return <EmptyState title="テンプレートがありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>コード</TableHead>
            <TableHead>名称</TableHead>
            <TableHead>種別</TableHead>
            <TableHead>説明</TableHead>
            <TableHead className="text-right">タスク数</TableHead>
            <TableHead>人事連携</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {templates.map((template) => (
            <TableRow key={template.code}>
              <TableCell className="font-mono text-xs">{template.code}</TableCell>

              <TableCell className="font-medium">{template.name}</TableCell>

              <TableCell>
                <Badge variant={template.kind === "join" ? "default" : "secondary"}>
                  {template.kind === "join" ? "入社" : "退社"}
                </Badge>
              </TableCell>

              <TableCell className="text-muted-foreground">{template.description ?? "—"}</TableCell>

              <TableCell className="text-right">{template.task_count}</TableCell>

              <TableCell>
                {template.lifecycle_effect === null ? (
                  <span className="text-muted-foreground">未設定</span>
                ) : (
                  <Badge variant="outline">
                    {template.lifecycle_effect === "hire" ? "入社" : "退職"}
                  </Badge>
                )}
              </TableCell>

              <TableCell className="text-right">
                <TemplateManagement
                  template={{
                    code: template.code,
                    name: template.name,
                    kind: template.kind,
                    description: template.description,
                    task_count: template.task_count,
                    lifecycle_effect: template.lifecycle_effect,
                  }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
