export class InvalidIamIdentityError extends Error {
  constructor(cause?: unknown) {
    super("IAM identity が不正です。", { cause })
    this.name = "InvalidIamIdentityError"
  }
}
