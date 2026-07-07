import { License } from "@/domain/license/license.entity"
import { canManageLicenses } from "@/lib/license/can-manage-licenses"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import { LicenseRepository } from "@/infrastructure/license/license-repository"

export type Command = {
  session: SessionPayload
  license: {
    name: string
    vendor: string | null
    category: string | null
    seats: number | null
    renewalDeadline: string | null
    ownerEmployeeId: number | null
    note: string | null
  }
  createdAt: string
}

/**
 * 権限を確認し、ライセンス・SaaS 台帳を新規登録する。
 */
export class CreateLicense {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<License | ApplicationError> {
    if (canManageLicenses(command.session) === false) {
      return new ForbiddenError("cannot manage licenses", "forbidden")
    }

    const license = License.create({
      name: command.license.name,
      vendor: command.license.vendor,
      category: command.license.category,
      seats: command.license.seats,
      renewalDeadline: command.license.renewalDeadline,
      ownerEmployeeId: command.license.ownerEmployeeId,
      note: command.license.note,
      createdAt: command.createdAt,
    })

    const created = await new LicenseRepository(this.c).create(license)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create license", { cause: created })
    }

    return created
  }
}
