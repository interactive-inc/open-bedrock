import { canManageTraining } from "@/lib/training/can-manage-training"

export type Props = {
  enrollmentEmployeeId: number
  viewerEmployeeId: number
  viewerRole: string
}

// 本人、または管理権限を持つ者だけが受講の閲覧・変更・取消を行える。
export function canModifyEnrollment(props: Props): boolean {
  if (props.enrollmentEmployeeId === props.viewerEmployeeId) {
    return true
  }

  return canManageTraining(props.viewerRole)
}
