"use client"

import { useActionState, useState } from "react"
import { toast } from "sonner"
import type { ShiftFormState } from "@/app/(app)/shift/actions"
import {
  deleteShiftAssignmentAction,
  publishShiftAssignmentAction,
  updateShiftAssignmentAction,
} from "@/app/(app)/shift/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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

// 横断のシフト割当一覧。未公開の割当には公開ボタン、特権ロールには変更・削除も出す。
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

            <TableCell>
              <div className="flex justify-end gap-2">
                {props.canManage && assignment.published_at === null ? (
                  <form action={publishDispatch}>
                    <input type="hidden" name="assignment_id" value={assignment.id} />

                    <Button type="submit" variant="secondary" size="sm" disabled={isPublishing}>
                      公開する
                    </Button>
                  </form>
                ) : null}

                {props.canManage ? <UpdateAssignmentDialog assignment={assignment} /> : null}

                {props.canManage ? <DeleteAssignmentButton assignmentId={assignment.id} /> : null}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// 割当変更フォームを Dialog で開く。パターンコード・日付・備考を編集して送信する。
function UpdateAssignmentDialog(props: { assignment: ShiftAssignmentResponse }) {
  const [open, setOpen] = useState(false)

  const [state, formAction, pending] = useActionState(updateShiftAssignmentAction, initialState)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>シフト割当を変更</DialogTitle>

          <DialogDescription>パターン・日付・備考を変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="assignment_id" value={props.assignment.id} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="assignment_date">日付</FieldLabel>

              <Input
                id="assignment_date"
                name="date"
                type="date"
                defaultValue={props.assignment.date}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="assignment_pattern_code">パターンコード</FieldLabel>

              <Input id="assignment_pattern_code" name="pattern_code" placeholder="EARLY" />
            </Field>

            <Field>
              <FieldLabel htmlFor="assignment_note">備考</FieldLabel>

              <Input id="assignment_note" name="note" defaultValue={props.assignment.note ?? ""} />
            </Field>
          </FieldGroup>

          {state.error === null ? null : <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" disabled={pending}>
            変更を保存
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// 割当削除ボタン。Server Action を呼び、成功時はリストが revalidate される。
function DeleteAssignmentButton(props: { assignmentId: number }) {
  const [, formAction, pending] = useActionState(deleteShiftAssignmentAction, initialState)

  return (
    <form action={formAction}>
      <input type="hidden" name="assignment_id" value={props.assignmentId} />

      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        削除
      </Button>
    </form>
  )
}
