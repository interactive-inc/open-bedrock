// application 層が「何が起きたか」を名前とメッセージで表すためのカスタムエラー。
// reason 判別ユニオンに乗らない想定外の事態（並行競合の取りこぼし、満たされるはずの
// 不変条件の破れ、infrastructure が返した素の失敗）を、素の Error の代わりに返す。
// instanceof で識別でき、message は常に何が起きたかを説明する。

/**
 * application 層が返す想定外エラーの基底。message は必須で、何が起きたかを述べる
 */
export class ApplicationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)

    this.name = "ApplicationError"
  }
}

/**
 * reason で分類しきれない想定外の失敗。並行競合の取りこぼしや、
 * 満たされるはずの不変条件が破れたケースを表す
 */
export class UnexpectedError extends ApplicationError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)

    this.name = "UnexpectedError"
  }
}
