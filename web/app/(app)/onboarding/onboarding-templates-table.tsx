import { TemplateManagement } from "@/app/(app)/onboarding/template-management"
import { getOnboardingTemplates } from "@/lib/api/get-onboarding-templates"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// GET /onboarding/templates を取得してテンプレート一覧テーブルを描画する非同期 RSC。
export async function OnboardingTemplatesTable() {
  const templates = await getOnboardingTemplates(null)

  if (templates instanceof Error) {
    return <p className="text-sm text-destructive">テンプレートの取得に失敗しました</p>
  }

  if (templates.length === 0) {
    return <p className="text-sm text-muted-foreground">テンプレートがありません</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>コード</TableHead>
          <TableHead>名称</TableHead>
          <TableHead>種別</TableHead>
          <TableHead>説明</TableHead>
          <TableHead className="text-right">タスク数</TableHead>
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

            <TableCell className="text-right">
              <TemplateManagement
                template={{
                  code: template.code,
                  name: template.name,
                  kind: template.kind,
                  description: template.description,
                  task_count: template.task_count,
                }}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
