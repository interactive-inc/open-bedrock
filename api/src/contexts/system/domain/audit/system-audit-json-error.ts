export type SystemAuditJsonErrorCode = "invalid_json" | "payload_too_large"

function toMessage(code: SystemAuditJsonErrorCode): string {
  return code === "payload_too_large"
    ? "system audit JSON exceeds the 64 KiB limit"
    : "system audit JSON contains an unsupported value"
}

/** 保存前の監査 JSON を安全に正規化できないことを表す。 */
export class SystemAuditJsonError extends Error {
  readonly code: SystemAuditJsonErrorCode

  constructor(code: SystemAuditJsonErrorCode, options?: ErrorOptions) {
    super(toMessage(code), options)
    this.name = "SystemAuditJsonError"
    this.code = code
    Object.freeze(this)
  }
}
