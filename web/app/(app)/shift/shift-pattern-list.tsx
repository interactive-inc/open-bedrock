"use client"

import { useActionState, useState } from "react"
import type { ShiftFormState } from "@/app/(app)/shift/actions"
import { deleteShiftPatternAction, updateShiftPatternAction } from "@/app/(app)/shift/actions"
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
import type { ShiftPatternResponse } from "@/lib/api/types/shift-types"

type Props = {
  patterns: Array<ShiftPatternResponse>
  canManage: boolean
}

const initialState: ShiftFormState = { ok: false, error: null }

// シフトパターン一覧。特権ロールには各行に変更（Dialog）と削除ボタンを出す。
export function ShiftPatternList(props: Props) {
  if (props.patterns.length === 0) {
    return <p className="text-sm text-muted-foreground">シフトパターンはまだありません</p>
  }

  return (
    <Table>
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
              <div className="flex justify-end gap-2">
                {props.canManage ? <UpdatePatternDialog pattern={pattern} /> : null}

                {props.canManage ? <DeletePatternButton patternId={pattern.id} /> : null}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// パターン変更フォームを Dialog で開く。コード・名前・勤務時間・休憩を編集して送信する。
function UpdatePatternDialog(props: { pattern: ShiftPatternResponse }) {
  const [open, setOpen] = useState(false)

  const [state, formAction, pending] = useActionState(updateShiftPatternAction, initialState)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>シフトパターンを変更</DialogTitle>

          <DialogDescription>コード・名前・勤務時間・休憩を変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="pattern_id" value={props.pattern.id} />

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

          {state.error === null ? null : <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" disabled={pending}>
            変更を保存
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// パターン削除ボタン。割当から参照されているとサーバーが拒否し action がエラーを返す。
function DeletePatternButton(props: { patternId: number }) {
  const [, formAction, pending] = useActionState(deleteShiftPatternAction, initialState)

  return (
    <form action={formAction}>
      <input type="hidden" name="pattern_id" value={props.patternId} />

      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        削除
      </Button>
    </form>
  )
}
