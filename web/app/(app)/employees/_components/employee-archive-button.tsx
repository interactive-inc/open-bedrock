"use client"

import { archiveEmployeeAction } from "@/app/(app)/employees/actions"
import type { EmployeeArchiveFormState } from "@/app/(app)/employees/actions"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"
import { useActionState } from "react"
import { toast } from "sonner"

const initialState: EmployeeArchiveFormState = { ok: false, error: null }

async function reduce(
  previousState: EmployeeArchiveFormState,
  formData: FormData,
): Promise<EmployeeArchiveFormState> {
  const result = await archiveEmployeeAction(previousState, formData)
  if (result.error !== null) toast.error(result.error)
  return result
}

export function EmployeeArchiveButton(props: { code: string }) {
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
