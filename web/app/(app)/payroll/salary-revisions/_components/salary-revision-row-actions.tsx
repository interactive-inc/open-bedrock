"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import {
  cancelSalaryRevisionAction,
  correctSalaryRevisionAction,
} from "@/app/(app)/payroll/admin/actions"
import type { PayrollAdminFormState } from "@/app/(app)/payroll/admin/actions"
import type { SalaryRevisionResponse } from "@/lib/api/types/payroll-types"
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
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type Props = {
  revision: SalaryRevisionResponse
}

const initialState: PayrollAdminFormState = { ok: false, error: null }

// 給与改定1件の訂正（編集）と取消（削除）操作。テーブル行に並べる管理者向け操作。
// 訂正はダイアログ内の native form、取消は確認付き AlertDialog で送る。
export function SalaryRevisionRowActions(props: Props) {
  const correctAction = useActionState(
    async (previousState: PayrollAdminFormState, formData: FormData) => {
      const next = await correctSalaryRevisionAction(previousState, formData)

      if (next.ok) {
        toast.success("給与改定を訂正しました")
      } else if (next.error !== null) {
        toast.error(next.error)
      }

      return next
    },
    initialState,
  )

  const cancelAction = useActionState(
    async (previousState: PayrollAdminFormState, formData: FormData) => {
      const next = await cancelSalaryRevisionAction(previousState, formData)

      if (next.ok) {
        toast.success("給与改定を取消しました")
      } else if (next.error !== null) {
        toast.error(next.error)
      }

      return next
    },
    initialState,
  )

  const correctState = correctAction[0]

  const correctDispatch = correctAction[1]

  const isCorrecting = correctAction[2]

  const cancelDispatch = cancelAction[1]

  const isCancelling = cancelAction[2]

  return (
    <div className="flex items-center justify-end gap-2">
      <Dialog>
        <DialogTrigger render={<Button variant="outline" size="sm" data-icon="edit" />}>
          訂正
        </DialogTrigger>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>給与改定を訂正</DialogTitle>
          </DialogHeader>

          <form action={correctDispatch}>
            <input type="hidden" name="id" value={props.revision.id} />

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`revision-effective-${props.revision.id}`}>適用日</FieldLabel>

                <Input
                  id={`revision-effective-${props.revision.id}`}
                  name="effective_date"
                  type="date"
                  defaultValue={props.revision.effective_date}
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor={`revision-new-base-${props.revision.id}`}>
                  改定後基本給（円）
                </FieldLabel>

                <Input
                  id={`revision-new-base-${props.revision.id}`}
                  name="new_base_salary"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={props.revision.new_base_salary}
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor={`revision-reason-${props.revision.id}`}>
                  理由（任意）
                </FieldLabel>

                <Textarea
                  id={`revision-reason-${props.revision.id}`}
                  name="reason"
                  rows={3}
                  defaultValue={props.revision.reason ?? ""}
                />
              </Field>

              {correctState.error !== null ? <FieldError>{correctState.error}</FieldError> : null}

              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>
                  閉じる
                </DialogClose>

                <Button type="submit" disabled={isCorrecting}>
                  {isCorrecting ? "訂正中..." : "訂正を保存"}
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog>
        <AlertDialogTrigger
          render={<Button variant="outline" size="sm" data-icon="trash" disabled={isCancelling} />}
        >
          取消
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>給与改定を取消しますか？</AlertDialogTitle>

            <AlertDialogDescription>
              この給与改定の記録を削除します。この操作は元に戻せません
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>やめる</AlertDialogCancel>

            <form action={cancelDispatch}>
              <input type="hidden" name="id" value={props.revision.id} />

              <AlertDialogAction type="submit" disabled={isCancelling}>
                取消する
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
