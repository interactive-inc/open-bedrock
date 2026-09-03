import { Badge } from "@/components/ui/badge"
import { toFlatGoalRows } from "@/app/(app)/performance-review/goals/tree/_lib/to-flat-goal-rows"
import { toOwnerTypeLabel } from "@/app/(app)/performance-review/goals/tree/_lib/to-owner-type-label"
import type { GoalTreeNode } from "@/app/(app)/performance-review/goals/tree/_lib/goal-tree-types"
import { statusLabel } from "@/lib/status-label"

type Props = {
  roots: ReadonlyArray<GoalTreeNode>
}

/** 目標ツリーをインデント付きの行で表示する。全社→部門→個人の順に深さで字下げする。 */
export function GoalTreeView(props: Props) {
  const rows = toFlatGoalRows(props.roots)

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">この期間の目標はありません。</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex items-center gap-3 rounded-md bg-card border p-3"
          style={{ marginInlineStart: `${row.depth * 24}px` }}
        >
          <Badge variant={row.ownerType === "individual" ? "outline" : "default"}>
            {toOwnerTypeLabel(row.ownerType)}
          </Badge>

          <span className="flex-1 font-medium">{row.title}</span>

          {row.departmentCode !== null ? (
            <span className="text-xs text-muted-foreground">{row.departmentCode}</span>
          ) : null}

          <span className="text-xs text-muted-foreground">重み {row.weight}</span>

          <span className="text-xs text-muted-foreground">{statusLabel(row.status)}</span>
        </li>
      ))}
    </ul>
  )
}
