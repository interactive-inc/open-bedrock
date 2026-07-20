"use client"

import { useState } from "react"
import type { ShiftFormState } from "@/app/(app)/my/shifts/actions"
import { deleteShiftPatternAction, updateShiftPatternAction } from "@/app/(app)/my/shifts/actions"
import { useFormAction } from "@/hooks/use-form-action"
import { EmptyState } from "@/components/empty-state"
import { TableRowActions } from "@/components/table-row-actions"
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
import type { ShiftPatternResponse } from "@/lib/api/types/shift-types"

type Props = {
  patterns: Array<ShiftPatternResponse>
  canManage: boolean
}

const initialState: ShiftFormState = { ok: false, error: null }

/** シフトパターン一覧。特権ロールには各行に変更（Dialog）と削除ボタンを出す。 */
export function ShiftPatternList(props: Props) {
  if (props.patterns.length === 0) {
    return <EmptyState title="シフトパターンはまだありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>コード</TableHead>
            <TableHead>名前</TableHead>
            <TableHead>開始</TableHead>
            <TableHead>終了</TableHead>
            <TableHead>休憩（分）</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.patterns.map((pattern) => (
            <TableRow key={pattern.id}>
              <TableCell className="font-medium">{pattern.code}</TableCell>

              <TableCell>{pattern.name}</TableCell>

              <TableCell className="tabular-nums">{pattern.start_time}</TableCell>

              <TableCell className="tabular-nums">{pattern.end_time}</TableCell>

              <TableCell className="tabular-nums">{pattern.break_minutes ?? "-"}</TableCell>

              <TableCell>
                <TableRowActions>
                  {props.canManage ? <UpdatePatternDialog pattern={pattern} /> : null}

                  {props.canManage ? <DeletePatternButton patternId={pattern.id} /> : null}
                </TableRowActions>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** パターン変更フォームを Dialog で開く。コード・名前・勤務時間・休憩を編集して送信する。 */
function UpdatePatternDialog(props: { pattern: ShiftPatternResponse }) {
  const [open, setOpen] = useState(false)

  const [state, formAction, pending] = useFormAction(
    updateShiftPatternAction,
    initialState,
    "シフトパターンを変更しました",
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>シフトパターンを変更</DialogTitle>

          <DialogDescription>コード・名前・勤務時間・休憩を変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="pattern_id" value={props.pattern.id ?? undefined} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="pattern_code">コード</FieldLabel>

              <Input id="pattern_code" name="code" defaultValue={props.pattern.code} />
            </Field>

            <Field>
              <FieldLabel htmlFor="pattern_name">名前</FieldLabel>

              <Input id="pattern_name" name="name" defaultValue={props.pattern.name} />
            </Field>

            <Field>
              <FieldLabel htmlFor="pattern_start_time">開始時刻</FieldLabel>

              <Input
                id="pattern_start_time"
                name="start_time"
                type="time"
                defaultValue={props.pattern.start_time}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="pattern_end_time">終了時刻</FieldLabel>

              <Input
                id="pattern_end_time"
                name="end_time"
                type="time"
                defaultValue={props.pattern.end_time}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="pattern_break_minutes">休憩（分）</FieldLabel>

              <Input
                id="pattern_break_minutes"
                name="break_minutes"
                type="number"
                defaultValue={props.pattern.break_minutes ?? 0}
              />
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

/** パターン削除ボタン。割当から参照されているとサーバーが拒否し action がエラーを返す。 */
function DeletePatternButton(props: { patternId: number | null }) {
  const [, formAction, pending] = useFormAction(
    deleteShiftPatternAction,
    initialState,
    "シフトパターンを削除しました",
  )

  return (
    <ConfirmActionDialog
      action={formAction}
      triggerLabel="削除"
      title="このシフトパターンを削除しますか？"
      description="割当から参照中の場合は削除できません。削除後は元に戻せません。"
      confirmLabel="パターンを削除"
      pending={pending}
    >
      <input type="hidden" name="pattern_id" value={props.patternId ?? undefined} />
    </ConfirmActionDialog>
  )
}
