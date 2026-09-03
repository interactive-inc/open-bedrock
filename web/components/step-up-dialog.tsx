"use client"

import { useActionState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { stepUpAction } from "@/lib/auth/step-up-action"
import type { StepUpFormState } from "@/lib/auth/step-up-action"

type Props = {
  open: boolean
  onSucceeded: () => void
  onCancel: () => void
}

const initialState: StepUpFormState = { ok: false, error: null }

/**
 * 高リスク操作の直前にパスワードを再入力させるダイアログ。
 * 成功すると再認証 grant が cookie に置かれ、呼び出し元が元の操作を再実行する。
 */
export function StepUpDialog(props: Props) {
  async function reduce(
    previousState: StepUpFormState,
    formData: FormData,
  ): Promise<StepUpFormState> {
    const result = await stepUpAction(previousState, formData)

    if (result.ok) {
      props.onSucceeded()
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  function handleOpenChange(open: boolean): void {
    if (open === false) {
      props.onCancel()
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>パスワードを再入力してください</DialogTitle>

          <DialogDescription>
            この操作には再認証が必要です。確認後 5 分間は続けて操作できます。
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="step-up-password">パスワード</FieldLabel>

            <Input
              id="step-up-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>

          {state.error !== null ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={props.onCancel}>
              やめる
            </Button>

            <Button type="submit" disabled={isPending}>
              {isPending ? "確認中…" : "確認して続行"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
