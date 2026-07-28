"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import {
  revokeGovernanceOrgRoleAction,
  type GovernanceActionState,
} from "@/app/(app)/organization/governance/actions"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"

const initialState: GovernanceActionState = { ok: false, error: null }

async function reduceRevocation(
  state: GovernanceActionState,
  formData: FormData,
): Promise<GovernanceActionState> {
  const result = await revokeGovernanceOrgRoleAction(state, formData)
  if (result.ok) toast.success("組織ロールの割当を解除しました")
  else if (result.error !== null) toast.error(result.error)
  return result
}

export function RevokeOrgRoleButton(props: { assignmentId: number; employeeName: string }) {
  const [, action, pending] = useActionState(reduceRevocation, initialState)
  return (
    <ConfirmActionDialog
      action={action}
      triggerLabel="解除"
      title="組織ロールの割当を解除しますか？"
      description={`${props.employeeName} の現在の割当を解除します。過去の監査記録は保持されます。`}
      confirmLabel="割当を解除"
      pending={pending}
      size="sm"
    >
      <input type="hidden" name="assignment_id" value={props.assignmentId} />
    </ConfirmActionDialog>
  )
}
