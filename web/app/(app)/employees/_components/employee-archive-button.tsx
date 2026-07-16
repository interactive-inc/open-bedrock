"use client"

import { archiveEmployeeAction } from "@/app/(app)/employees/actions"
import type { EmployeeArchiveFormState } from "@/app/(app)/employees/actions"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"
import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"

const initialState: EmployeeArchiveFormState = { ok: false, error: null }

export function EmployeeArchiveButton(props: { code: string }) {
  const router = useRouter()

  async function reduce(
    previousState: EmployeeArchiveFormState,
    formData: FormData,
  ): Promise<EmployeeArchiveFormState> {
    const result = await archiveEmployeeAction(previousState, formData)
    if (result.ok) {
      toast.success("従業員をアーカイブしました")
      router.push("/employees")
    } else if (result.error !== null) {
      toast.error(result.error)
    }
    return result
  }

  const [state, action, pending] = useActionState(reduce, initialState)
  return (
    <ConfirmActionDialog
      action={action}
      triggerLabel="アーカイブ"
      title="この退職者をアーカイブしますか？"
      description="ログインを停止し、通常の従業員一覧から非表示にします。人事発令、申請、評価、勤怠、監査の履歴は保持されます。"
      confirmLabel="履歴を保持してアーカイブ"
      pending={pending}
    >
      <input type="hidden" name="code" value={props.code} />
      <p className="sr-only" aria-live="polite">
        {state.error}
      </p>
    </ConfirmActionDialog>
  )
}
