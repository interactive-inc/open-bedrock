"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createAntisocialCheckAction } from "@/app/(app)/my/antisocial-checks/actions"
import type { AntisocialCheckActionState } from "@/app/(app)/my/antisocial-checks/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const initialState: AntisocialCheckActionState = { ok: false, error: null }

/**
 * 反社チェック申請フォーム。native form + Server Action を useActionState で呼び、結果を sonner で通知する。
 * reducer 内で Server Action を 1 回だけ実行し、その結果で toast() する（useEffect は使わない）。
 */
export function AntisocialCheckCreateForm() {
  const router = useRouter()

  /** useActionState の reducer。Server Action を実行し結果をそのまま次の state にする。 */
  async function reduce(
    previousState: AntisocialCheckActionState,
    formData: FormData,
  ): Promise<AntisocialCheckActionState> {
    const result = await createAntisocialCheckAction(previousState, formData)

    if (result.ok) {
      toast.success("反社チェックを申請しました")

      router.push("/my/antisocial-checks")
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
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border p-4">
      <h2 className="text-lg font-medium">反社チェックを申請</h2>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="check-partner">取引先名</FieldLabel>

          <Input id="check-partner" name="partner_name" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="check-address">所在地</FieldLabel>

          <Input id="check-address" name="partner_address" placeholder="任意" />
        </Field>

        <Field>
          <FieldLabel htmlFor="check-representative">代表者名</FieldLabel>

          <Input id="check-representative" name="representative_name" placeholder="任意" />
        </Field>
      </FieldGroup>

      <FieldDescription>
        所在地・代表者名は任意です。判定や法的な確認は行わず記録のみです
      </FieldDescription>

      {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "申請中..." : "申請する"}
        </Button>
      </div>
    </form>
  )
}
