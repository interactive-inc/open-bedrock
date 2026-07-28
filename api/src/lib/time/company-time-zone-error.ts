/**
 * 会社タイムゾーンが未設定・不正で営業日を解決できないことを表す。
 */
export class CompanyTimeZoneError extends Error {
  constructor(options?: ErrorOptions) {
    super("company time zone is unavailable", options)
    this.name = "CompanyTimeZoneError"
  }
}
