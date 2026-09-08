import type { BatchJobStatus } from "@/lib/api/types/batch-types"

/**
 * バッチジョブの状態に対応する Button の variant を返す純粋関数。
 * completed=secondary（落ち着いた表示）, failed=destructive, running=secondary。
 */
export function toBatchStatusVariant(status: BatchJobStatus): "secondary" | "destructive" {
  if (status === "failed") {
    return "destructive"
  }

  return "secondary"
}
