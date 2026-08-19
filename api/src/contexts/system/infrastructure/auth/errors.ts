import { InfrastructureError } from "@/lib/errors/infrastructure-error"

export class SystemAuthReadError extends InfrastructureError {
  constructor(operation: string, cause: unknown, entityId?: string) {
    super(
      "SystemAuthReadError",
      "authentication data could not be read",
      {
        entity: "authentication",
        operation,
        entityId,
      },
      { cause },
    )
  }
}

export class PasswordIdentityWriteError extends InfrastructureError {
  constructor(operation: string, identityId: string, cause: unknown) {
    super(
      "PasswordIdentityWriteError",
      "password identity could not be written",
      {
        entity: "password_identity",
        operation,
        entityId: identityId,
      },
      { cause },
    )
  }
}

export class PasswordResetTokenWriteError extends InfrastructureError {
  constructor(operation: "save", tokenId: string, cause: unknown) {
    super(
      "PasswordResetTokenWriteError",
      "password reset token could not be written",
      {
        entity: "password_reset_token",
        operation,
        entityId: tokenId,
      },
      { cause },
    )
  }
}

export class PasswordResetCompletionWriteError extends InfrastructureError {
  constructor(tokenId: string, cause: unknown) {
    super(
      "PasswordResetCompletionWriteError",
      "password reset could not be completed atomically",
      {
        entity: "password_reset",
        operation: "complete",
        entityId: tokenId,
      },
      { cause },
    )
  }
}
