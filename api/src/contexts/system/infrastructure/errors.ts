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
