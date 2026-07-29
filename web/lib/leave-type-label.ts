const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "年次有給",
  special: "特別休暇",
  compensatory: "代休",
  summer: "夏季休暇",
  child_nursing_care: "子の看護等休暇",
  prenatal_checkup: "妊婦通院休暇",
  menstrual: "生理休暇",
  caregiving_leave: "介護休暇",
}

/** 休暇種別コードを日本語ラベルへ変換する */
export function leaveTypeLabel(leaveType: string): string {
  return LEAVE_TYPE_LABELS[leaveType] ?? leaveType
}
