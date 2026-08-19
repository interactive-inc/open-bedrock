export class InvalidPasswordResetTokenError extends Error {
  constructor(cause?: unknown) {
    super("invalid_password_reset_token", { cause })
    this.name = "InvalidPasswordResetTokenError"
    Object.freeze(this)
  }
}
