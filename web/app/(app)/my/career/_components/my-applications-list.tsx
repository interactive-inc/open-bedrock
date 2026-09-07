"use client"

import { useState } from "react"
import {
  updateCareerApplicationAction,
  withdrawCareerApplicationAction,
} from "@/app/(app)/my/career/actions"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CareerApplication } from "@/lib/api/types/career-types"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

type Props = {
  applications: ReadonlyArray<CareerApplication>
  postingTitleMap: Record<number, string>
}

const statusLabels: Record<CareerApplication["status"], string> = {
  applied: "選考中",
  accepted: "合格",
  rejected: "不合格",
}

/** 自分の公募応募一覧。選考中の応募だけ変更（Dialog）と取り下げを許可する表示コンポーネント。 */
export function MyApplicationsList(props: Props) {
  if (props.applications.length === 0) {
    return <EmptyState title="応募はありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>公募</TableHead>
            <TableHead>メッセージ</TableHead>
            <TableHead>状態</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.applications.map((application) => {
            // 永続化済みの応募のみ id を持つ。未採番(null)は操作対象にならないため表示しない。
            const applicationId = application.id

            if (applicationId === null) {
              return null
            }

            return (
              <TableRow key={applicationId}>
                <TableCell>
                  {props.postingTitleMap[application.posting_id] ?? `#${application.posting_id}`}
                </TableCell>

                <TableCell>{application.message ?? "-"}</TableCell>

                <TableCell>
                  <Button type="button" variant="secondary" size="sm">
                    {statusLabels[application.status]}
                  </Button>
                </TableCell>

                <TableCell>
                  <TableRowActions>
                    {application.status === "applied" ? (
                      <UpdateApplicationDialog
                        applicationId={applicationId}
                        application={application}
                      />
                    ) : null}

                    {application.status === "applied" ? (
                      <WithdrawApplicationButton applicationId={applicationId} />
                    ) : null}
                  </TableRowActions>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

/** 応募メッセージ変更フォームを Dialog で開く。 */
function UpdateApplicationDialog(props: { applicationId: number; application: CareerApplication }) {
  const [open, setOpen] = useState(false)

  const [state, formAction, pending] = useFormAction(
    updateCareerApplicationAction,
    { ok: false, error: null },
    "応募内容を変更しました",
    { onSuccess: () => setOpen(false) },
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="secondary" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>応募メッセージを変更</DialogTitle>

          <DialogDescription>選考中の応募のみ変更できます。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="application_id" value={props.applicationId} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="update_application_message">応募メッセージ</FieldLabel>

              <Textarea
                id="update_application_message"
                name="message"
                rows={3}
                maxLength={FORM_CONSTRAINTS.career.applicationMessageMax}
                defaultValue={props.application.message ?? ""}
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

/** 応募取り下げボタン。Server Action を呼び、成功時はリストが revalidate される。 */
function WithdrawApplicationButton(props: { applicationId: number }) {
  const [_state, formAction, pending] = useFormAction(
    withdrawCareerApplicationAction,
    {
      ok: false,
      error: null,
    },
    "応募を取り下げました",
  )

  return (
    <ConfirmActionDialog
      action={formAction}
      triggerLabel="取り下げ"
      title="この応募を取り下げますか？"
      description="取り下げた応募は元に戻せません。"
      confirmLabel="応募を取り下げ"
      pending={pending}
    >
      <input type="hidden" name="application_id" value={props.applicationId} />
    </ConfirmActionDialog>
  )
}
