import type { SoftwareLicenseContext } from "@/contexts/software-license/configuration/software-license-context"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { LicenseAssignmentEntity } from "@/contexts/software-license/domain/entities/license-assignment.entity"
import { LicenseError } from "@/contexts/software-license/domain/errors"
import { isLicenseAssignmentReplay } from "@/contexts/software-license/domain/policies/license-assignment-replay.policy"
import { LicenseActorReadAdapter } from "@/contexts/software-license/infrastructure/adapters/license-actor-read.adapter"
import { LicenseRepository } from "@/contexts/software-license/infrastructure/repositories/license/license.repository"
import { LicenseAssignmentRepository } from "@/contexts/software-license/infrastructure/repositories/license-assignment.repository"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"

type Command = Readonly<{
  id: string
  licenseId: number
  employeeId: EmployeeId
  accountReference: string | null
  reason: string
}>

type Context = SoftwareLicenseContext

/** 在籍する利用者へのプラン割当を、記録者と理由を付けて登録する。 */
export class AssignLicense {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command) {
    const authorization = await new LicenseActorReadAdapter(this.c).prepare([command.employeeId])
    if (authorization instanceof LicenseError) return authorization
    if (
      authorization.actor?.employment === null ||
      authorization.actor?.employment === undefined ||
      authorization.actor.employment.status === "TERMINATED"
    )
      return new LicenseError("forbidden", "current employee is required")
    const repository = new LicenseAssignmentRepository(this.c)
    const existing = await repository.find(command.id, authorization.assertions)
    if (existing instanceof Error)
      return new LicenseError("license_unavailable", "assignment is unavailable", {
        cause: existing,
      })
    if (existing !== null) {
      if (
        isLicenseAssignmentReplay(existing.props, {
          ...command,
          accountId: authorization.accountId,
        })
      )
        return { assignment: existing, isReplay: true }
      return new LicenseError("license_conflict", "assignment id belongs to another command")
    }
    const employee = authorization.employees.find(
      (candidate) => candidate.id === command.employeeId,
    )
    if (
      employee?.employment === null ||
      employee?.employment === undefined ||
      employee.employment.status === "TERMINATED"
    )
      return new LicenseError("invalid_license", "assignee must be a current employee")
    const license = await new LicenseRepository(this.c).find(command.licenseId)
    if (license instanceof Error)
      return new LicenseError("license_unavailable", "license is unavailable", { cause: license })
    if (license === null) return new LicenseError("license_not_found", "license not found")
    if (license.status !== "active")
      return new LicenseError("license_conflict", "license is cancelled")
    const assignment = LicenseAssignmentEntity.create({
      id: command.id,
      license_id: command.licenseId,
      employee_id: command.employeeId,
      service_name: license.name,
      plan_name: license.planName,
      account_reference: command.accountReference,
      assigned_at: authorization.now.getTime(),
      assigned_by: authorization.accountId,
      assigned_reason: command.reason,
      released_at: null,
      released_by: null,
      release_reason: null,
    })
    if (assignment instanceof LicenseError) return assignment
    const audit = SystemAuditEventEntity.create({
      actorAccountId: authorization.accountId,
      action: "software_license.assignment.recorded",
      targetType: "software_license_assignment",
      targetId: command.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({
        principalId: authorization.principalId,
        permission: "license:manage",
      }),
      beforeJson: null,
      afterJson: JSON.stringify(assignment.props),
      metadataJson: null,
      occurredAt: authorization.now,
    })
    if (audit instanceof Error)
      return new LicenseError("license_unavailable", "audit is unavailable", { cause: audit })
    const written = await repository.write(assignment, {
      isNew: true,
      licenseRevision: license.revision,
      assertions: authorization.assertions,
      audit,
    })
    if (written instanceof LicenseError) {
      if (written.code !== "license_conflict") return written
      const competing = await repository.find(command.id, authorization.assertions)
      if (
        competing instanceof LicenseAssignmentEntity &&
        isLicenseAssignmentReplay(competing.props, {
          ...command,
          accountId: authorization.accountId,
        })
      )
        return { assignment: competing, isReplay: true }
      return written
    }
    return { assignment, isReplay: false }
  }
}
