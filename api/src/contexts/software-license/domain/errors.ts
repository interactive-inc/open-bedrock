import { DomainError } from "@system/domain/errors"
export type LicenseErrorCode =
  | "forbidden"
  | "license_not_found"
  | "assignment_not_found"
  | "invalid_license"
  | "license_conflict"
  | "license_unavailable"

/** 台帳操作が成立しない理由。保存先の内部情報はcauseに残す。 */
export class LicenseError extends DomainError {
  constructor(
    readonly code: LicenseErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "LicenseError"
  }
}
