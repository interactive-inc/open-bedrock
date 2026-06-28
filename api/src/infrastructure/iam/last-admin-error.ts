/**
 * 操作の結果、有効な(active)admin が 0 件になるため batch が rollback されたことを表す。
 * last-admin ガードを原子的に行う repository メソッドが返す。application 層はこれを検知して
 * ConflictError("last_admin") に変換する。
 */
export class LastAdminError extends Error {
  constructor() {
    super("operation would remove the last active admin")

    this.name = "LastAdminError"

    Object.freeze(this)
  }
}
