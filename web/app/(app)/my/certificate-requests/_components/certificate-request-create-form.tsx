"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createCertificateRequestAction } from "@/app/(app)/my/certificate-requests/actions"
import type { CertificateRequestActionState } from "@/app/(app)/my/certificate-requests/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const initialState: CertificateRequestActionState = { ok: false, error: null }

/**
 * 証明書発行依頼フォーム。native form + Server Action を useActionState で呼び、結果を sonner で通知する。
 * reducer 内で Server Action を 1 回だけ実行し、その結果で toast() する（useEffect は使わない）。
 */
export function CertificateRequestCreateForm() {
  const router = useRouter()

  /** useActionState の reducer。Server Action を実行し結果をそのまま次の state にする。 */
  async function reduce(
    previousState: CertificateRequestActionState,
    formData: FormData,
  ): Promise<CertificateRequestActionState> {
    const result = await createCertificateRequestAction(previousState, formData)

    if (result.ok) {
      toast.success("証明書発行を依頼しました")

      router.push("/my/certificate-requests")
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
      <h2 className="text-lg font-medium">証明書発行を依頼</h2>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="certificate-type">証明書種別</FieldLabel>

          <Input id="certificate-type" name="certificate_type" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="certificate-submit-to">提出先</FieldLabel>

          <Input id="certificate-submit-to" name="submit_to" placeholder="任意" />
        </Field>

        <Field>
          <FieldLabel htmlFor="certificate-needed-by">希望日</FieldLabel>

          <Input id="certificate-needed-by" name="needed_by" type="date" />
        </Field>

        <Field>
          <FieldLabel htmlFor="certificate-note">備考</FieldLabel>

          <Input id="certificate-note" name="note" placeholder="任意" />
        </Field>
      </FieldGroup>

      <FieldDescription>
        提出先・希望日・備考は任意です。発行可否の判定は行わず記録のみです
      </FieldDescription>

      {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "依頼中..." : "依頼する"}
        </Button>
      </div>
    </form>
  )
}
