"use client"

import { useActionState, useState } from "react"
import { toast } from "sonner"
import { updateAssetAction } from "@/app/(app)/asset/assets/actions"
import type { AssetUpdateFormState } from "@/app/(app)/asset/assets/actions"
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

type Props = {
  // 編集対象の資産。hidden の code と各入力の初期値に使う。
  code: string
  name: string
  kind: string
  serial: string | null
  purchasedOn: string | null
}

const initialState: AssetUpdateFormState = { ok: false, error: null }

/**
 * 物品編集フォームを Dialog で開く。名称・種別・シリアル・購入日を変更して送信する。
 * 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
 */
export function AssetEditForm(props: Props) {
  const [open, setOpen] = useState(false)

  async function reduce(
    previousState: AssetUpdateFormState,
    formData: FormData,
  ): Promise<AssetUpdateFormState> {
    const result = await updateAssetAction(previousState, formData)

    if (result.ok) {
      toast.success("物品を更新しました")

      setOpen(false)
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="secondary" size="sm" />}>編集</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>物品を編集</DialogTitle>

          <DialogDescription>名称・種別・シリアル・購入日を変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="code" value={props.code} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit-asset-name">名称</FieldLabel>

              <Input id="edit-asset-name" name="name" defaultValue={props.name} required />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-asset-kind">種別</FieldLabel>

              <select
                id="edit-asset-kind"
                name="kind"
                defaultValue={props.kind}
                className="h-8 w-full min-w-0 rounded-2xl border border-transparent bg-input/50 px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <option value="pc">PC</option>
                <option value="monitor">モニター</option>
                <option value="furniture">什器</option>
                <option value="other">その他</option>
              </select>
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-asset-serial">シリアル（任意）</FieldLabel>

              <Input id="edit-asset-serial" name="serial" defaultValue={props.serial ?? ""} />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-asset-purchased-on">購入日（任意）</FieldLabel>

              <Input
                id="edit-asset-purchased-on"
                name="purchased_on"
                type="date"
                defaultValue={props.purchasedOn ?? ""}
              />
            </Field>

            {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

            <Button type="submit" disabled={isPending}>
              {isPending ? "更新中..." : "変更を保存"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
