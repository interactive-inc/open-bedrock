import { DomainError } from "@system/domain/errors"

export type HealthCheckupErrorCode =
  | "forbidden"
  | "health_checkup_conflict"
  | "health_checkup_unavailable"

/** 健康診断実施記録原記録の保全操作が成立しない理由。 */
export class HealthCheckupError extends DomainError {
  constructor(
    readonly code: HealthCheckupErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "HealthCheckupError"
  }
}
