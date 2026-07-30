const FAMILY_CARE_LEAVE_KIND_LABELS: Record<string, string> = {
  maternity: "産休",
  childcare: "育休",
  family_care: "介護休業",
  other: "その他（療養等）",
}

/** 休業種別コードを日本語ラベルへ変換する */
export function familyCareLeaveKindLabel(kind: string): string {
  return FAMILY_CARE_LEAVE_KIND_LABELS[kind] ?? kind
}
