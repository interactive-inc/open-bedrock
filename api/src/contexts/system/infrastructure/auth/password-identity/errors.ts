import { InfrastructureError } from "@/lib/errors/infrastructure-error"

export class PasswordIdentityReadError extends InfrastructureError {
  constructor(identifier: string, cause?: unknown) {
    super(
      "PasswordIdentityReadError",
      "failed to read password identity",
      { entity: "user_identity", operation: "read", entityId: identifier },
      { cause },
    )
  }
}

export class PasswordIdentityWriteError extends InfrastructureError {
  constructor(identityId: string, cause?: unknown) {
    super(
      "PasswordIdentityWriteError",
      "failed to update password identity",
      { entity: "user_identity", operation: "update", entityId: identityId },
      { cause },
    )
  }
}
