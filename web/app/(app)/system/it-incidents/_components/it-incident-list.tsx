import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { TablePagination } from "@/components/table-pagination"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getItIncidentList } from "@/lib/api/get-it-incident-list"
import { ItIncidentResolveButton } from "@/app/(app)/system/it-incidents/_components/it-incident-resolve-button"

const PAGE_SIZE = 20

type Props = {
  offset: number
  canManage: boolean
}

/** GET /it-incidents を認証付きで取得し、発生日時の新しい順でインシデント記録テーブルを描画する非同期 RSC。 */
export async function ItIncidentList(props: Props) {
  const result = await getItIncidentList({ limit: PAGE_SIZE, offset: props.offset })

  if (result instanceof Error) {
    return <FetchError message="インシデント記録の取得に失敗しました" />
  }

  if (result.data.length === 0) {
    return (
      <EmptyState
        title="インシデント記録はまだありません"
        description="発生した障害・事故を記録すると、対応履歴を残せます。"
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <Table aria-label="インシデント記録">
          <TableHeader>
            <TableRow>
              <TableHead>発生日時</TableHead>
              <TableHead>タイトル</TableHead>
              <TableHead>深刻度</TableHead>
              <TableHead>状態</TableHead>
              <TableHead>解消日時</TableHead>
              {props.canManage ? <TableHead>操作</TableHead> : null}
            </TableRow>
          </TableHeader>

          <TableBody>
            {result.data.map((incident) => (
              <TableRow key={incident.id}>
                <TableCell className="text-muted-foreground">{incident.occurred_at}</TableCell>

                <TableCell className="font-medium">{incident.title}</TableCell>

                <TableCell className="text-muted-foreground">{incident.severity ?? "-"}</TableCell>

                <TableCell>
                  {incident.status === "resolved" ? (
                    <Badge variant="outline">解消済み</Badge>
                  ) : (
                    <Badge variant="secondary">対応中</Badge>
                  )}
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {incident.resolved_at ?? "-"}
                </TableCell>

                {props.canManage ? (
                  <TableCell>
                    {incident.status === "open" ? (
                      <ItIncidentResolveButton id={incident.id} />
                    ) : null}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        pathname="/system/it-incidents"
        total={result.total}
        limit={PAGE_SIZE}
        offset={props.offset}
      />
    </div>
  )
}
