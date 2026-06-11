import { toBatchStatusLabel } from "@/app/(app)/batch/_lib/to-batch-status-label"
import { toBatchStatusVariant } from "@/app/(app)/batch/_lib/to-batch-status-variant"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { BatchJobResponse } from "@/lib/api/types/batch-types"

type Props = {
  jobs: ReadonlyArray<BatchJobResponse>
}

// バッチジョブの状況をテーブル描画する表示専用コンポーネント。
// ジョブ名 / 状態（バッジ）/ 最終実行（finished_at、無ければ started_at）を表示する。
export function BatchJobTable(props: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ジョブ名</TableHead>
          <TableHead>状態</TableHead>
          <TableHead>最終実行</TableHead>
          <TableHead>メッセージ</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {props.jobs.map((job) => (
          <TableRow key={job.id}>
            <TableCell className="font-medium">{job.name}</TableCell>

            <TableCell>
              <Badge variant={toBatchStatusVariant(job.status)}>
                {toBatchStatusLabel(job.status)}
              </Badge>
            </TableCell>

            <TableCell>{job.finished_at ?? job.started_at ?? "-"}</TableCell>

            <TableCell className="text-muted-foreground">{job.message ?? "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
