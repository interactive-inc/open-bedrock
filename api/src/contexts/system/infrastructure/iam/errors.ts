export class IamAccountReadError extends Error {
  constructor(key: string, cause?: unknown) {
    super(`IAM アカウント ${key} を取得できませんでした。`, { cause })
    this.name = "IamAccountReadError"
  }
}

export class IamAccountNotFoundError extends Error {
  constructor(userId: string) {
    super(`IAM アカウント ${userId} が見つかりません。`)
    this.name = "IamAccountNotFoundError"
  }
}

export class IamIdentityDuplicateError extends Error {
  constructor(cause?: unknown) {
    super("同じメールアドレスの IAM identity が既に存在します。", { cause })
    this.name = "IamIdentityDuplicateError"
  }
}

export class IamIdentityWriteError extends Error {
  constructor(operation: string, identityId: string, cause?: unknown) {
    super(`IAM identity ${identityId} の ${operation} に失敗しました。`, { cause })
    this.name = "IamIdentityWriteError"
  }
}
