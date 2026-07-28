import { isoDate } from "@/lib/schemas"
import { CompanyTimeZoneError } from "@/lib/time/company-time-zone-error"

/**
 * 現在時刻（UTC ISO）と会社タイムゾーンから会社の営業日（YYYY-MM-DD）を解決する。
 * タイムゾーン未設定・不正、時刻が不正な場合は CompanyTimeZoneError を返す。
 */
export function resolveCompanyBusinessDate(props: {
  now: string
  timeZone: string | undefined
}): string | CompanyTimeZoneError {
  if (props.timeZone === undefined || props.timeZone.trim().length === 0) {
    return new CompanyTimeZoneError()
  }

  const instant = new Date(props.now)
  if (Number.isFinite(instant.getTime()) === false) {
    return new CompanyTimeZoneError()
  }

  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: props.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant)

    const year = parts.find((part) => part.type === "year")?.value
    const month = parts.find((part) => part.type === "month")?.value
    const day = parts.find((part) => part.type === "day")?.value
    const value = `${year ?? ""}-${month ?? ""}-${day ?? ""}`

    return isoDate.safeParse(value).success ? value : new CompanyTimeZoneError()
  } catch (error) {
    return new CompanyTimeZoneError({ cause: error })
  }
}
