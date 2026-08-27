import type { Session } from "@/lib/auth/session"
import type { License } from "@/contexts/software-license/domain/entities/license.entity"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { LicenseRepository } from "@/contexts/software-license/infrastructure/repositories/license/license.repository"

export type Command = {
  session: Session
  id: number
  details: {
    name: string
    vendor: string | null
    category: string | null
    seats: number | null
    renewalDeadline: string | null
    ownerEmployeeId: number | null
    note: string | null
  }
}

/**
 * 権限と存在を確認し、ライセンス台帳の属性を更新する。
 */
export class UpdateLicense {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

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

    const updated = await repository.update(license.withDetails(command.details))

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update license", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("license not found", "license_not_found")
    }

    return updated
  }
}
