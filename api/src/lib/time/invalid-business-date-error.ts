/**
 * 業務日（YYYY-MM-DD）として不正な値を渡されたことを表す。
 */
export class InvalidBusinessDateError extends Error {
  constructor(options?: ErrorOptions) {
    super("business date is invalid", options)
    this.name = "InvalidBusinessDateError"
  }
}
