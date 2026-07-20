import type { LeaveType } from "@/lib/api/types/leave-types"

type Props = {
  leaveType: LeaveType
}

/** 休暇種別 (annual/special) を日本語ラベルへ変換して表示する。 */
export function LeaveTypeLabel(props: Props) {
  if (props.leaveType === "special") {
    return <span>特別休暇</span>
  }

  return <span>年次有給</span>
}
