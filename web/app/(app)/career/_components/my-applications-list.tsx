"use client"

import { useActionState, useState } from "react"
import {
  updateCareerApplicationAction,
  withdrawCareerApplicationAction,
} from "@/app/(app)/career/actions"
import type { CareerApplicationActionState } from "@/app/(app)/career/actions"
import { EmptyState } from "@/components/empty-state"
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
}

const statusLabels: Record<CareerApplication["status"], string> = {
  applied: "選考中",
  accepted: "合格",
  rejected: "不合格",
}

// 自分の公募応募一覧。選考中の応募だけ変更（Dialog）と取り下げを許可する表示コンポーネント。
export function MyApplicationsList(props: Props) {
  if (props.applications.length === 0) {
    return <EmptyState title="応募はありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>公募 ID</TableHead>
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
                <TableCell className="font-medium">{application.posting_id}</TableCell>

                <TableCell>{application.message ?? "-"}</TableCell>

                <TableCell>
                  <Badge variant="secondary">{statusLabels[application.status]}</Badge>
                </TableCell>

                <TableCell>
                  <div className="flex justify-end gap-2">
                    {application.status === "applied" ? (
                      <UpdateApplicationDialog
                        applicationId={applicationId}
                        application={application}
                      />
                    ) : null}

                    {application.status === "applied" ? (
                      <WithdrawApplicationButton applicationId={applicationId} />
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

// 応募メッセージ変更フォームを Dialog で開く。
function UpdateApplicationDialog(props: { applicationId: number; application: CareerApplication }) {
  const [open, setOpen] = useState(false)

  async function reduce(
    previousState: CareerApplicationActionState,
    formData: FormData,
  ): Promise<CareerApplicationActionState> {
    const result = await updateCareerApplicationAction(previousState, formData)

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

// 応募取り下げボタン。Server Action を呼び、成功時はリストが revalidate される。
function WithdrawApplicationButton(props: { applicationId: number }) {
  const [_state, formAction, pending] = useActionState(withdrawCareerApplicationAction, {
    ok: false,
    error: null,
  })

  return (
    <form action={formAction}>
      <input type="hidden" name="application_id" value={props.applicationId} />

      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        取り下げ
      </Button>
    </form>
  )
}
