import Link from "next/link"
import { getOrgReportingLine } from "@/lib/api/get-org-reporting-line"
import { Card } from "@/components/ui/card"

type Props = {
  code: string
}

// /org/reporting-line/:employee_code を認証付きで取得し、本人から上位への系列を縦に描画する非同期 RSC。
export async function OrgReportingLineView(props: Props) {
  const nodes = await getOrgReportingLine(props.code)

  if (nodes instanceof Error) {
    return <p className="text-sm text-destructive">レポートラインの取得に失敗しました</p>
  }

  if (nodes.length === 0) {
    return <p className="text-sm text-muted-foreground">レポートラインがありません</p>
  }

  return (
    <ol className="flex flex-col gap-2">
      {nodes.map((node) => (
        <li key={node.employee_code} style={{ paddingInlineStart: `${node.depth * 1.5}rem` }}>
          <Card className="p-0 gap-0">
            <div className="flex items-center gap-3 p-3">
              <span className="text-xs text-muted-foreground">Lv.{node.depth}</span>

              <span className="text-sm font-medium">{node.employee_name}</span>

              <span className="text-xs text-muted-foreground">{node.employee_code}</span>

              <span className="text-xs text-muted-foreground">{node.position ?? "-"}</span>

              {node.department_code !== null && (
                <Link
                  href={`/org/departments/${node.department_code}/members`}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  {node.department_code}
                </Link>
              )}
            </div>
          </Card>
        </li>
      ))}
    </ol>
  )
}
