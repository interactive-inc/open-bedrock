import type { LeaveType } from "@/lib/api/types/leave-types"
import { leaveTypeLabel } from "@/lib/leave-type-label"

type Props = {
  leaveType: LeaveType
}

/** 休暇種別コードを日本語ラベルへ変換して表示する。 */
export function LeaveTypeLabel(props: Props) {
  return <span>{leaveTypeLabel(props.leaveType)}</span>
}
