/**
 * 操作の結果、ログイン可能な実効管理者が 0 件になるため batch が rollback されたことを表す。
 * 実効管理者ガードを原子的に行う repository メソッドが返す。application 層はこれを検知して
 * ConflictError("last_admin") に変換する。
 */
export class LastAdminError extends Error {
  constructor() {
    super("operation would remove the last effective admin")

    this.name = "LastAdminError"

    Object.freeze(this)
  }
}
