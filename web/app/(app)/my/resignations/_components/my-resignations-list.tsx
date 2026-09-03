"use client"

import { useState } from "react"
import {
  cancelResignationAction,
  updateResignationAction,
} from "@/app/(app)/my/resignations/actions"
import type { ResignationActionState } from "@/app/(app)/my/resignations/actions"
import { useFormAction } from "@/hooks/use-form-action"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { EmptyState } from "@/components/empty-state"
import { TableRowActions } from "@/components/table-row-actions"
import { Button } from "@/components/ui/button"
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
import type { ResignationResponse } from "@/lib/api/types/resignation-types"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"
import { statusLabel } from "@/lib/status-label"

type Props = {
  resignations: ReadonlyArray<ResignationResponse>
}

/** 自分の退職申請一覧。各行に変更（Dialog フォーム）と取消ボタンを置く表示コンポーネント。 */
export function MyResignationsList(props: Props) {
  if (props.resignations.length === 0) {
    return <EmptyState title="退職申請はありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>退職希望日</TableHead>
            <TableHead>最終出社日</TableHead>
            <TableHead>理由</TableHead>
            <TableHead>状態</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.resignations.map((resignation) => (
            <TableRow key={resignation.id}>
              <TableCell>{resignation.resignation_date}</TableCell>

              <TableCell>{resignation.last_working_date ?? "-"}</TableCell>

              <TableCell>{resignation.reason ?? "-"}</TableCell>

              <TableCell>{statusLabel(resignation.status)}</TableCell>

              <TableCell>
                <TableRowActions>
                  <UpdateResignationDialog resignation={resignation} />

                  <CancelResignationButton resignationId={resignation.id} />
                </TableRowActions>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** 退職申請変更フォームを Dialog で開く。退職希望日・最終出社日・理由を編集して送信する。 */
function UpdateResignationDialog(props: { resignation: ResignationResponse }) {
  const [open, setOpen] = useState(false)

  const [state, formAction, pending] = useFormAction(
    updateResignationAction,
    { ok: false, error: null } satisfies ResignationActionState,
    "退職申請を変更しました",
    { onSuccess: () => setOpen(false) },
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="secondary" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>退職申請を変更</DialogTitle>

          <DialogDescription>退職希望日・最終出社日・理由を変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="resignation_id" value={props.resignation.id} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="update_resignation_date">退職希望日</FieldLabel>

              <Input
                id="update_resignation_date"
                name="resignation_date"
                type="date"
                defaultValue={props.resignation.resignation_date}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_last_working_date">最終出社日</FieldLabel>

              <Input
                id="update_last_working_date"
                name="last_working_date"
                type="date"
                defaultValue={props.resignation.last_working_date ?? ""}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_reason">理由</FieldLabel>

              <Input
                id="update_reason"
                name="reason"
                defaultValue={props.resignation.reason ?? ""}
                maxLength={FORM_CONSTRAINTS.resignation.reasonMax}
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

/** 退職申請取消ボタン。確認ダイアログを表示し、承認後に Server Action を呼ぶ。 */
function CancelResignationButton(props: { resignationId: string }) {
  const [, formAction, pending] = useFormAction(
    cancelResignationAction,
    {
      ok: false,
      error: null,
    },
    "退職申請を取り消しました",
  )

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" size="sm" disabled={pending} />}>
        取消
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>退職申請を取り消しますか？</AlertDialogTitle>

          <AlertDialogDescription>
            この退職申請の取消後は、再度申請が必要になります。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>やめる</AlertDialogCancel>

          <form action={formAction}>
            <input type="hidden" name="resignation_id" value={props.resignationId} />

            <AlertDialogAction type="submit" variant="destructive" disabled={pending}>
              取消する
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
