"use client"

import { useActionState, useState } from "react"
import {
  cancelFamilyCareLeaveAction,
  updateFamilyCareLeaveAction,
} from "@/app/(app)/family-care-leaves/actions"
import type { FamilyCareLeaveActionState } from "@/app/(app)/family-care-leaves/actions"
import { EmptyState } from "@/components/empty-state"
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { FamilyCareLeaveResponse } from "@/lib/api/types/family-care-leave-types"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

type Props = {
  familyCareLeaves: ReadonlyArray<FamilyCareLeaveResponse>
}

// 自分の休業申出一覧。各行に変更（Dialog フォーム）と取消ボタンを置く表示コンポーネント。
export function MyFamilyCareLeavesList(props: Props) {
  if (props.familyCareLeaves.length === 0) {
    return <EmptyState title="休業申出はありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>種別</TableHead>
            <TableHead>開始</TableHead>
            <TableHead>終了予定</TableHead>
            <TableHead>備考</TableHead>
            <TableHead>状態</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.familyCareLeaves.map((familyCareLeave) => (
            <TableRow key={familyCareLeave.id}>
              <TableCell className="font-medium">{familyCareLeave.leave_kind}</TableCell>

              <TableCell>{familyCareLeave.start_date}</TableCell>

              <TableCell>{familyCareLeave.end_date}</TableCell>

              <TableCell>{familyCareLeave.note ?? "-"}</TableCell>

              <TableCell>{familyCareLeave.status}</TableCell>

              <TableCell>
                <div className="flex justify-end gap-2">
                  <UpdateFamilyCareLeaveDialog familyCareLeave={familyCareLeave} />

                  <CancelFamilyCareLeaveButton familyCareLeaveId={familyCareLeave.id} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// 休業申出変更フォームを Dialog で開く。種別・期間・備考を編集して送信する。
function UpdateFamilyCareLeaveDialog(props: { familyCareLeave: FamilyCareLeaveResponse }) {
  const [open, setOpen] = useState(false)

  async function reduce(
    previousState: FamilyCareLeaveActionState,
    formData: FormData,
  ): Promise<FamilyCareLeaveActionState> {
    const result = await updateFamilyCareLeaveAction(previousState, formData)

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
          <DialogTitle>休業申出を変更</DialogTitle>

          <DialogDescription>種別・期間・備考を変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="family_care_leave_id" value={props.familyCareLeave.id} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="update_leave_kind">種別</FieldLabel>

              <NativeSelect
                id="update_leave_kind"
                name="leave_kind"
                className="w-full"
                defaultValue={props.familyCareLeave.leave_kind}
              >
                <NativeSelectOption value="maternity">産休</NativeSelectOption>

                <NativeSelectOption value="childcare">育休</NativeSelectOption>

                <NativeSelectOption value="family_care">介護休業</NativeSelectOption>
              </NativeSelect>
            </Field>

            <Field>
              <FieldLabel htmlFor="update_start_date">開始日</FieldLabel>

              <Input
                id="update_start_date"
                name="start_date"
                type="date"
                defaultValue={props.familyCareLeave.start_date}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_end_date">終了予定日</FieldLabel>

              <Input
                id="update_end_date"
                name="end_date"
                type="date"
                defaultValue={props.familyCareLeave.end_date}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_note">備考</FieldLabel>

              <Input
                id="update_note"
                name="note"
                maxLength={FORM_CONSTRAINTS.familyCareLeave.noteMax}
                defaultValue={props.familyCareLeave.note ?? ""}
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

// 休業申出取消ボタン。確認ダイアログを表示し、承認後に Server Action を呼ぶ。
function CancelFamilyCareLeaveButton(props: { familyCareLeaveId: string }) {
  const [, formAction, pending] = useActionState(cancelFamilyCareLeaveAction, {
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
          <AlertDialogTitle>休業申出を取り消しますか？</AlertDialogTitle>

          <AlertDialogDescription>
            この休業申出の取消後は、再度申出が必要になります。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>やめる</AlertDialogCancel>

          <form action={formAction}>
            <input type="hidden" name="family_care_leave_id" value={props.familyCareLeaveId} />

            <AlertDialogAction type="submit" variant="destructive" disabled={pending}>
              取消する
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
