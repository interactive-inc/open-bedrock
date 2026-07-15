"use client"

import { useState } from "react"
import {
  cancelCertificateRequestAction,
  updateCertificateRequestAction,
} from "@/app/(app)/certificate-requests/actions"
import { useFormAction } from "@/hooks/use-form-action"
import { EmptyState } from "@/components/empty-state"
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
import type { CertificateRequestResponse } from "@/lib/api/types/certificate-request-types"
import { statusLabel } from "@/lib/status-label"

type Props = {
  certificateRequests: ReadonlyArray<CertificateRequestResponse>
}

// 自分の証明書発行依頼一覧。各行に変更（Dialog フォーム）と取消ボタンを置く表示コンポーネント。
export function MyCertificateRequestsList(props: Props) {
  if (props.certificateRequests.length === 0) {
    return <EmptyState title="証明書発行依頼はありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>種別</TableHead>
            <TableHead>提出先</TableHead>
            <TableHead>希望日</TableHead>
            <TableHead>備考</TableHead>
            <TableHead>状態</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.certificateRequests.map((certificateRequest) => (
            <TableRow key={certificateRequest.id}>
              <TableCell className="font-medium">{certificateRequest.certificate_type}</TableCell>

              <TableCell>{certificateRequest.submit_to ?? "-"}</TableCell>

              <TableCell>{certificateRequest.needed_by ?? "-"}</TableCell>

              <TableCell>{certificateRequest.note ?? "-"}</TableCell>

              <TableCell>{statusLabel(certificateRequest.status)}</TableCell>

              <TableCell>
                <div className="flex justify-end gap-2">
                  <UpdateCertificateRequestDialog certificateRequest={certificateRequest} />

                  <CancelCertificateRequestButton certificateRequestId={certificateRequest.id} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// 証明書発行依頼変更フォームを Dialog で開く。種別・提出先・希望日・備考を編集して送信する。
function UpdateCertificateRequestDialog(props: { certificateRequest: CertificateRequestResponse }) {
  const [open, setOpen] = useState(false)

  const [state, formAction, pending] = useFormAction(
    updateCertificateRequestAction,
    { ok: false, error: null },
    "証明書発行依頼を変更しました",
    { onSuccess: () => setOpen(false) },
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>証明書発行依頼を変更</DialogTitle>

          <DialogDescription>種別・提出先・希望日・備考を変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="certificate_request_id" value={props.certificateRequest.id} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="update_certificate_type">種別</FieldLabel>

              <Input
                id="update_certificate_type"
                name="certificate_type"
                defaultValue={props.certificateRequest.certificate_type}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_submit_to">提出先</FieldLabel>

              <Input
                id="update_submit_to"
                name="submit_to"
                defaultValue={props.certificateRequest.submit_to ?? ""}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_needed_by">希望日</FieldLabel>

              <Input
                id="update_needed_by"
                name="needed_by"
                type="date"
                defaultValue={props.certificateRequest.needed_by ?? ""}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_note">備考</FieldLabel>

              <Input
                id="update_note"
                name="note"
                defaultValue={props.certificateRequest.note ?? ""}
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

// 証明書発行依頼取消ボタン。Server Action を呼び、成功時はリストが revalidate される。
function CancelCertificateRequestButton(props: { certificateRequestId: string }) {
  const [_state, formAction, pending] = useFormAction(cancelCertificateRequestAction, {
    ok: false,
    error: null,
  }, "証明書発行依頼を取り消しました")

  return (
    <ConfirmActionDialog
      action={formAction}
      triggerLabel="取消"
      title="この証明書発行依頼を取り消しますか？"
      description="取り消した依頼は元に戻せません。"
      confirmLabel="発行依頼を取り消す"
      pending={pending}
    >
      <input type="hidden" name="certificate_request_id" value={props.certificateRequestId} />
    </ConfirmActionDialog>
  )
}
