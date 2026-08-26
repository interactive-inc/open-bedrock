export class IamAccountReadError extends Error {
  constructor(key: string, cause?: unknown) {
    super(`IAM アカウント ${key} を取得できませんでした。`, { cause })
    this.name = "IamAccountReadError"
  }
}
