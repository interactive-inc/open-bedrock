import type { SoftwareLicenseContext } from "@/contexts/software-license/configuration/software-license-context"
import { LicenseAssignmentEntity } from "@/contexts/software-license/domain/entities/license-assignment.entity"
import { LicenseError } from "@/contexts/software-license/domain/errors"
import { LicenseActorReadAdapter } from "@/contexts/software-license/infrastructure/adapters/license-actor-read.adapter"
import { LicenseRepository } from "@/contexts/software-license/infrastructure/repositories/license/license.repository"
import { LicenseAssignmentRepository } from "@/contexts/software-license/infrastructure/repositories/license-assignment.repository"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"

type Context = SoftwareLicenseContext

/** 退職者も含む利用者の割当解除を記録し、元の割当履歴を保持する。 */
export class ReleaseLicenseAssignment {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(
    command: Readonly<{ id: string; reason: string }>,
  ): Promise<LicenseAssignmentEntity | LicenseError> {
    const authorization = await new LicenseActorReadAdapter(this.c).prepare()
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
    if (existing === null) return new LicenseError("assignment_not_found", "assignment not found")
    if (existing.props.released_at !== null) {
      if (
        existing.props.released_by === authorization.accountId &&
        existing.props.release_reason === command.reason
      )
        return existing
      return new LicenseError("license_conflict", "assignment was released by another command")
    }
    const license = await new LicenseRepository(this.c).find(existing.props.license_id)
    if (license instanceof Error || license === null)
      return new LicenseError("license_unavailable", "license is unavailable")
    const released = existing.release({
      at: authorization.now.getTime(),
      accountId: authorization.accountId,
      reason: command.reason,
    })
    if (released instanceof LicenseError) return released
    const audit = SystemAuditEventEntity.create({
      actorAccountId: authorization.accountId,
      action: "software_license.assignment.released",
      targetType: "software_license_assignment",
      targetId: command.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({
        principalId: authorization.principalId,
        permission: "license:manage",
      }),
      beforeJson: JSON.stringify(existing.props),
      afterJson: JSON.stringify(released.props),
      metadataJson: null,
      occurredAt: authorization.now,
    })
    if (audit instanceof Error)
      return new LicenseError("license_unavailable", "audit is unavailable", { cause: audit })
    const written = await repository.write(released, {
      isNew: false,
      licenseRevision: license.revision,
      assertions: authorization.assertions,
      audit,
    })
    if (written instanceof LicenseError) {
      if (written.code !== "license_conflict") return written
      const competing = await repository.find(command.id, authorization.assertions)
      if (
        competing instanceof LicenseAssignmentEntity &&
        competing.props.released_by === authorization.accountId &&
        competing.props.release_reason === command.reason
      )
        return competing
      return written
    }
    return released
  }
}
