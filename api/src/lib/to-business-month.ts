import { toBusinessDate } from "@/lib/to-business-date"

/**
 * UTC ISO 文字列を業務タイムゾーン（Asia/Tokyo）の YYYY-MM に変換する。
 * 当月集計のデフォルト月を JST 基準で決めるための変換。
 */
export function toBusinessMonth(isoString: string): string {
  return toBusinessDate(isoString).slice(0, 7)
}
