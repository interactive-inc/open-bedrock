import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { LicenseEntity } from "@/contexts/software-license/domain/entities/license.entity"
import { LicenseError } from "@/contexts/software-license/domain/errors"
import { LicenseActorReadAdapter } from "@/contexts/software-license/infrastructure/adapters/license-actor-read.adapter"
import type { SoftwareLicenseContext as Context } from "@/contexts/software-license/configuration/software-license-context"
import { LicenseRepository } from "@/contexts/software-license/infrastructure/repositories/license/license.repository"

export type Command = {
  session: CompanySessionValue
  id: number
  expectedRevision: number
  details: {
    name: string
    planName?: string | null
    vendor: string | null
    category: string | null
    seats: number | null
    renewalDeadline: string | null
    ownerEmployeeId: EmployeeId | null
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

  async run(command: Command): Promise<LicenseEntity | LicenseError> {
    const repository = new LicenseRepository(this.c)

    if (
      !command.session.hasPermission("license:manage") &&
      !command.session.hasPermission("system:admin")
    ) {
      return new LicenseError("forbidden", "cannot manage licenses")
    }

    const authorization = await new LicenseActorReadAdapter(this.c).prepare(
      command.details.ownerEmployeeId === null ? [] : [command.details.ownerEmployeeId],
    )
    if (authorization instanceof LicenseError) return authorization
    if (
      authorization.actor?.employment === null ||
      authorization.actor?.employment === undefined ||
      authorization.actor.employment.status === "TERMINATED"
    )
      return new LicenseError("forbidden", "current employee is required")
    if (
      command.details.ownerEmployeeId !== null &&
      !authorization.employees.some(
        (employee) =>
          employee.id === command.details.ownerEmployeeId &&
          employee.employment !== null &&
          employee.employment.status !== "TERMINATED",
      )
    )
      return new LicenseError("invalid_license", "owner must be a current employee")

    const license = await repository.find(command.id)

    if (license instanceof Error) {
      return new LicenseError("license_unavailable", "failed to find license", { cause: license })
    }

    if (license === null) {
      return new LicenseError("license_not_found", "license not found")
    }

    if (command.expectedRevision !== license.revision)
      return new LicenseError("license_conflict", "license revision changed")

    const updated = await repository.write(license.withDetails(command.details), {
      previous: license,
      accountId: authorization.accountId,
      recordedAt: authorization.now.getTime(),
      assertions: authorization.assertions,
    })

    if (updated instanceof LicenseError) return updated

    if (updated === null) {
      return new LicenseError("license_not_found", "license not found")
    }

    return updated
  }
}
