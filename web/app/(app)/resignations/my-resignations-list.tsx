"use client"

import { useActionState, useState } from "react"
import { cancelResignationAction, updateResignationAction } from "@/app/(app)/resignations/actions"
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
import type { ResignationResponse } from "@/lib/api/types/resignation-types"

type Props = {
  resignations: ReadonlyArray<ResignationResponse>
}

// 自分の退職申請一覧。各行に変更（Dialog フォーム）と取消ボタンを置く表示コンポーネント。
export function MyResignationsList(props: Props) {
  if (props.resignations.length === 0) {
    return <p className="text-sm text-muted-foreground">退職申請はありません</p>
  }

  return (
    <Table>
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
            <TableCell className="font-medium">{resignation.resignation_date}</TableCell>

            <TableCell>{resignation.last_working_date ?? "-"}</TableCell>

            <TableCell>{resignation.reason ?? "-"}</TableCell>

            <TableCell>{resignation.status}</TableCell>

            <TableCell>
              <div className="flex justify-end gap-2">
                <UpdateResignationDialog resignation={resignation} />

                <CancelResignationButton resignationId={resignation.id} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// 退職申請変更フォームを Dialog で開く。退職希望日・最終出社日・理由を編集して送信する。
function UpdateResignationDialog(props: { resignation: ResignationResponse }) {
  const [open, setOpen] = useState(false)

  const [state, formAction, pending] = useActionState(updateResignationAction, {
    ok: false,
    error: null,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>変更</DialogTrigger>

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

// 退職申請取消ボタン。確認ダイアログを表示し、承認後に Server Action を呼ぶ。
function CancelResignationButton(props: { resignationId: string }) {
  const [, formAction, pending] = useActionState(cancelResignationAction, {
    ok: false,
    error: null,
  })

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
