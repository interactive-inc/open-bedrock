"use client"

import { useActionState, useState } from "react"
import {
  deleteOnboardingTemplateAction,
  updateOnboardingTemplateAction,
} from "@/app/(app)/onboarding/actions"
import type { TemplateMutationState } from "@/app/(app)/onboarding/actions"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import type { OnboardingTemplate } from "@/lib/api/types/onboarding-types"

type Props = {
  template: OnboardingTemplate
}

// テンプレート行の管理操作（変更 Dialog と削除）。管理権限にのみ表示する。
export function TemplateManagement(props: Props) {
  return (
    <div className="flex items-center justify-end gap-2">
      <UpdateTemplateDialog template={props.template} />

      <DeleteTemplateButton code={props.template.code} />
    </div>
  )
}

// テンプレート変更フォームを Dialog で開く。名称・種別・説明を編集する。code は変更しない。
function UpdateTemplateDialog(props: { template: OnboardingTemplate }) {
  const [open, setOpen] = useState(false)

  async function reduce(
    previousState: TemplateMutationState,
    formData: FormData,
  ): Promise<TemplateMutationState> {
    const result = await updateOnboardingTemplateAction(previousState, formData)

    if (result.ok) {
      setOpen(false)
    }

    return result
  }

  const [state, formAction, pending] = useActionState(reduce, {
    ok: false,
    message: null,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>テンプレートを変更</DialogTitle>

          <DialogDescription>コードは変更されません。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="code" value={props.template.code} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="update-template-name">名称</FieldLabel>

              <Input
                id="update-template-name"
                name="name"
                defaultValue={props.template.name}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update-template-kind">種別</FieldLabel>

              <NativeSelect
                id="update-template-kind"
                name="kind"
                defaultValue={props.template.kind === "leave" ? "leave" : "join"}
              >
                <NativeSelectOption value="join">入社</NativeSelectOption>

                <NativeSelectOption value="leave">退社</NativeSelectOption>
              </NativeSelect>
            </Field>

            <Field>
              <FieldLabel htmlFor="update-template-description">説明</FieldLabel>

              <Textarea
                id="update-template-description"
                name="description"
                defaultValue={props.template.description ?? ""}
              />
            </Field>
          </FieldGroup>

          {state.message !== null && state.ok === false ? (
            <p className="text-sm text-destructive">{state.message}</p>
          ) : null}

          <Button type="submit" disabled={pending}>
            変更を保存
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// テンプレートを削除するボタン。Server Action を呼び、成功時は一覧が revalidate される。
function DeleteTemplateButton(props: { code: string }) {
  const [state, formAction, pending] = useActionState(deleteOnboardingTemplateAction, {
    ok: false,
    message: null,
  })

  return (
    <div className="flex flex-col gap-1">
      <ConfirmActionDialog
        action={formAction}
        triggerLabel="削除"
        title="このオンボーディングテンプレートを削除しますか？"
        description="テンプレートは元に戻せません。既存の割り当ては削除されません。"
        confirmLabel="テンプレートを削除"
        pending={pending}
      >
        <input type="hidden" name="code" value={props.code} />
      </ConfirmActionDialog>

      {state.message !== null && state.ok === false ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}
    </div>
  )
}
