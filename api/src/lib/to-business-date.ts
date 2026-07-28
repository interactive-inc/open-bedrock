const businessDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/**
 * UTC ISO 文字列を業務タイムゾーン（Asia/Tokyo）の YYYY-MM-DD に変換する。
 * JST 早朝（UTC 前日 15:00〜23:59）の打刻を前日の勤務日にしないための基準変換。
 */
export function toBusinessDate(isoString: string): string {
  return businessDateFormatter.format(new Date(isoString))
}
