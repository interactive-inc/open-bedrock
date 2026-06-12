"use client"

import { useActionState, useState } from "react"
import {
  cancelYearEndAdjustmentAction,
  updateYearEndAdjustmentAction,
} from "@/app/(app)/year-end-adjustments/actions"
import type { YearEndAdjustmentActionState } from "@/app/(app)/year-end-adjustments/actions"
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
import type { YearEndAdjustmentResponse } from "@/lib/api/types/year-end-adjustment-types"

type Props = {
  yearEndAdjustments: ReadonlyArray<YearEndAdjustmentResponse>
}

// 自分の年末調整申告一覧。各行に変更（Dialog フォーム）と取消ボタンを置く表示コンポーネント。
export function MyYearEndAdjustmentsList(props: Props) {
  if (props.yearEndAdjustments.length === 0) {
    return <p className="text-sm text-muted-foreground">年末調整申告はありません</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>対象年</TableHead>
          <TableHead>備考</TableHead>
          <TableHead>状態</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {props.yearEndAdjustments.map((yearEndAdjustment) => (
          <TableRow key={yearEndAdjustment.id}>
            <TableCell className="font-medium">{yearEndAdjustment.target_year}</TableCell>

            <TableCell>{yearEndAdjustment.note ?? "-"}</TableCell>

            <TableCell>{yearEndAdjustment.status}</TableCell>

            <TableCell>
              <div className="flex justify-end gap-2">
                <UpdateYearEndAdjustmentDialog yearEndAdjustment={yearEndAdjustment} />

                <CancelYearEndAdjustmentButton yearEndAdjustmentId={yearEndAdjustment.id} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// 年末調整申告変更フォームを Dialog で開く。対象年・備考を編集して送信する。
function UpdateYearEndAdjustmentDialog(props: { yearEndAdjustment: YearEndAdjustmentResponse }) {
  const [open, setOpen] = useState(false)

  async function reduce(
    previousState: YearEndAdjustmentActionState,
    formData: FormData,
  ): Promise<YearEndAdjustmentActionState> {
    const result = await updateYearEndAdjustmentAction(previousState, formData)

    if (result.ok) {
      setOpen(false)
    }

    return result
  }

  const [state, formAction, pending] = useActionState(reduce, {
    ok: false,
    error: null,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>年末調整申告を変更</DialogTitle>

          <DialogDescription>対象年・備考を変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="year_end_adjustment_id" value={props.yearEndAdjustment.id} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="update_target_year">対象年</FieldLabel>

              <Input
                id="update_target_year"
                name="target_year"
                type="number"
                min="2000"
                defaultValue={props.yearEndAdjustment.target_year}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_note">備考</FieldLabel>

              <Input
                id="update_note"
                name="note"
                defaultValue={props.yearEndAdjustment.note ?? ""}
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

// 年末調整申告取消ボタン。Server Action を呼び、成功時はリストが revalidate される。
function CancelYearEndAdjustmentButton(props: { yearEndAdjustmentId: string }) {
  const [_state, formAction, pending] = useActionState(cancelYearEndAdjustmentAction, {
    ok: false,
    error: null,
  })

  return (
    <form action={formAction}>
      <input type="hidden" name="year_end_adjustment_id" value={props.yearEndAdjustmentId} />

      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        取消
      </Button>
    </form>
  )
}
