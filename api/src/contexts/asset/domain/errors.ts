import { DomainError } from "@system/domain/errors"

export type AssetErrorCode = "forbidden" | "asset_conflict" | "asset_unavailable"

/** asset原記録の保全操作が成立しない理由。 */
export class AssetError extends DomainError {
  constructor(
    readonly code: AssetErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "AssetError"
  }
}
