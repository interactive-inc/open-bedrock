export class IamAccountNotFoundError extends Error {
  constructor(userId: string) {
    super(`IAM アカウント ${userId} が見つかりません。`)
    this.name = "IamAccountNotFoundError"
  }
}
