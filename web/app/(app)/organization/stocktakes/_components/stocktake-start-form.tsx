"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { startStocktakeAction } from "@/app/(app)/organization/stocktakes/actions"
import type { StocktakeStartFormState } from "@/app/(app)/organization/stocktakes/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const initialState: StocktakeStartFormState = { ok: false, error: null, id: null }

/**
 * 棚卸し開始フォーム。名称と対象日を native form で送る。
 * 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。成功時は詳細へ遷移する。
 */
export function StocktakeStartForm() {
  const router = useRouter()

  async function reduce(
    previousState: StocktakeStartFormState,
    formData: FormData,
  ): Promise<StocktakeStartFormState> {
    const result = await startStocktakeAction(previousState, formData)

    if (result.ok) {
      toast.success("棚卸しを開始しました")

      router.push(`/organization/stocktakes/${result.id}`)
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
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="stocktake-name">名称</FieldLabel>

          <Input id="stocktake-name" name="name" placeholder="2026年上期 棚卸し" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="stocktake-target-date">対象日</FieldLabel>

          <Input id="stocktake-target-date" name="target_date" type="date" required />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "開始中..." : "棚卸しを開始"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
