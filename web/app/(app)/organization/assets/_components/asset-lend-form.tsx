"use client"

import { FieldError } from "@/components/ui/field"
import { useActionState } from "react"
import { toast } from "sonner"
import { lendAssetAction } from "@/app/(app)/organization/assets/actions"
import type { AssetLendFormState } from "@/app/(app)/organization/assets/actions"
import { EmployeeSelect } from "@/components/employee-select"
import { Button } from "@/components/ui/button"

type Props = {
  code: string
  employees: ReadonlyArray<{ code: string; name: string }>
}

const initialState: AssetLendFormState = { ok: false, error: null }

// 物品貸与フォーム。従業員コードを入力して貸与する。在庫の物品にだけ表示する想定。
// 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
export function AssetLendForm(props: Props) {
  async function reduce(
    previousState: AssetLendFormState,
    formData: FormData,
  ): Promise<AssetLendFormState> {
    const result = await lendAssetAction(previousState, formData)

    if (result.ok) {
      toast.success("貸与しました")
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
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="code" value={props.code} />

      <div className="flex flex-wrap items-center gap-2">
        <EmployeeSelect
          id="lend-employee-code"
          name="employee_code"
          employees={props.employees}
          className="w-64"
          required
        />

        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "貸与中..." : "貸与"}
        </Button>
      </div>

      {state.error !== null ? <FieldError>{state.error}</FieldError> : null}
    </form>
  )
}
