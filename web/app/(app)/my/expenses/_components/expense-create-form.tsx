"use client"

import { useRouter } from "next/navigation"
import { useActionState, useState, useTransition } from "react"
import { toast } from "sonner"
import { submitExpenseAction, type ExpenseSubmitFormState } from "@/app/(app)/my/expenses/actions"
import { uploadExpenseAttachmentsAction } from "@/app/(app)/my/expenses/upload-attachments-action"
import type { ExpenseCategory, ExpenseAttachmentSummary } from "@/lib/api/types/expense-types"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"

const categories: ReadonlyArray<ExpenseCategory> = [
  "transport",
  "supplies",
  "entertainment",
  "books",
  "other",
]
type Props = {
  requestKey: string
  initial?: {
    id: number
    category: ExpenseCategory
    amount: number
    spent_at: string
    note: string | null
    attachments: ReadonlyArray<ExpenseAttachmentSummary>
  }
  mode?: "adopt" | "resubmit"
}

/** 経費の内容と添付を確認して提出する。失敗後も内容・添付・再送キーを保持する。 */
export function ExpenseCreateForm(props: Props) {
  const router = useRouter()
  const [fields, setFields] = useState(() => initialFields(props.initial))
  const attachmentState = useExpenseAttachments(props.initial?.attachments ?? [])
  const { attachments, uploadError, isUploading } = attachmentState
  const [submissionStarted, setSubmissionStarted] = useState(false)
  const readOnly = props.mode === "adopt" || submissionStarted
  const action = useActionState(
    async (previous: ExpenseSubmitFormState, form: FormData) => {
      setSubmissionStarted(true)
      const result = await submitExpenseAction(previous, form)
      if (result.ok) {
        toast.success("経費を提出しました")
        router.push("/my/expenses")
      } else if (result.error !== null) toast.error(result.error)
      return result
    },
    { ok: false, error: null },
  )
  return (
    <form
      action={action[1]}
      onReset={(event) => event.preventDefault()}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="request_key" value={props.requestKey} />
      <ExpenseSubmissionOrigin initial={props.initial} mode={props.mode} />
      {attachments.map((attachment) => (
        <input key={attachment.id} type="hidden" name="attachment_id" value={attachment.id} />
      ))}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="expense-category">カテゴリ</FieldLabel>
          <input type="hidden" name="category" value={fields.category} />
          <NativeSelect
            id="expense-category"
            value={fields.category}
            disabled={readOnly || action[2]}
            onChange={(event) => {
              const category = categories.find((entry) => entry === event.target.value)
              if (category !== undefined) setFields({ ...fields, category })
            }}
          >
            <NativeSelectOption value="transport">交通費</NativeSelectOption>
            <NativeSelectOption value="supplies">備品</NativeSelectOption>
            <NativeSelectOption value="entertainment">交際費</NativeSelectOption>
            <NativeSelectOption value="books">書籍</NativeSelectOption>
            <NativeSelectOption value="other">その他</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="expense-amount">金額（円）</FieldLabel>
          <Input
            id="expense-amount"
            name="amount"
            type="number"
            min={1}
            step={1}
            required
            value={fields.amount}
            readOnly={readOnly || action[2]}
            onChange={(event) => setFields({ ...fields, amount: event.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="expense-spent-at">利用日</FieldLabel>
          <Input
            id="expense-spent-at"
            name="spent_at"
            type="date"
            required
            value={fields.spentAt}
            readOnly={readOnly || action[2]}
            onChange={(event) => setFields({ ...fields, spentAt: event.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="expense-note">メモ（任意）</FieldLabel>
          <Textarea
            id="expense-note"
            name="note"
            rows={3}
            maxLength={3000}
            value={fields.note}
            readOnly={readOnly || action[2]}
            onChange={(event) => setFields({ ...fields, note: event.target.value })}
          />
        </Field>
        <ExpenseAttachmentField
          state={attachmentState}
          readOnly={readOnly}
          isSubmitting={action[2]}
        />
      </FieldGroup>
      {action[0].error !== null ? <FieldError>{action[0].error}</FieldError> : null}
      {submissionStarted && !action[0].ok ? (
        <p>
          提出結果を確認できない場合も、同じ内容で再試行できます。内容を変更する場合は、先に一覧で提出結果を確認してください。
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={isUploading || action[2] || action[0].ok || uploadError !== null}
      >
        {action[2] ? "提出中…" : submissionStarted ? "同じ内容で再試行" : "承認規程へ提出"}
      </Button>
    </form>
  )
}

function initialFields(initial: Props["initial"]) {
  return {
    category: initial?.category ?? "transport",
    amount: initial?.amount.toString() ?? "",
    spentAt: initial?.spent_at ?? "",
    note: initial?.note ?? "",
  }
}

function useExpenseAttachments(initial: ReadonlyArray<ExpenseAttachmentSummary>) {
  const [attachments, setAttachments] = useState<ReadonlyArray<ExpenseAttachmentSummary>>(initial)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isUploading, startUpload] = useTransition()
  const upload = (files: FileList | null) => {
    if (files === null) return
    const selected = Array.from(files)
    if (attachments.length + selected.length > 10) {
      setUploadError("添付は合計10件までです")
      return
    }
    if (selected.some((file) => file.size > 25 * 1024 * 1024)) {
      setUploadError("添付は1件25MBまでです")
      return
    }
    startUpload(async () => {
      try {
        for (const file of selected) {
          const form = new FormData()
          form.append("files", file)
          const result = await uploadExpenseAttachmentsAction(form)
          setAttachments((current) => [...current, ...result.uploaded])
          setUploadError(result.error)
          if (result.error !== null) return
        }
      } catch {
        setUploadError("添付を預けられませんでした。再度選択してください")
      }
    })
  }
  return { attachments, setAttachments, uploadError, setUploadError, isUploading, upload }
}

function ExpenseAttachmentField({
  state,
  readOnly,
  isSubmitting,
}: {
  state: ReturnType<typeof useExpenseAttachments>
  readOnly: boolean
  isSubmitting: boolean
}) {
  const { attachments, setAttachments, uploadError, setUploadError, isUploading, upload } = state
  return (
    <Field>
      <FieldLabel htmlFor="expense-files">領収書（任意）</FieldLabel>
      {!readOnly ? (
        <Input
          id="expense-files"
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/heic"
          disabled={isUploading || isSubmitting}
          onChange={(event) => {
            upload(event.target.files)
            event.target.value = ""
          }}
        />
      ) : null}
      <FieldDescription>
        {isUploading
          ? "添付を預けています…"
          : "PDF・JPEG・PNG・HEICを1件25MB、合計10件まで添付できます。"}
      </FieldDescription>
      <ul className="flex flex-col gap-2">
        {attachments.map((attachment) => (
          <li key={attachment.id} className="flex items-center justify-between gap-2">
            <span>{attachment.file_name}</span>
            {!readOnly ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isUploading || isSubmitting}
                onClick={() =>
                  setAttachments((current) => current.filter((entry) => entry.id !== attachment.id))
                }
                aria-label={`${attachment.file_name}を外す`}
              >
                外す
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {uploadError !== null ? (
        <>
          <FieldError>{uploadError}</FieldError>
          <Button type="button" variant="secondary" onClick={() => setUploadError(null)}>
            添付の選択をやり直す
          </Button>
        </>
      ) : null}
    </Field>
  )
}

function ExpenseSubmissionOrigin(props: Pick<Props, "initial" | "mode">) {
  return (
    <>
      {" "}
      {props.initial && props.mode === "adopt" ? (
        <input type="hidden" name="existing_expense_id" value={props.initial.id} />
      ) : null}
      {props.initial && props.mode === "resubmit" ? (
        <input type="hidden" name="previous_expense_id" value={props.initial.id} />
      ) : null}
    </>
  )
}
