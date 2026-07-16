"use client"

import { useActionState, useState } from "react"
import { toast } from "sonner"
import type { ShiftFormState } from "@/app/(app)/shift/actions"
import {
  deleteShiftAssignmentAction,
  publishShiftAssignmentAction,
  updateShiftAssignmentAction,
} from "@/app/(app)/shift/actions"
import { EmptyState } from "@/components/empty-state"
import { TableRowActions } from "@/components/table-row-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
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
  employeeNameMap: Record<number, string>
  patternNameMap: Record<number, string>
}

const initialState: ShiftFormState = { ok: false, error: null }

// 横断のシフト割当一覧。未公開の割当には公開ボタン、特権ロールには変更・削除も出す。
// 公開の結果は action の戻り値を見て toast で通知する（useEffect は使わない）。
export function ShiftAssignmentList(props: Props) {
  const publishAction = useActionState(
    async (previousState: ShiftFormState, formData: FormData) => {
      const next = await publishShiftAssignmentAction(previousState, formData)

      if (next.ok) {
        toast.success("シフトを公開しました")
      } else if (next.error !== null) {
        toast.error(next.error)
      }

      return next
    },
    initialState,
  )

  const publishDispatch = publishAction[1]

  const isPublishing = publishAction[2]

  if (props.assignments.length === 0) {
    return <EmptyState title="シフト割当はありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>日付</TableHead>
            <TableHead>従業員</TableHead>
            <TableHead>パターン</TableHead>
            <TableHead>備考</TableHead>
            <TableHead>状態</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.assignments.map((assignment) => (
            <TableRow key={assignment.id}>
              <TableCell className="font-medium">{assignment.date}</TableCell>

              <TableCell>
                {props.employeeNameMap[assignment.employee_id] ?? `#${assignment.employee_id}`}
              </TableCell>

              <TableCell>
                {assignment.pattern_id !== null
                  ? (props.patternNameMap[assignment.pattern_id] ?? "-")
                  : "-"}
              </TableCell>

              <TableCell className="text-muted-foreground">{assignment.note ?? "-"}</TableCell>

              <TableCell>
                {assignment.published_at !== null ? (
                  <Badge>公開済み</Badge>
                ) : (
                  <Badge variant="outline">未公開</Badge>
                )}
              </TableCell>

              <TableCell>
                <TableRowActions>
                  {props.canManage && assignment.published_at === null ? (
                    <form action={publishDispatch}>
                      <input type="hidden" name="assignment_id" value={assignment.id ?? ""} />

                      <Button type="submit" variant="secondary" size="sm" disabled={isPublishing}>
                        公開する
                      </Button>
                    </form>
                  ) : null}

                  {props.canManage ? <UpdateAssignmentDialog assignment={assignment} /> : null}

                  {props.canManage ? <DeleteAssignmentButton assignmentId={assignment.id} /> : null}
                </TableRowActions>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// 割当変更フォームを Dialog で開く。パターンコード・日付・備考を編集して送信する。
// 成功・失敗の通知は action の結果を見て toast() で出す。
function UpdateAssignmentDialog(props: { assignment: ShiftAssignmentResponse }) {
  const [open, setOpen] = useState(false)

  async function reduce(
    previousState: ShiftFormState,
    formData: FormData,
  ): Promise<ShiftFormState> {
    const result = await updateShiftAssignmentAction(previousState, formData)

    if (result.ok) {
      toast.success("シフト割当を変更しました")

      setOpen(false)
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const [state, formAction, pending] = useActionState(reduce, initialState)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>シフト割当を変更</DialogTitle>

          <DialogDescription>パターン・日付・備考を変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="assignment_id" value={props.assignment.id ?? ""} />

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

          {state.error === null ? null : <FieldError>{state.error}</FieldError>}

          <Button type="submit" disabled={pending}>
            変更を保存
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// 割当削除ボタン。成功・失敗の通知は action の結果を見て toast() で出す。
function DeleteAssignmentButton(props: { assignmentId: number | null }) {
  async function reduce(
    previousState: ShiftFormState,
    formData: FormData,
  ): Promise<ShiftFormState> {
    const result = await deleteShiftAssignmentAction(previousState, formData)

    if (result.ok) {
      toast.success("シフト割当を削除しました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const [, formAction, pending] = useActionState(reduce, initialState)

  return (
    <ConfirmActionDialog
      action={formAction}
      triggerLabel="削除"
      title="このシフト割当を削除しますか？"
      description="公開済みの割当を削除すると従業員の表示からも消えます。"
      confirmLabel="シフト割当を削除"
      pending={pending}
    >
      <input type="hidden" name="assignment_id" value={props.assignmentId ?? ""} />
    </ConfirmActionDialog>
  )
}
