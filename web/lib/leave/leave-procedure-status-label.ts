const labels: Readonly<Record<string, string>> = {
  draft: "未提出",
  approved: "承認済み",
  rejected: "却下",
  returned: "差戻し",
  cancelled: "取消済み",
  awaiting_execution: "判断済み・確定待ち",
}

/** 案件の判断状況と提出前の休暇を表示する。 */
export function leaveProcedureStatusLabel(status: string, procedureRequired: boolean): string {
  return labels[status] ?? (procedureRequired ? "未提出" : "判断待ち")
}
