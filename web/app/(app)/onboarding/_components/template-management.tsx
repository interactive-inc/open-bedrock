"use client"

import { useState } from "react"
import {
  bindLifecycleTemplateAction,
  deleteOnboardingTemplateAction,
  updateOnboardingTemplateAction,
} from "@/app/(app)/onboarding/actions"
import type { TemplateMutationState } from "@/app/(app)/onboarding/actions"
import { useFormAction } from "@/hooks/use-form-action"
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
    <TableRowActions className="md:flex-wrap">
      <LifecycleBindingButton template={props.template} />

      <UpdateTemplateDialog template={props.template} />

      <DeleteTemplateButton code={props.template.code} />
    </TableRowActions>
  )
}

// テンプレート変更フォームを Dialog で開く。名称・種別・説明を編集する。code は変更しない。
function UpdateTemplateDialog(props: { template: OnboardingTemplate }) {
  const [open, setOpen] = useState(false)

  const [state, formAction, pending] = useFormAction(
    updateOnboardingTemplateAction,
    { ok: false, message: null } satisfies TemplateMutationState,
    (state) => state.message ?? "テンプレートを変更しました",
    { onSuccess: () => setOpen(false) },
  )

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

              {props.template.lifecycle_effect !== null ? (
                <input type="hidden" name="kind" value={props.template.kind} />
              ) : null}

              <NativeSelect
                id="update-template-kind"
                name={props.template.lifecycle_effect === null ? "kind" : undefined}
                defaultValue={props.template.kind === "leave" ? "leave" : "join"}
                disabled={props.template.lifecycle_effect !== null}
              >
                <NativeSelectOption value="join">入社</NativeSelectOption>

                <NativeSelectOption value="leave">退社</NativeSelectOption>
              </NativeSelect>

              {props.template.lifecycle_effect !== null ? (
                <p className="text-xs text-muted-foreground">
                  入退社イベントとの連携中は種別を変更できません。
                </p>
              ) : null}
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

function LifecycleBindingButton(props: { template: OnboardingTemplate }) {
  const [state, formAction, pending] = useFormAction(
    bindLifecycleTemplateAction,
    { ok: false, message: null } satisfies TemplateMutationState,
    (state) => state.message ?? "連携を変更しました",
  )
  const effect = props.template.kind === "leave" ? "retired" : "hire"
  const label = effect === "hire" ? "入社" : "退職"
  const isCurrent = props.template.lifecycle_effect === effect

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="code" value={props.template.code} />
      <input type="hidden" name="effect" value={effect} />
      <input type="hidden" name="operation" value={isCurrent ? "remove" : "bind"} />

      <Button
        type="submit"
        variant={isCurrent ? "outline" : "secondary"}
        size="sm"
        disabled={pending}
      >
        {isCurrent ? `${label}連携を解除` : `${label}連携に設定`}
      </Button>

      {state.message !== null ? (
        <p
          aria-live="polite"
          className={state.ok ? "text-xs text-muted-foreground" : "text-xs text-destructive"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  )
}

// テンプレートを削除するボタン。Server Action を呼び、成功時は一覧が revalidate される。
function DeleteTemplateButton(props: { code: string }) {
  const [state, formAction, pending] = useFormAction(
    deleteOnboardingTemplateAction,
    { ok: false, message: null } satisfies TemplateMutationState,
    (state) => state.message ?? "テンプレートを削除しました",
  )

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
