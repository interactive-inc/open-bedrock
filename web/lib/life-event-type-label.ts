const LIFE_EVENT_TYPE_LABELS: Record<string, string> = {
  marriage: "結婚",
  divorce: "離婚",
  childbirth: "出産",
  relocation: "転居",
  dependent_added: "扶養追加",
  dependent_removed: "扶養取消",
}

/** ライフイベント種別コードを日本語ラベルへ変換する */
export function lifeEventTypeLabel(eventType: string): string {
  return LIFE_EVENT_TYPE_LABELS[eventType] ?? eventType
}
