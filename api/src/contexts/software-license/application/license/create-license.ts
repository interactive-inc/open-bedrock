import type { Session } from "@/contexts/company/domain/iam/session"
import { License } from "@/contexts/software-license/domain/license/license.entity"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { LicenseRepository } from "@/contexts/software-license/infrastructure/license/license-repository"

export type Command = {
  session: Session
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
    if (command.session.hasPermission("license:manage") === false) {
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
