"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { ShiftFormState } from "@/app/(app)/shift/actions"
import { publishShiftAssignmentAction } from "@/app/(app)/shift/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ShiftAssignmentResponse } from "@/lib/api/types/shift-types"

type Props = {
  assignments: Array<ShiftAssignmentResponse>
  canManage: boolean
}

const initialState: ShiftFormState = { ok: false, error: null }

// 横断のシフト割当一覧。未公開の割当には特権ロール向けの公開ボタンを出す。
// 公開の結果は action の戻り値を見て toast で通知する（useEffect は使わない）。
export function ShiftAssignmentList(props: Props) {
  const publishAction = useActionState(publishShiftAssignmentAction, initialState)

  const publishState = publishAction[0]

  const publishDispatch = publishAction[1]

  const isPublishing = publishAction[2]

  if (publishState.ok) {
    toast.success("シフトを公開しました")
  } else if (publishState.error !== null) {
    toast.error(publishState.error)
  }

  if (props.assignments.length === 0) {
    return <p className="text-sm text-muted-foreground">シフト割当はありません</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>日付</TableHead>
          <TableHead>社員 ID</TableHead>
          <TableHead>パターン ID</TableHead>
          <TableHead>備考</TableHead>
          <TableHead>状態</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {props.assignments.map((assignment) => (
          <TableRow key={assignment.id}>
            <TableCell className="font-medium">{assignment.date}</TableCell>

            <TableCell className="tabular-nums">{assignment.employee_id}</TableCell>

            <TableCell className="tabular-nums">{assignment.pattern_id}</TableCell>

            <TableCell className="text-muted-foreground">{assignment.note ?? "-"}</TableCell>

            <TableCell>
              {assignment.published_at !== null ? (
                <Badge>公開済み</Badge>
              ) : (
                <Badge variant="outline">未公開</Badge>
              )}
            </TableCell>

            <TableCell className="text-right">
              {props.canManage && assignment.published_at === null ? (
                <form action={publishDispatch}>
                  <input type="hidden" name="assignment_id" value={assignment.id ?? ""} />

                  <Button type="submit" variant="secondary" size="sm" disabled={isPublishing}>
                    公開する
                  </Button>
                </form>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
