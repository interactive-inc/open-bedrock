import type { Session } from "@/lib/auth/session"
import type { License } from "@/contexts/software-license/domain/entities/license.entity"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { LicenseRepository } from "@/contexts/software-license/infrastructure/license/license.repository"

export type Command = {
  session: Session
  id: number
}

/**
 * 権限と存在を確認し、ライセンスを解約済みに倒す。棚卸し履歴を壊さないため物理削除はしない。
 */
export class CancelLicense {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<License | ApplicationError> {
    const repository = new LicenseRepository(this.c)

    if (command.session.hasPermission("license:manage") === false) {
      return new ForbiddenError("cannot manage licenses", "forbidden")
    }

    const license = await repository.findById(command.id)

    if (license instanceof Error) {
      return new UnexpectedError("failed to find license", { cause: license })
    }

    if (license === null) {
      return new NotFoundError("license not found", "license_not_found")
    }

    const updated = await repository.update(license.cancel())

    if (updated instanceof Error) {
      return new UnexpectedError("failed to cancel license", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("license not found", "license_not_found")
    }

    return updated
  }
}
