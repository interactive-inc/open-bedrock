const EVALUATION_KIND_LABELS: Record<string, string> = {
  self: "自己評価",
  manager: "上長評価",
  final: "確定評価",
}

/** 評価種別を日本語ラベルに変換する。評価フォームと評価一覧で共用する */
export function evaluationKindLabel(kind: string): string {
  return EVALUATION_KIND_LABELS[kind] ?? kind
}
