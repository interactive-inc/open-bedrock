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
