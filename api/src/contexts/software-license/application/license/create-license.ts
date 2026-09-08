import { LicenseCommandReadAdapter } from "@/contexts/software-license/infrastructure/adapters/license-command-read.adapter"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { LicenseEntity } from "@/contexts/software-license/domain/entities/license.entity"
import { LicenseError } from "@/contexts/software-license/domain/errors"
import { LicenseActorReadAdapter } from "@/contexts/software-license/infrastructure/adapters/license-actor-read.adapter"
import type { SoftwareLicenseContext as Context } from "@/contexts/software-license/configuration/software-license-context"
import { LicenseRepository } from "@/contexts/software-license/infrastructure/repositories/license/license.repository"

export type Command = {
  commandId?: string
  session: CompanySessionValue
  license: {
    name: string
    planName?: string | null
    vendor: string | null
    category: string | null
    seats: number | null
    renewalDeadline: string | null
    ownerEmployeeId: EmployeeId | null
    note: string | null
  }
  createdAt: string
}

/**
 * 権限を確認し、ライセンス・SaaS 台帳を新規登録する。
 */
export class CreateLicense {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<LicenseEntity | LicenseError> {
    if (
      !command.session.hasPermission("license:manage") &&
      !command.session.hasPermission("system:admin")
    ) {
      return new LicenseError("forbidden", "cannot manage licenses")
    }

    const authorization = await new LicenseActorReadAdapter(this.c).prepare(
      command.license.ownerEmployeeId === null ? [] : [command.license.ownerEmployeeId],
    )
    if (authorization instanceof LicenseError) return authorization
    if (
      authorization.actor?.employment === null ||
      authorization.actor?.employment === undefined ||
      authorization.actor.employment.status === "TERMINATED"
    )
      return new LicenseError("forbidden", "current employee is required")
    const canonical = CanonicalSystemJsonValue.create({
      ...command.license,
      planName: command.license.planName ?? null,
    })
    if (canonical instanceof Error)
      return new LicenseError("invalid_license", "invalid license registration")
    const requestJson = canonical.toString()
    if (command.commandId !== undefined) {
      const recorded = await new LicenseCommandReadAdapter(this.c).read({
        accountId: authorization.accountId,
        commandId: command.commandId,
        assertions: authorization.assertions,
      })
      if (recorded instanceof Error)
        return new LicenseError("license_unavailable", "license command is unavailable", {
          cause: recorded,
        })
      if (recorded !== null) {
        if (recorded.requestJson === requestJson) return recorded.license
        return new LicenseError("license_conflict", "registration key belongs to another command")
      }
    }
    if (
      command.license.ownerEmployeeId !== null &&
      !authorization.employees.some(
        (employee) =>
          employee.id === command.license.ownerEmployeeId &&
          employee.employment !== null &&
          employee.employment.status !== "TERMINATED",
      )
    )
      return new LicenseError("invalid_license", "owner must be a current employee")

    const license = LicenseEntity.create({
      name: command.license.name,
      planName: command.license.planName ?? null,
      vendor: command.license.vendor,
      category: command.license.category,
      seats: command.license.seats,
      renewalDeadline: command.license.renewalDeadline,
      ownerEmployeeId: command.license.ownerEmployeeId,
      note: command.license.note,
      createdAt: authorization.now.toISOString(),
    })

    const created = await new LicenseRepository(this.c).write(license, {
      previous: null,
      commandId: command.commandId,
      requestJson: command.commandId === undefined ? undefined : requestJson,
      accountId: authorization.accountId,
      recordedAt: authorization.now.getTime(),
      assertions: authorization.assertions,
    })

    if (created instanceof LicenseError) {
      if (created.code === "license_conflict" && command.commandId !== undefined) {
        const recorded = await new LicenseCommandReadAdapter(this.c).read({
          accountId: authorization.accountId,
          commandId: command.commandId,
          assertions: authorization.assertions,
        })
        if (
          !(recorded instanceof Error) &&
          recorded !== null &&
          recorded.requestJson === requestJson
        )
          return recorded.license
      }
      return created
    }

    return created
  }
}
