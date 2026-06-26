// application 層が返す失敗は、すべてこのカスタムエラーで表す。
// 旧来の素の Error や { reason } 判別ユニオンを上位へ漏らさず、何が起きたかを
// code（機械判定用の安定した識別子。旧 reason に相当）と message（人間可読の説明）で表現する。
// infrastructure が返した素の Error や DB の内部情報は cause に隠し、message には載せない。
// interface 層は instanceof で HTTP ステータスへ翻訳し、message と code だけを応答に出す。

/**
 * application 層が返す失敗の基底。code は機械判定用の安定した識別子、
 * message は人間可読の説明。内部の素エラーは options.cause に隠す
 */
export class ApplicationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    options?: ErrorOptions,
  ) {
    super(message, options)

    this.name = "ApplicationError"
  }
}

/**
 * 対象の資源が見つからない（HTTP 404 相当）
 */
export class NotFoundError extends ApplicationError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)

    this.name = "NotFoundError"
  }
}

/**
 * 権限が無く操作を拒否する（HTTP 403 相当）
 */
export class ForbiddenError extends ApplicationError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)

    this.name = "ForbiddenError"
  }
}

/**
 * 資源の状態が操作と矛盾する（重複・遷移不可・利用中など。HTTP 409 相当）
 */
export class ConflictError extends ApplicationError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)

    this.name = "ConflictError"
  }
}

/**
 * 入力が不正で処理できない（HTTP 400 相当）
 */
export class ValidationError extends ApplicationError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)

    this.name = "ValidationError"
  }
}

/**
 * 入力の形式は正しいが内容を処理できない（HTTP 422 相当）
 */
export class UnprocessableError extends ApplicationError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)

    this.name = "UnprocessableError"
  }
}

/**
 * 想定外の失敗。infrastructure が返した素のエラーや、満たされるはずの不変条件の破れを表す。
 * 内部情報は cause に隠し、message には安全な説明だけを載せる（HTTP 500 相当）
 */
export class UnexpectedError extends ApplicationError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, "unexpected", options)

    this.name = "UnexpectedError"
  }
}
