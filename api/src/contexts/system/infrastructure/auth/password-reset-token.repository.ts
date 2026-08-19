import type { PasswordResetTokenEntity } from "@/contexts/system/domain/auth/password-reset-token.entity"
import { PasswordResetTokenWriteError } from "@/contexts/system/infrastructure/auth/errors"
import type { SystemDatabaseContext } from "@system/infrastructure/configuration/system-context"
import { passwordResetTokens } from "@/contexts/system/infrastructure/schema/system-runtime"

export class PasswordResetTokenRepository {
  constructor(private readonly c: SystemDatabaseContext) {}

  async write(entity: PasswordResetTokenEntity): Promise<void | PasswordResetTokenWriteError> {
    try {
      await this.c.var.database.insert(passwordResetTokens).values(entity)

      return undefined
    } catch (cause) {
      return new PasswordResetTokenWriteError("save", entity.id, cause)
    }
  }
}
