"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { disposeAssetAction } from "@/app/(app)/asset/assets/actions"
import type { AssetDisposeFormState } from "@/app/(app)/asset/assets/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type Props = {
  // 廃棄対象の資産コード。hidden フィールドへ埋め込む。
  code: string
}

const initialState: AssetDisposeFormState = { ok: false, error: null }

/**
 * 物品廃棄フォーム。理由（必須）と廃棄日（任意）を送る。在庫の物品にだけ表示する想定。
 * 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
 */
export function AssetDisposeForm(props: Props) {
  async function reduce(
    previousState: AssetDisposeFormState,
    formData: FormData,
  ): Promise<AssetDisposeFormState> {
    const result = await disposeAssetAction(previousState, formData)

    if (result.ok) {
      toast.success("廃棄しました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  return (
    <form action={formAction}>
      <input type="hidden" name="code" value={props.code} />

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="dispose-reason">廃棄理由</FieldLabel>

          <Input id="dispose-reason" name="reason" placeholder="経年劣化のため" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="dispose-disposed-on">廃棄日（任意）</FieldLabel>

          <Input id="dispose-disposed-on" name="disposed_on" type="date" />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" size="sm" variant="outline" disabled={isPending}>
            {isPending ? "廃棄中..." : "廃棄する"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
