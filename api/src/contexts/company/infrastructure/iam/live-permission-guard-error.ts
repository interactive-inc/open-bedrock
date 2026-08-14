/** live permission 境界が操作を拒否したことを表すエラー。 */
export class LivePermissionGuardError extends Error {
  constructor(options?: ErrorOptions) {
    super("live permission boundary rejected the operation", options)
    this.name = "LivePermissionGuardError"
  }
}
