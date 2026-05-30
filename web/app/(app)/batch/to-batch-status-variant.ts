import type { BatchJobStatus } from "@/lib/api/types/batch-types"

// バッチジョブの状態に対応する Badge の variant を返す純粋関数。
// completed=secondary（落ち着いた表示）, failed=destructive, running=outline。
export function toBatchStatusVariant(
  status: BatchJobStatus,
): "secondary" | "destructive" | "outline" {
  if (status === "completed") {
    return "secondary"
  }

  if (status === "failed") {
    return "destructive"
  }

  return "outline"
}
